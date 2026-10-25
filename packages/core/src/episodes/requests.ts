import { type Database, schema } from "@unread/db";
import { and, asc, eq, gte, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import { localClock, localDate } from "../util/dates";

/**
 * Users whose delivery time has arrived (prd §6): runs start 30 minutes
 * before delivery, in the user's timezone. Weekly users only on their day.
 * Creates one scheduled request per user per local date (unique index).
 */
export async function dispatchDueRequests(options: { db: Database; now: Date; leadMinutes?: number }): Promise<string[]> {
  const { db, now, leadMinutes = 30 } = options;
  const users = await db
    .select({
      id: schema.users.id,
      timezone: schema.users.timezone,
      deliveryTime: schema.users.deliveryTime,
      cadence: schema.users.cadence,
      weeklyDay: schema.users.weeklyDay,
    })
    .from(schema.users)
    .where(isNotNull(schema.users.onboardedAt));

  const due: { userId: string; date: string }[] = [];
  for (const user of users) {
    let clock: { weekday: number; minutes: number };
    try {
      clock = localClock(now, user.timezone);
    } catch {
      continue;
    }
    const [h, m] = user.deliveryTime.split(":").map(Number);
    const start = (h ?? 7) * 60 + (m ?? 0) - leadMinutes;
    // Due from the start time until end of day, so a missed tick still catches up.
    const inWindow = clock.minutes >= start;
    const rightDay = user.cadence === "daily" || clock.weekday === user.weeklyDay;
    if (inWindow && rightDay) due.push({ userId: user.id, date: localDate(now, user.timezone) });
  }
  if (due.length === 0) return [];
  const created = await db
    .insert(schema.episodeRequests)
    .values(due.map((d) => ({ ...d, reason: "scheduled" as const })))
    .onConflictDoNothing()
    .returning({ id: schema.episodeRequests.id });
  return created.map((c) => c.id);
}

export class RateLimitedError extends Error {}

/** "Make one now" (prd §6): per-plan daily limit; returns the request id. */
export async function requestEpisodeNow(options: {
  db: Database;
  userId: string;
  timezone: string;
  now: Date;
  dailyLimit: number;
}): Promise<string> {
  const { db, userId, now } = options;
  const since = new Date(now.getTime() - 24 * 3_600_000);
  const [recent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.episodeRequests)
    .where(
      and(
        eq(schema.episodeRequests.userId, userId),
        eq(schema.episodeRequests.reason, "manual"),
        gte(schema.episodeRequests.createdAt, since),
        // A failure on our side shouldn't use up the user's "make one now" (prd §12: "Try again").
        ne(schema.episodeRequests.status, "failed"),
      ),
    );
  if ((recent?.count ?? 0) >= options.dailyLimit) {
    throw new RateLimitedError(`You can make ${options.dailyLimit} extra episode${options.dailyLimit === 1 ? "" : "s"} a day`);
  }
  const [running] = await db
    .select({ id: schema.episodeRequests.id })
    .from(schema.episodeRequests)
    .where(and(eq(schema.episodeRequests.userId, userId), inArray(schema.episodeRequests.status, ["pending", "running"])))
    .limit(1);
  if (running) return running.id;
  const [row] = await db
    .insert(schema.episodeRequests)
    .values({ userId, date: localDate(now, options.timezone), reason: "manual" })
    .returning({ id: schema.episodeRequests.id });
  if (!row) throw new Error("Could not create request");
  return row.id;
}

/** Poller (no Temporal): atomically claim the oldest pending request. */
export async function claimNextRequest(db: Database): Promise<string | null> {
  const rows = await db.execute<{ id: string }>(sql`
    update ${schema.episodeRequests} set status = 'running', started_at = now()
    where id = (
      select id from ${schema.episodeRequests} where status = 'pending'
      order by created_at asc for update skip locked limit 1
    )
    returning id`);
  return rows[0]?.id ?? null;
}

export async function pendingRequestIds(db: Database, limit = 20): Promise<string[]> {
  const rows = await db
    .select({ id: schema.episodeRequests.id })
    .from(schema.episodeRequests)
    .where(eq(schema.episodeRequests.status, "pending"))
    .orderBy(asc(schema.episodeRequests.createdAt))
    .limit(limit);
  return rows.map((r) => r.id);
}

const STALE_MESSAGE = "it took too long to make, so we stopped it";

async function failRequests(db: Database, requestIds: string[], message: string, now: Date): Promise<void> {
  if (requestIds.length === 0) return;
  const rows = await db
    .update(schema.episodeRequests)
    .set({ status: "failed", message, finishedAt: now })
    .where(inArray(schema.episodeRequests.id, requestIds))
    .returning({ episodeId: schema.episodeRequests.episodeId });
  const episodeIds = rows.flatMap((r) => (r.episodeId ? [r.episodeId] : []));
  if (episodeIds.length) {
    await db
      .update(schema.episodes)
      .set({ status: "failed", error: { message, detail: "stale request" } })
      .where(and(inArray(schema.episodes.id, episodeIds), ne(schema.episodes.status, "ready")));
  }
}

/**
 * Safety net for both runners (hourly maintenance): a request still "running"
 * after `maxRunningMs` lost its worker, and one still "pending" after
 * `maxPendingMs` was never picked up. Fail them so Home stops showing progress
 * and "Make one now" works again.
 */
export async function failStaleRequests(options: { db: Database; now: Date; maxRunningMs?: number; maxPendingMs?: number }): Promise<number> {
  const { db, now, maxRunningMs = 2 * 3_600_000, maxPendingMs = 6 * 3_600_000 } = options;
  const running = await db
    .select({ id: schema.episodeRequests.id })
    .from(schema.episodeRequests)
    .where(and(eq(schema.episodeRequests.status, "running"), lt(schema.episodeRequests.startedAt, new Date(now.getTime() - maxRunningMs))));
  const pending = await db
    .select({ id: schema.episodeRequests.id })
    .from(schema.episodeRequests)
    .where(and(eq(schema.episodeRequests.status, "pending"), lt(schema.episodeRequests.createdAt, new Date(now.getTime() - maxPendingMs))));
  const ids = [...running, ...pending].map((r) => r.id);
  await failRequests(db, ids, STALE_MESSAGE, now);
  return ids.length;
}

/**
 * Poller start-up (it's the only runner without Temporal): anything left
 * "running" was cut off by a crash or redeploy. Recent ones go back to
 * "pending" and resume from their stored step outputs; old ones fail, so a
 * request that keeps crashing the worker can't loop forever.
 */
export async function recoverOrphanedRequests(options: { db: Database; now: Date; maxAgeMs?: number }): Promise<{ requeued: number; failed: number }> {
  const { db, now, maxAgeMs = 2 * 3_600_000 } = options;
  const cutoff = new Date(now.getTime() - maxAgeMs);
  const requeued = await db
    .update(schema.episodeRequests)
    .set({ status: "pending" })
    .where(and(eq(schema.episodeRequests.status, "running"), gte(schema.episodeRequests.startedAt, cutoff)))
    .returning({ id: schema.episodeRequests.id });
  const old = await db
    .select({ id: schema.episodeRequests.id })
    .from(schema.episodeRequests)
    .where(and(eq(schema.episodeRequests.status, "running"), lt(schema.episodeRequests.startedAt, cutoff)));
  await failRequests(db, old.map((r) => r.id), STALE_MESSAGE, now);
  return { requeued: requeued.length, failed: old.length };
}

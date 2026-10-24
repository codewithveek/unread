import { type Database, schema } from "@unread/db";
import { and, asc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
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
    .where(and(eq(schema.episodeRequests.userId, userId), eq(schema.episodeRequests.reason, "manual"), gte(schema.episodeRequests.createdAt, since)));
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

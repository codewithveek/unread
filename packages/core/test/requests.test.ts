import { schema } from "@unread/db";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { failStaleRequests, RateLimitedError, recoverOrphanedRequests, requestEpisodeNow } from "../src/episodes/requests";
import { createTestUser, randomAlias, testDatabaseUrl, testDb } from "./helpers";

describe.skipIf(!testDatabaseUrl)("episode requests", () => {
  const db = testDb();
  afterAll(async () => {
    await db.$client.end();
  });

  const requestRow = async (id: string) => (await db.select().from(schema.episodeRequests).where(eq(schema.episodeRequests.id, id)))[0];

  it("a failed 'make one now' doesn't use up the daily limit", async () => {
    const user = await createTestUser(db, { alias: randomAlias(), email: "r1@example.com" });
    const now = new Date();
    const first = await requestEpisodeNow({ db, userId: user.id, timezone: "UTC", now, dailyLimit: 1 });
    await db.update(schema.episodeRequests).set({ status: "failed" }).where(eq(schema.episodeRequests.id, first));
    const second = await requestEpisodeNow({ db, userId: user.id, timezone: "UTC", now, dailyLimit: 1 });
    expect(second).not.toBe(first);
    await db.update(schema.episodeRequests).set({ status: "done" }).where(eq(schema.episodeRequests.id, second));
    await expect(requestEpisodeNow({ db, userId: user.id, timezone: "UTC", now, dailyLimit: 1 })).rejects.toBeInstanceOf(RateLimitedError);
  });

  it("fails requests stuck running or pending, and their episodes", async () => {
    const user = await createTestUser(db, { alias: randomAlias(), email: "r2@example.com" });
    const now = new Date();
    const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
    const [episode] = await db.insert(schema.episodes).values({ userId: user.id, date: "2026-10-25", status: "voicing" }).returning();
    const [stuck] = await db
      .insert(schema.episodeRequests)
      .values({ userId: user.id, date: "2026-10-25", reason: "manual", status: "running", startedAt: hoursAgo(3), episodeId: episode?.id })
      .returning();
    const [fresh] = await db
      .insert(schema.episodeRequests)
      .values({ userId: user.id, date: "2026-10-24", reason: "manual", status: "running", startedAt: hoursAgo(0.5) })
      .returning();
    const [neverStarted] = await db
      .insert(schema.episodeRequests)
      .values({ userId: user.id, date: "2026-10-23", reason: "manual", status: "pending", createdAt: hoursAgo(8) })
      .returning();
    if (!stuck || !fresh || !neverStarted || !episode) throw new Error("setup");

    await failStaleRequests({ db, now });
    expect((await requestRow(stuck.id))?.status).toBe("failed");
    expect((await requestRow(stuck.id))?.message).toMatch(/too long/);
    expect((await requestRow(neverStarted.id))?.status).toBe("failed");
    expect((await requestRow(fresh.id))?.status).toBe("running");
    const [ep] = await db.select().from(schema.episodes).where(eq(schema.episodes.id, episode.id));
    expect(ep?.status).toBe("failed");
  });

  it("poller start-up re-queues recent orphans and fails old ones", async () => {
    const user = await createTestUser(db, { alias: randomAlias(), email: "r3@example.com" });
    const now = new Date();
    const [recent] = await db
      .insert(schema.episodeRequests)
      .values({ userId: user.id, date: "2026-10-25", reason: "manual", status: "running", startedAt: new Date(now.getTime() - 60_000) })
      .returning();
    const [old] = await db
      .insert(schema.episodeRequests)
      .values({ userId: user.id, date: "2026-10-24", reason: "manual", status: "running", startedAt: new Date(now.getTime() - 5 * 3_600_000) })
      .returning();
    if (!recent || !old) throw new Error("setup");
    const result = await recoverOrphanedRequests({ db, now });
    expect(result.requeued).toBeGreaterThanOrEqual(1);
    expect((await requestRow(recent.id))?.status).toBe("pending");
    expect((await requestRow(old.id))?.status).toBe("failed");
  });
});

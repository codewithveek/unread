import { schema } from "@unread/db";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import type { MailMessage } from "../src/mail";
import { redeemPromoCode, runTrialLifecycle } from "../src/promo";
import { createTestUser, randomAlias, testDatabaseUrl, testDb } from "./helpers";

describe.skipIf(!testDatabaseUrl)("promo codes", () => {
  const db = testDb();
  const now = new Date("2026-10-24T12:00:00Z");
  afterAll(async () => {
    await db.$client.end();
  });

  const newCode = async (values: Partial<typeof schema.promoCodes.$inferInsert> = {}) => {
    const code = `HACK-${randomAlias().toUpperCase()}`;
    await db.insert(schema.promoCodes).values({ code, trialDays: 14, ...values });
    return code;
  };

  it("requires a verified email and is case-insensitive", async () => {
    const user = await createTestUser(db, { alias: randomAlias(), email: "a@example.com" });
    const code = await newCode();
    expect(await redeemPromoCode({ db, userId: user.id, code, emailVerified: false, now })).toEqual({ ok: false, error: "email_unverified" });
    const ok = await redeemPromoCode({ db, userId: user.id, code: ` ${code.toLowerCase()} `, emailVerified: true, now });
    expect(ok).toMatchObject({ ok: true, episodeLimit: 3 });
    expect(await redeemPromoCode({ db, userId: user.id, code, emailVerified: true, now })).toEqual({ ok: false, error: "already_redeemed" });
    expect(await redeemPromoCode({ db, userId: user.id, code: await newCode(), emailVerified: true, now })).toEqual({ ok: false, error: "trial_active" });
  });

  it("never over-redeems under concurrency", async () => {
    const code = await newCode({ maxRedemptions: 3 });
    const users = await Promise.all(Array.from({ length: 8 }, () => createTestUser(db, { alias: randomAlias(), email: "c@example.com" })));
    const results = await Promise.all(users.map((u) => redeemPromoCode({ db, userId: u.id, code, emailVerified: true, now })));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.error === "exhausted")).toBe(true);
    const [row] = await db.select().from(schema.promoCodes).where(eq(schema.promoCodes.code, code));
    expect(row?.redeemedCount).toBe(3);
  });

  it("refuses expired, inactive and paid-Plus cases", async () => {
    const user = await createTestUser(db, { alias: randomAlias(), email: "d@example.com" });
    expect(await redeemPromoCode({ db, userId: user.id, code: await newCode({ expiresAt: new Date("2026-01-01") }), emailVerified: true, now })).toEqual({ ok: false, error: "expired" });
    expect(await redeemPromoCode({ db, userId: user.id, code: await newCode({ active: false }), emailVerified: true, now })).toEqual({ ok: false, error: "invalid" });
    await db.insert(schema.subscriptions).values({ userId: user.id, bachsCustomerId: "cust_x", bachsSubscriptionId: `sub_${randomAlias()}`, productId: "prod_x", status: "active" });
    expect(await redeemPromoCode({ db, userId: user.id, code: await newCode(), emailVerified: true, now })).toEqual({ ok: false, error: "already_plus" });
  });

  it("emails 3 days before and on the day, once each, then ends the trial", async () => {
    const alias = randomAlias();
    const email = `${alias}@example.com`;
    const user = await createTestUser(db, { alias, email });
    await redeemPromoCode({ db, userId: user.id, code: await newCode({ trialDays: 5 }), emailVerified: true, now });
    const sent: MailMessage[] = [];
    const mailer = { send: async (m: MailMessage) => void sent.push(m) };
    const config = loadConfig({ ...process.env, DATABASE_URL: testDatabaseUrl, APP_BASE_URL: "https://getunread.site" });
    const at = (days: number) => new Date(now.getTime() + days * 86_400_000);

    await runTrialLifecycle({ db, config, now: at(1), mailer });
    expect(sent.filter((m) => m.to === email)).toHaveLength(0);
    await runTrialLifecycle({ db, config, now: at(2.5), mailer });
    await runTrialLifecycle({ db, config, now: at(3), mailer });
    const mine = () => sent.filter((m) => m.to === email);
    expect(mine().map((m) => m.subject)).toEqual([expect.stringMatching(/^Your Studio voice ends on/)]);
    expect(mine()[0]?.text).toContain("https://getunread.site/settings#plan");

    await runTrialLifecycle({ db, config, now: at(5.1), mailer });
    expect(mine().map((m) => m.subject)).toEqual([expect.any(String), "Your Studio voice trial has ended"]);
    const [redemption] = await db.select().from(schema.promoRedemptions).where(eq(schema.promoRedemptions.userId, user.id));
    expect(redemption?.endedReason).toBe("expired");
    await runTrialLifecycle({ db, config, now: at(6), mailer });
    expect(mine()).toHaveLength(2);
  });
});

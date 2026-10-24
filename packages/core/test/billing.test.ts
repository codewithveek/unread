import { createHmac } from "node:crypto";
import { schema } from "@unread/db";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { type BachsEvent, createBachsClient, handleBachsEvent, verifyBachsSignature } from "../src/billing";
import { loadPlanContext } from "../src/plans";
import { createTestUser, randomAlias, testDatabaseUrl, testDb } from "./helpers";

describe("Bachs signatures", () => {
  const body = '{"id":"evt_1"}';
  const sign = (secret: string, t: number) => createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");

  it("accepts V2 with any valid v1 (rotation) and rejects stale or wrong ones", () => {
    const t = 1_760_000_000;
    const headers = new Headers({ "x-bachs-signature-v2": `t=${t},v1=${sign("old", t)},v1=${sign("new", t)}` });
    expect(verifyBachsSignature({ rawBody: body, secret: "new", headers, nowSeconds: t + 10 })).toBe(true);
    expect(verifyBachsSignature({ rawBody: body, secret: "new", headers, nowSeconds: t + 1000 })).toBe(false);
    expect(verifyBachsSignature({ rawBody: `${body} `, secret: "new", headers, nowSeconds: t })).toBe(false);
    const v1 = new Headers({ "x-bachs-timestamp": String(t), "x-bachs-signature": sign("s", t) });
    expect(verifyBachsSignature({ rawBody: body, secret: "s", headers: v1, nowSeconds: t })).toBe(true);
  });

  it("creates checkout sessions with our user id in metadata", async () => {
    let sent: unknown;
    const client = createBachsClient({
      apiUrl: "https://sandbox-api.bachs.io",
      apiKey: "sk_sandbox_x",
      fetchImpl: (async (_url: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body));
        return Response.json({ checkout_id: "chk_1", checkout_url: "https://checkout.bachs.io/c/abc" });
      }) as unknown as typeof fetch,
    });
    const result = await client.createCheckoutSession({ productId: "prod_1", customer: { email: "a@b.co" }, userId: "u1" });
    expect(result.checkoutUrl).toBe("https://checkout.bachs.io/c/abc");
    expect(sent).toMatchObject({ product_cart: [{ product_id: "prod_1", quantity: 1 }], metadata: { user_id: "u1" }, customer: { email: "a@b.co" } });
  });
});

describe.skipIf(!testDatabaseUrl)("Bachs webhooks", () => {
  const db = testDb();
  afterAll(async () => {
    await db.$client.end();
  });

  const event = (overrides: Partial<BachsEvent> & { status?: string; userId: string; subId: string; at: string; cancelAtPeriodEnd?: boolean }): BachsEvent => ({
    id: `evt_${randomAlias()}`,
    type: overrides.type ?? "customer.subscription.created",
    created_at: overrides.at,
    data: {
      subscription_id: overrides.subId,
      customer: { customer_id: "cust_1" },
      product_id: "prod_plus_monthly",
      status: overrides.status ?? "active",
      current_period_end: "2026-11-24T00:00:00Z",
      cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
      metadata: { user_id: overrides.userId },
    },
  });

  it("upgrades only via webhook, ignores replays and stale events, ends trials", async () => {
    const user = await createTestUser(db, { alias: randomAlias(), email: "b@example.com" });
    const [code] = await db.insert(schema.promoCodes).values({ code: `B-${randomAlias()}`, trialDays: 14 }).returning();
    await db.insert(schema.promoRedemptions).values({ codeId: code?.id ?? "", userId: user.id, trialEndsAt: new Date(Date.now() + 86_400_000 * 7) });
    const subId = `sub_${randomAlias()}`;

    const created = event({ userId: user.id, subId, at: "2026-10-24T10:00:00Z" });
    expect(await handleBachsEvent(db, created)).toBe("processed");
    expect(await handleBachsEvent(db, created)).toBe("duplicate");
    let ctx = await loadPlanContext({ db, userId: user.id, now: new Date() });
    expect(ctx).toMatchObject({ user: { plan: "plus" }, plan: { source: "paid", voiceProvider: "elevenlabs" } });
    const [redemption] = await db.select().from(schema.promoRedemptions).where(eq(schema.promoRedemptions.userId, user.id));
    expect(redemption?.endedReason).toBe("upgraded");

    // Cancel at period end keeps Plus; an older event arriving late changes nothing.
    expect(await handleBachsEvent(db, event({ type: "customer.subscription.updated", userId: user.id, subId, at: "2026-10-25T10:00:00Z", cancelAtPeriodEnd: true }))).toBe("processed");
    expect(await handleBachsEvent(db, event({ type: "customer.subscription.updated", userId: user.id, subId, at: "2026-10-24T11:00:00Z", status: "past_due" }))).toBe("stale");
    ctx = await loadPlanContext({ db, userId: user.id, now: new Date() });
    expect(ctx.plan.source).toBe("paid");

    // Period over: deleted → Free.
    expect(
      await handleBachsEvent(db, {
        ...event({ type: "customer.subscription.deleted", userId: user.id, subId, at: "2026-11-24T00:00:01Z", status: "canceled" }),
        data: { ...event({ userId: user.id, subId, at: "x" }).data, status: "canceled", current_period_end: "2026-10-01T00:00:00Z" },
      }),
    ).toBe("processed");
    ctx = await loadPlanContext({ db, userId: user.id, now: new Date() });
    expect(ctx).toMatchObject({ user: { plan: "free" }, plan: { source: "free" } });
  });
});

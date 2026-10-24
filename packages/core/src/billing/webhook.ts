import { type Database, schema } from "@unread/db";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { subscriptionGrantsPlus } from "../plans";

export const bachsEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  created_at: z.string(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type BachsEvent = z.infer<typeof bachsEventSchema>;

const subscriptionDataSchema = z.object({
  subscription_id: z.string(),
  customer: z.object({ customer_id: z.string() }),
  product_id: z.string(),
  status: z.string(),
  current_period_end: z.string().nullable().optional(),
  cancel_at_period_end: z.boolean().optional(),
  metadata: z.object({ user_id: z.string() }).partial().optional(),
});

type OurStatus = (typeof schema.subscriptionStatus.enumValues)[number];

/** Bachs → ours. Unknown or exhausted states grant nothing. */
export function mapBachsStatus(status: string): OurStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "cancelled":
      return "cancelled";
    default:
      return "expired";
  }
}

export type WebhookOutcome = "processed" | "duplicate" | "ignored" | "stale";

/**
 * Plan changes only happen here (prd §8.2): store the event once (replays
 * are no-ops), save the full subscription state, skip out-of-order events,
 * set the paid plan, and end any promo trial on upgrade.
 */
export async function handleBachsEvent(db: Database, event: BachsEvent): Promise<WebhookOutcome> {
  return db.transaction(async (tx) => {
    const [stored] = await tx
      .insert(schema.billingEvents)
      .values({ id: event.id, type: event.type, payload: event })
      .onConflictDoNothing()
      .returning({ id: schema.billingEvents.id });
    if (!stored) return "duplicate";

    const markProcessed = () =>
      tx.update(schema.billingEvents).set({ processedAt: new Date() }).where(eq(schema.billingEvents.id, event.id));

    if (!event.type.startsWith("customer.subscription.")) {
      await markProcessed();
      return "ignored";
    }
    const sub = subscriptionDataSchema.parse(event.data);
    const eventAt = new Date(event.created_at);
    const [existing] = await tx
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.bachsSubscriptionId, sub.subscription_id));
    const userId = sub.metadata?.user_id ?? existing?.userId;
    if (!userId) {
      await markProcessed();
      return "ignored";
    }
    if (existing && existing.updatedAt > eventAt) {
      await markProcessed();
      return "stale";
    }

    const values = {
      userId,
      bachsCustomerId: sub.customer.customer_id,
      bachsSubscriptionId: sub.subscription_id,
      productId: sub.product_id,
      status: event.type === "customer.subscription.deleted" ? ("cancelled" as const) : mapBachsStatus(sub.status),
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      updatedAt: eventAt,
    };
    await tx
      .insert(schema.subscriptions)
      .values(values)
      .onConflictDoUpdate({ target: schema.subscriptions.bachsSubscriptionId, set: values });

    const all = await tx.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
    const plus = all.some((s) => subscriptionGrantsPlus(s, new Date()));
    await tx.update(schema.users).set({ plan: plus ? "plus" : "free" }).where(eq(schema.users.id, userId));
    if (plus) {
      await tx
        .update(schema.promoRedemptions)
        .set({ endedAt: new Date(), endedReason: "upgraded" })
        .where(and(eq(schema.promoRedemptions.userId, userId), isNull(schema.promoRedemptions.endedAt)));
    }
    await markProcessed();
    return "processed";
  });
}

import { type Database, schema, type User } from "@unread/db";
import { and, eq } from "drizzle-orm";
import { type EffectivePlan, type EpisodeBudget, effectivePlan, episodeBudget, usageMonth } from "./index";

export interface PlanContext {
  user: User;
  plan: EffectivePlan;
  budget: EpisodeBudget;
  usage: { charactersUsed: number; episodesMade: number; month: string };
}

/** Everything plan-related for one user, read once (web Settings, pipeline, dispatcher). */
export async function loadPlanContext(options: { db: Database; userId: string; now: Date }): Promise<PlanContext> {
  const { db, userId, now } = options;
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) throw new Error(`No user ${userId}`);
  const [subscriptions, redemptions, usageRows] = await Promise.all([
    db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)),
    db.select().from(schema.promoRedemptions).where(eq(schema.promoRedemptions.userId, userId)),
    db
      .select()
      .from(schema.usageMonthly)
      .where(and(eq(schema.usageMonthly.userId, userId), eq(schema.usageMonthly.month, usageMonth(now)))),
  ]);
  const plan = effectivePlan({ subscriptions, redemptions, now });
  const usage = {
    charactersUsed: usageRows[0]?.charactersUsed ?? 0,
    episodesMade: usageRows[0]?.episodesMade ?? 0,
    month: usageMonth(now),
  };
  const budget = episodeBudget({
    plan,
    episodeMinutes: user.episodeMinutes,
    charactersUsedThisMonth: usage.charactersUsed,
    episodesMadeThisMonth: usage.episodesMade,
  });
  return { user, plan, budget, usage };
}

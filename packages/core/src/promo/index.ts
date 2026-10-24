import { type Database, schema } from "@unread/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { CoreConfig } from "../config";
import { type Mailer, mailerFromConfig } from "../mail";
import { subscriptionGrantsPlus, trialIsLive } from "../plans";

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export type RedeemResult =
  | { ok: true; trialEndsAt: Date; episodeLimit: number }
  | {
      ok: false;
      error: "email_unverified" | "invalid" | "expired" | "exhausted" | "already_plus" | "trial_active" | "already_redeemed";
    };

export const REDEEM_ERRORS: Record<Exclude<RedeemResult, { ok: true }>["error"], string> = {
  email_unverified: "Verify your email address first, then try the code again.",
  invalid: "That code doesn't exist or is no longer active.",
  expired: "That code has expired.",
  exhausted: "That code has been fully redeemed.",
  already_plus: "You're already on Plus.",
  trial_active: "You already have a trial running.",
  already_redeemed: "You've already used this code.",
};

/**
 * Redeem a promo code for a Plus trial (prd §8.3): verified email only, one
 * live trial, never on top of paid Plus, and atomic under concurrency (row
 * lock on the code + the redeemed_count ≤ max check constraint).
 */
export async function redeemPromoCode(options: {
  db: Database;
  userId: string;
  code: string;
  emailVerified: boolean;
  now: Date;
}): Promise<RedeemResult> {
  const { db, userId, now } = options;
  if (!options.emailVerified) return { ok: false, error: "email_unverified" };
  const code = normalizeCode(options.code);
  if (!code || code.length > 64) return { ok: false, error: "invalid" };

  return db.transaction(async (tx) => {
    const [promo] = await tx
      .select()
      .from(schema.promoCodes)
      .where(sql`lower(${schema.promoCodes.code}) = lower(${code})`)
      .for("update")
      .limit(1);
    if (!promo || !promo.active) return { ok: false, error: "invalid" } as const;
    if (promo.expiresAt && promo.expiresAt <= now) return { ok: false, error: "expired" } as const;
    if (promo.maxRedemptions !== null && promo.redeemedCount >= promo.maxRedemptions) return { ok: false, error: "exhausted" } as const;

    const subscriptions = await tx.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
    if (subscriptions.some((s) => subscriptionGrantsPlus(s, now))) return { ok: false, error: "already_plus" } as const;
    const redemptions = await tx.select().from(schema.promoRedemptions).where(eq(schema.promoRedemptions.userId, userId));
    if (redemptions.some((r) => r.codeId === promo.id)) return { ok: false, error: "already_redeemed" } as const;
    if (redemptions.some((r) => trialIsLive(r, now))) return { ok: false, error: "trial_active" } as const;

    const trialEndsAt = new Date(now.getTime() + promo.trialDays * 86_400_000);
    await tx.insert(schema.promoRedemptions).values({
      codeId: promo.id,
      userId,
      redeemedAt: now,
      trialEndsAt,
      episodeLimit: promo.trialEpisodeLimit,
    });
    await tx
      .update(schema.promoCodes)
      .set({ redeemedCount: sql`${schema.promoCodes.redeemedCount} + 1` })
      .where(eq(schema.promoCodes.id, promo.id));
    return { ok: true, trialEndsAt, episodeLimit: promo.trialEpisodeLimit } as const;
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

function trialEmail(kind: "3-days" | "ended", options: { endsAt: Date; upgradeUrl: string }) {
  const when = formatDate(options.endsAt);
  const subject = kind === "3-days" ? `Your Studio voice ends on ${when}` : "Your Studio voice trial has ended";
  const lead =
    kind === "3-days"
      ? `Your Unread trial of Studio voices ends on ${when}. After that, episodes switch back to the free voice automatically; nothing you've forwarded is lost.`
      : "Your Unread trial of Studio voices has ended. Your episodes are back on the free voice, and anything you forwarded during the trial is still queued for your next episode.";
  const text = `${lead}\n\nKeep the Studio voice: ${options.upgradeUrl}\n\nUnread`;
  const html = `<p>${lead}</p><p><a href="${options.upgradeUrl}">Keep the Studio voice</a></p><p>Unread</p>`;
  return { subject, text, html };
}

/**
 * Hourly (prd §8.3): end trials by date, end trials on upgrade, and email
 * 3 days before and on the day a trial ends. Reminders are sent once each.
 */
export async function runTrialLifecycle(options: {
  db: Database;
  config: CoreConfig;
  now: Date;
  mailer?: Mailer;
}): Promise<{ ended: number; reminded: number }> {
  const { db, config, now } = options;
  const mailer = options.mailer ?? mailerFromConfig(config);
  const upgradeUrl = `${config.env.APP_BASE_URL}/settings#plan`;
  const rows = await db
    .select({ redemption: schema.promoRedemptions, email: schema.users.email })
    .from(schema.promoRedemptions)
    .innerJoin(schema.users, eq(schema.users.id, schema.promoRedemptions.userId))
    .where(gt(schema.promoRedemptions.redeemedAt, new Date(now.getTime() - 120 * 86_400_000)));

  let ended = 0;
  let reminded = 0;
  for (const { redemption, email } of rows) {
    const sent = new Set(redemption.remindersSent);
    const markSent = async (kind: string) => {
      sent.add(kind);
      await db
        .update(schema.promoRedemptions)
        .set({ remindersSent: [...sent] })
        .where(eq(schema.promoRedemptions.id, redemption.id));
    };

    if (!redemption.endedAt) {
      const subscriptions = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, redemption.userId));
      const reason = subscriptions.some((s) => subscriptionGrantsPlus(s, now))
        ? ("upgraded" as const)
        : redemption.trialEndsAt <= now
          ? ("expired" as const)
          : null;
      if (reason) {
        await db
          .update(schema.promoRedemptions)
          .set({ endedAt: now, endedReason: reason })
          .where(and(eq(schema.promoRedemptions.id, redemption.id), isNull(schema.promoRedemptions.endedAt)));
        redemption.endedAt = now;
        redemption.endedReason = reason;
        ended++;
      }
    }

    if (!email) continue;
    const live = !redemption.endedAt;
    const msLeft = redemption.trialEndsAt.getTime() - now.getTime();
    if (live && msLeft <= 3 * 86_400_000 && !sent.has("3-days")) {
      await mailer.send({ to: email, ...trialEmail("3-days", { endsAt: redemption.trialEndsAt, upgradeUrl }) });
      await markSent("3-days");
      reminded++;
    }
    if (redemption.endedAt && redemption.endedReason !== "upgraded" && !sent.has("ended")) {
      await mailer.send({ to: email, ...trialEmail("ended", { endsAt: redemption.endedAt, upgradeUrl }) });
      await markSent("ended");
      reminded++;
    }
  }
  return { ended, reminded };
}

import type { Plan, PromoRedemption, Subscription, VoiceProvider } from "@unread/db";

/** prd §8 */
export const CHARS_PER_MINUTE = 900;
export const FREE_MAX_MINUTES = 10;
export const FREE_EPISODES_PER_MONTH = 4;
export const PLUS_MONTHLY_CHARACTERS = 350_000;
export const TRIAL_MAX_MINUTES = 10;

export type PlanSource = "paid" | "trial" | "free";

export interface EffectivePlan {
  plan: Plan;
  source: PlanSource;
  voiceProvider: VoiceProvider;
  /** Present while a promo trial is the reason for Plus. */
  trial: { redemptionId: string; endsAt: Date; episodesLeft: number; episodeLimit: number } | null;
}

/**
 * Bachs keeps a subscription `active` until the paid period ends, even when
 * cancelled at period end; `past_due` keeps access while Bachs retries.
 */
export function subscriptionGrantsPlus(subscription: Subscription | null | undefined, now: Date): boolean {
  if (!subscription) return false;
  switch (subscription.status) {
    case "active":
    case "trialing":
    case "past_due":
      return true;
    case "cancelled":
      return Boolean(subscription.currentPeriodEnd && subscription.currentPeriodEnd > now);
    case "expired":
      return false;
  }
}

export function trialIsLive(redemption: PromoRedemption | null | undefined, now: Date): boolean {
  return Boolean(
    redemption && !redemption.endedAt && redemption.trialEndsAt > now && redemption.episodesUsed < redemption.episodeLimit,
  );
}

/**
 * The one place that decides what a user gets (prd §8.3): paid Plus (Bachs)
 * OR an unexpired promo trial with episodes left OR Free.
 */
export function effectivePlan(input: {
  subscriptions: Subscription[];
  redemptions: PromoRedemption[];
  now: Date;
}): EffectivePlan {
  const { now } = input;
  if (input.subscriptions.some((s) => subscriptionGrantsPlus(s, now))) {
    return { plan: "plus", source: "paid", voiceProvider: "elevenlabs", trial: null };
  }
  const live = input.redemptions.find((r) => trialIsLive(r, now));
  if (live) {
    return {
      plan: "plus",
      source: "trial",
      voiceProvider: "elevenlabs",
      trial: {
        redemptionId: live.id,
        endsAt: live.trialEndsAt,
        episodesLeft: live.episodeLimit - live.episodesUsed,
        episodeLimit: live.episodeLimit,
      },
    };
  }
  return { plan: "free", source: "free", voiceProvider: "kokoro", trial: null };
}

export interface EpisodeBudget {
  /** Spoken characters for the whole script, intro and outro included. */
  maxChars: number;
  minutes: number;
  voiceProvider: VoiceProvider;
  /** Why an episode can't be made at all this time, if so. */
  blocked: string | null;
}

/**
 * Character budget for one episode (prd §8): Free ≤ 10 min and 4 episodes a
 * month; trial ≤ 10 min; Plus by length, shortened to fit the monthly cap.
 */
export function episodeBudget(input: {
  plan: EffectivePlan;
  episodeMinutes: number;
  charactersUsedThisMonth: number;
  episodesMadeThisMonth: number;
}): EpisodeBudget {
  const { plan } = input;
  if (plan.source === "free") {
    const minutes = Math.min(input.episodeMinutes, FREE_MAX_MINUTES);
    return {
      minutes,
      maxChars: minutes * CHARS_PER_MINUTE,
      voiceProvider: "kokoro",
      blocked:
        input.episodesMadeThisMonth >= FREE_EPISODES_PER_MONTH
          ? `Free includes ${FREE_EPISODES_PER_MONTH} episodes a month`
          : null,
    };
  }
  if (plan.source === "trial") {
    const minutes = Math.min(input.episodeMinutes, TRIAL_MAX_MINUTES);
    return { minutes, maxChars: minutes * CHARS_PER_MINUTE, voiceProvider: "elevenlabs", blocked: null };
  }
  const remaining = PLUS_MONTHLY_CHARACTERS - input.charactersUsedThisMonth;
  const maxChars = Math.max(0, Math.min(input.episodeMinutes * CHARS_PER_MINUTE, remaining));
  return {
    minutes: Math.round(maxChars / CHARS_PER_MINUTE),
    maxChars,
    voiceProvider: "elevenlabs",
    blocked: maxChars < 2 * CHARS_PER_MINUTE ? "You've used this month's Studio voice characters" : null,
  };
}

/** First day of `date`'s month in UTC, as stored in usage_monthly. */
export function usageMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export { loadPlanContext, type PlanContext } from "./context";

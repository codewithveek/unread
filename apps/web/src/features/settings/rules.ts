import type { EffectivePlan } from "@unread/core/plans";
import { KOKORO_FREE_VOICES } from "@unread/core/voice/voices";
import { z } from "zod";

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const episodePrefsSchema = z.object({
  episodeMinutes: z.coerce.number().pipe(z.union([z.literal(5), z.literal(10), z.literal(20)])),
  deliveryTime: z.string().regex(TIME_PATTERN, "Pick a time"),
  timezone: z.string().min(1).max(64).refine(isValidTimeZone, "Unknown timezone"),
  cadence: z.enum(["daily", "weekly"]),
  weeklyDay: z.coerce.number().int().min(0).max(6),
});

export type EpisodePrefs = z.infer<typeof episodePrefsSchema>;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Server-side plan limits (prd §8, §10): Free is weekly, ≤ 10 minutes, Kokoro voices only. */
export function applyPlanLimits(prefs: EpisodePrefs, plan: EffectivePlan): EpisodePrefs {
  if (plan.plan === "plus") return prefs;
  return { ...prefs, cadence: "weekly", episodeMinutes: Math.min(prefs.episodeMinutes, 10) as 5 | 10 };
}

export function isFreeVoice(id: string): boolean {
  return KOKORO_FREE_VOICES.some((v) => v.id === id);
}

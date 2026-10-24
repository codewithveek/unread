"use server";

import { newFeedToken, newInboundAlias, schema } from "@unread/db";
import { RateLimitedError, requestEpisodeNow } from "@unread/core/episodes/requests";
import { REDEEM_ERRORS, redeemPromoCode } from "@unread/core/promo";
import { storageKeys } from "@unread/core/storage";
import { rateLimit } from "@unread/core/util/rate-limit";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/features/action-state";
import { startEpisodeWorkflow } from "@/features/episodes/start-episode";
import { requireUser } from "@/features/users/current-user";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { planContextFor } from "./plan-context";
import { applyPlanLimits, episodePrefsSchema, isFreeVoice } from "./rules";
import { isStudioVoice } from "./studio-voices";

export async function updateEpisodePrefsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const parsed = episodePrefsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your settings." };
  const { plan } = await planContextFor(user.id);
  await db().update(schema.users).set(applyPlanLimits(parsed.data, plan)).where(eq(schema.users.id, user.id));
  revalidatePath("/settings");
  revalidatePath("/today");
  return { ok: true, message: "Saved." };
}

export async function updateVoiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const kokoro = String(formData.get("kokoroVoiceId") ?? "");
  const eleven = String(formData.get("elevenlabsVoiceId") ?? "");
  const quality = formData.get("voiceQuality");
  const { plan } = await planContextFor(user.id);
  const update: Partial<typeof schema.users.$inferInsert> = {};
  if (kokoro) {
    if (!isFreeVoice(kokoro)) return { error: "Unknown voice." };
    update.kokoroVoiceId = kokoro;
  }
  if (eleven) {
    if (plan.plan !== "plus") return { error: "Studio voices come with Plus." };
    if (!/^[A-Za-z0-9]{10,40}$/.test(eleven) || !(await isStudioVoice(eleven))) return { error: "Unknown voice." };
    update.elevenlabsVoiceId = eleven;
  }
  if (quality === "flash" || quality === "studio") {
    // Studio quality is for paid Plus; trials stay on the standard model.
    update.voiceQuality = quality === "studio" && plan.source !== "paid" ? "flash" : quality;
  }
  await db().update(schema.users).set(update).where(eq(schema.users.id, user.id));
  revalidatePath("/settings");
  return { ok: true, message: "Voice saved." };
}

/** prd §9: rotate the feed URL; old URLs (feed and audio) stop working at once. */
export async function rotateFeedAction(): Promise<void> {
  const { user } = await requireUser();
  await db().update(schema.users).set({ feedToken: newFeedToken() }).where(eq(schema.users.id, user.id));
  revalidatePath("/sources");
  revalidatePath("/settings");
}

export async function rotateAliasAction(): Promise<void> {
  const { user } = await requireUser();
  await db().update(schema.users).set({ inboundAlias: newInboundAlias() }).where(eq(schema.users.id, user.id));
  revalidatePath("/sources");
  revalidatePath("/settings");
}

export async function redeemPromoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, sessionUser } = await requireUser();
  if (!(await rateLimit({ db: db(), key: `promo:${user.id}`, limit: 5, windowSeconds: 3600 }))) {
    return { error: "Too many tries. Wait an hour and try again." };
  }
  const result = await redeemPromoCode({
    db: db(),
    userId: user.id,
    code: String(formData.get("code") ?? ""),
    emailVerified: sessionUser.email_verified === true,
    now: new Date(),
  });
  if (!result.ok) return { error: REDEEM_ERRORS[result.error] };
  revalidatePath("/settings");
  revalidatePath("/today");
  const ends = result.trialEndsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  return { ok: true, message: `Studio voice unlocked: ${result.episodeLimit} episodes, until ${ends}.` };
}

/** "Make one now" (prd §6), rate-limited by plan. */
export async function makeEpisodeNowAction(_prev: ActionState): Promise<ActionState> {
  const { user } = await requireUser();
  const { plan, budget } = await planContextFor(user.id);
  if (budget.blocked) return { error: budget.blocked };
  try {
    const requestId = await requestEpisodeNow({
      db: db(),
      userId: user.id,
      timezone: user.timezone,
      now: new Date(),
      dailyLimit: plan.plan === "plus" ? 3 : 1,
    });
    await startEpisodeWorkflow(requestId);
  } catch (error) {
    if (error instanceof RateLimitedError) return { error: error.message };
    throw error;
  }
  revalidatePath("/today");
  return { ok: true, message: "Making your episode. It takes a few minutes." };
}

/** prd §9: removes every row, the audio and covers, then signs out. */
export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return { error: 'Type DELETE to confirm.' };
  }
  await storage().deletePrefix(storageKeys.userPrefix(user.id));
  await db().delete(schema.listeningEvents).where(eq(schema.listeningEvents.userId, user.id));
  await db().delete(schema.users).where(eq(schema.users.id, user.id));
  redirect("/auth/logout" as Parameters<typeof redirect>[0]);
}

"use server";

import { schema } from "@unread/db";
import { requestEpisodeNow } from "@unread/core/episodes/requests";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { ActionState } from "@/features/action-state";
import { startEpisodeWorkflow } from "@/features/episodes/start-episode";
import { planContextFor } from "@/features/settings/plan-context";
import { applyPlanLimits, episodePrefsSchema, isFreeVoice } from "@/features/settings/rules";
import { requireUser } from "@/features/users/current-user";
import { db } from "@/lib/db";

/** Step 3 → "Make my first episode": save preferences, finish onboarding, start an episode. */
export async function finishOnboardingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const parsed = episodePrefsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your choices." };
  const voice = String(formData.get("kokoroVoiceId") ?? "af_heart");
  const { plan } = await planContextFor(user.id);
  await db()
    .update(schema.users)
    .set({
      ...applyPlanLimits(parsed.data, plan),
      kokoroVoiceId: isFreeVoice(voice) ? voice : "af_heart",
      onboardedAt: user.onboardedAt ?? new Date(),
    })
    .where(eq(schema.users.id, user.id));

  if (formData.get("makeNow") === "yes") {
    const requestId = await requestEpisodeNow({ db: db(), userId: user.id, timezone: parsed.data.timezone, now: new Date(), dailyLimit: 2 });
    await startEpisodeWorkflow(requestId);
  }
  redirect("/today");
}

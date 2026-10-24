"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/features/action-state";
import { EpisodePrefsFields, type EpisodePrefsFieldsProps } from "@/features/settings/episode-prefs-fields";
import { KokoroVoicePicker } from "@/features/settings/voice-picker";
import { finishOnboardingAction } from "./actions";

/** Step 3: length, delivery time, voice → "Make my first episode" (prd §9). */
export function FinishForm({ prefs, voice, canMakeNow }: { prefs: EpisodePrefsFieldsProps; voice: string; canMakeNow: boolean }) {
  const [state, action, pending] = useActionState(finishOnboardingAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-6">
      <EpisodePrefsFields {...prefs} detectTimezone />
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-text-2">Voice</span>
        <KokoroVoicePicker defaultValue={voice} />
        {!prefs.isPlus ? <p className="m-0 text-[13px] text-muted-foreground">Studio voices come with Plus or a promo code.</p> : null}
      </div>
      <div className="flex flex-col gap-2">
        {canMakeNow ? (
          <Button type="submit" name="makeNow" value="yes" size="lg" disabled={pending}>
            {pending ? "Starting…" : "Make my first episode"}
          </Button>
        ) : null}
        <Button type="submit" name="makeNow" value="no" size="lg" variant={canMakeNow ? "secondary" : "default"} disabled={pending}>
          {canMakeNow ? "Finish, I'll wait for the schedule" : "Finish setup"}
        </Button>
        {!canMakeNow ? (
          <p className="m-0 text-[13px] text-muted-foreground">Your first episode is made as soon as two or more stories have arrived.</p>
        ) : null}
        <p role="status" className="m-0 min-h-5 text-sm text-destructive">
          {state.error ?? ""}
        </p>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/features/action-state";
import { deleteAccountAction, redeemPromoAction, updateEpisodePrefsAction, updateVoiceAction } from "./actions";
import { EpisodePrefsFields, type EpisodePrefsFieldsProps } from "./episode-prefs-fields";
import { KokoroVoicePicker } from "./voice-picker";

function Status({ error, message }: { error?: string; message?: string }) {
  return (
    <p role="status" className={`m-0 min-h-5 text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}>
      {error ?? message ?? ""}
    </p>
  );
}

export function EpisodePrefsForm(props: EpisodePrefsFieldsProps) {
  const [state, action, pending] = useActionState(updateEpisodePrefsAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <EpisodePrefsFields {...props} />
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        Save
      </Button>
      <Status {...state} />
    </form>
  );
}

export function VoiceForm({ kokoroVoiceId }: { kokoroVoiceId: string }) {
  const [state, action, pending] = useActionState(updateVoiceAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <KokoroVoicePicker defaultValue={kokoroVoiceId} />
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        Save voice
      </Button>
      <Status {...state} />
    </form>
  );
}

export function PromoForm() {
  const [state, action, pending] = useActionState(redeemPromoAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-line bg-ground px-3">
          <span className="sr-only">Promo code</span>
          <input name="code" required maxLength={64} autoCapitalize="characters" placeholder="Promo code" className="min-w-0 flex-1 bg-transparent font-mono text-sm text-foreground uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground" />
        </label>
        <Button type="submit" variant="secondary" disabled={pending} className="rounded-xl">
          Redeem
        </Button>
      </div>
      <Status {...state} />
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccountAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <p className="m-0 text-sm text-muted-foreground">
        Deletes your episodes, audio, covers, newsletters, links and settings. This can't be undone.
      </p>
      <div className="flex gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-line bg-ground px-3">
          <span className="sr-only">Type DELETE to confirm</span>
          <input name="confirm" placeholder="Type DELETE to confirm" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </label>
        <Button type="submit" variant="secondary" disabled={pending} className="rounded-xl border-destructive text-destructive hover:text-destructive">
          Delete
        </Button>
      </div>
      <Status error={state.error} />
    </form>
  );
}

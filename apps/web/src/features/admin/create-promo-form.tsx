"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/features/action-state";
import { createPromoAction } from "./actions";

const field = "h-11 rounded-lg border border-line bg-ground px-3 text-sm text-foreground";

export function CreatePromoForm() {
  const [state, action, pending] = useActionState(createPromoAction, initialActionState);
  return (
    <form action={action} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <input name="code" required placeholder="CODE" aria-label="Code" className={`${field} font-mono uppercase`} />
      <input name="trialDays" type="number" min={1} max={90} defaultValue={14} aria-label="Trial days" className={field} />
      <input name="trialEpisodeLimit" type="number" min={1} max={30} defaultValue={3} aria-label="Studio episodes" className={field} />
      <input name="maxRedemptions" type="number" min={1} placeholder="Max uses (blank = ∞)" aria-label="Max redemptions" className={field} />
      <input name="expiresAt" type="date" aria-label="Expires" className={`${field} [color-scheme:dark]`} />
      <input name="note" placeholder="Note" aria-label="Note" className={field} />
      <Button type="submit" disabled={pending} className="col-span-2 sm:col-span-1">
        Create code
      </Button>
      <p role="status" className="col-span-2 m-0 self-center text-sm text-muted-foreground">
        {state.error ?? state.message ?? ""}
      </p>
    </form>
  );
}

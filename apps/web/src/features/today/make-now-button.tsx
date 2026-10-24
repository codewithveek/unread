"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/features/action-state";
import { makeEpisodeNowAction } from "@/features/settings/actions";

export function MakeNowButton({ label = "Make one now", variant = "default" }: { label?: string; variant?: "default" | "secondary" }) {
  const [state, action, pending] = useActionState(makeEpisodeNowAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" size="lg" variant={variant} disabled={pending} className="self-start">
        {pending ? "Starting…" : label}
      </Button>
      <p role="status" className="m-0 min-h-5 text-sm text-muted-foreground">
        {state.error ?? state.message ?? ""}
      </p>
    </form>
  );
}

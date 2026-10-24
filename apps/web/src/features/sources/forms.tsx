"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/features/action-state";
import { addLinkAction, addSenderAction, setPriorityAction } from "./actions";

export function AddLinkForm() {
  const [state, action, pending] = useActionState(addLinkAction, initialActionState);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      action={async (data) => {
        await action(data);
        form.current?.reset();
      }}
      className="flex flex-col gap-1.5"
    >
      <div className="flex gap-2">
        <label className="flex h-12 min-w-0 flex-1 items-center rounded-xl border border-line bg-surface px-3">
          <span className="sr-only">Paste a link</span>
          <input type="url" name="url" required placeholder="Paste a link" className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground" />
        </label>
        <Button type="submit" disabled={pending} className="h-12 rounded-xl px-4 font-semibold">
          Add
        </Button>
      </div>
      <p role="status" className="m-0 min-h-5 text-[13px] text-muted-foreground">
        {state.error ?? state.message ?? ""}
      </p>
    </form>
  );
}

export function AddSenderForm() {
  const [state, action, pending] = useActionState(addSenderAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-line bg-ground px-3">
          <span className="sr-only">Another address you forward from</span>
          <input type="email" name="email" required placeholder="Another address you forward from" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </label>
        <Button type="submit" variant="secondary" disabled={pending} className="rounded-xl">
          Add
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="m-0 text-[13px] text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function PrioritySelect({ newsletterId, value, name }: { newsletterId: string; value: string; name: string }) {
  return (
    <form action={setPriorityAction}>
      <input type="hidden" name="newsletterId" value={newsletterId} />
      <label>
        <span className="sr-only">Priority for {name}</span>
        <select
          name="priority"
          defaultValue={value}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="h-11 rounded-lg border border-line bg-ground px-2 text-[13px] text-text-2"
        >
          <option value="always">Always first</option>
          <option value="normal">Normal</option>
          <option value="if_room">Only if room</option>
        </select>
      </label>
    </form>
  );
}

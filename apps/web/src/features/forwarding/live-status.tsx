"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";

interface Status {
  inbound: {
    newsletters: { name: string; at: string }[];
    confirmation: { code: string | null; url: string | null; at: string } | null;
    lastRejection: { reason: string; at: string } | null;
  };
}

const REJECTION_TEXT: Record<string, string> = {
  unverified_sender: "We got mail from an address that isn't on your list. Forward from your sign-in address, or add the other address in Sources.",
  auth_failed: "We got a message we couldn't verify (SPF/DKIM failed), so we dropped it.",
};

/** "Waiting for your first newsletter…" → "Got Morning Brew ✓", plus Gmail's code (prd §9). */
export function LiveStatus({ initial }: { initial: Status["inbound"] }) {
  const [status, setStatus] = useState(initial);
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (res.ok && !stopped) setStatus(((await res.json()) as Status).inbound);
      } catch {
        // offline: keep the last status
      }
    };
    const id = setInterval(tick, 4000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {status.confirmation ? (
        <div role="alert" className="flex flex-col gap-2 rounded-[14px] border border-brand bg-brand/10 p-4">
          <p className="m-0 text-sm font-semibold">Gmail sent a confirmation code</p>
          {status.confirmation.code ? (
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-medium tracking-[0.12em]">{status.confirmation.code}</span>
              <CopyButton value={status.confirmation.code} />
            </div>
          ) : null}
          {status.confirmation.url ? (
            <a href={status.confirmation.url} target="_blank" rel="noopener noreferrer" className="text-sm">
              Or open Gmail's confirm link
            </a>
          ) : null}
        </div>
      ) : null}
      <div aria-live="polite" className="flex items-center gap-3 rounded-[14px] border border-line bg-ground px-4 py-3">
        {status.newsletters.length ? (
          <>
            <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-brand text-on-brand">
              ✓
            </span>
            <span className="text-sm">Got {status.newsletters.map((n) => n.name).join(", ")}</span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-brand" />
            <span className="text-sm text-text-2">Waiting for your first newsletter…</span>
          </>
        )}
      </div>
      {status.lastRejection && REJECTION_TEXT[status.lastRejection.reason] ? (
        <p className="m-0 text-[13px] text-muted-foreground">{REJECTION_TEXT[status.lastRejection.reason]}</p>
      ) : null}
    </div>
  );
}

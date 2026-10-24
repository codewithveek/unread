"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const GUIDES = {
  Gmail: [
    "Settings → See all settings → Forwarding and POP/IMAP → Add a forwarding address, and paste your Unread address.",
    "Gmail sends a confirmation code to Unread. It appears on this page within a minute: copy it back into Gmail (or open the confirm link).",
    "Create a filter (e.g. From: the newsletters you want, or has the word \"unsubscribe\") → Forward it to your Unread address.",
  ],
  Outlook: [
    "Settings → Mail → Rules → Add new rule.",
    "Condition: From, and pick your newsletters (or \"Message includes: unsubscribe\").",
    "Action: Forward to → your Unread address. Save. Outlook doesn't send a confirmation code.",
  ],
  "Apple Mail": [
    "On a Mac: Mail → Settings → Rules → Add Rule.",
    "If any: From contains each newsletter's address.",
    "Perform: Forward Message to your Unread address. Rules run while Mail is open; or forward issues by hand from iPhone.",
  ],
} as const;

type App = keyof typeof GUIDES;

/** Step-by-step auto-forward guides, one tab per mail app (prd §4.1). */
export function ForwardingGuides() {
  const [app, setApp] = useState<App>("Gmail");
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Mail app" className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-ground p-1">
        {(Object.keys(GUIDES) as App[]).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`tab-${name}`}
            aria-selected={app === name}
            aria-controls={`panel-${name}`}
            onClick={() => setApp(name)}
            className={cn(
              "h-10 cursor-pointer rounded-lg text-sm font-medium",
              app === name ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {name}
          </button>
        ))}
      </div>
      <ol role="tabpanel" id={`panel-${app}`} aria-labelledby={`tab-${app}`} className="m-0 flex list-none flex-col gap-3 p-0">
        {GUIDES[app].map((step, i) => (
          <li key={step} className="flex gap-3 text-sm leading-[1.45] text-text-2">
            <span aria-hidden="true" className="flex size-6 flex-none items-center justify-center rounded-full border border-line font-mono text-[11px] text-muted-foreground">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="m-0 text-[13px] text-muted-foreground">Or just forward any issue by hand, from any app.</p>
    </div>
  );
}

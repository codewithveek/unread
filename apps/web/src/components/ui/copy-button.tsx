"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Copies `value`; announces the result to screen readers. */
export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className={cn("h-9 flex-none cursor-pointer rounded-[9px] bg-line px-3 text-[13px] font-medium text-foreground hover:bg-line/80", className)}
    >
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

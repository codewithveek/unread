import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The canvas "value in a well + action" row (feed URL, forwarding address). */
export function FieldRow({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-12 items-center gap-2 rounded-xl border border-line bg-ground pr-1.5 pl-3", className)}>
      <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-text-2">{children}</span>
      {action}
    </div>
  );
}

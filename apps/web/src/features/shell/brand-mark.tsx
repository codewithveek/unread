import { cn } from "@/lib/utils";

/** The "unread dot" and wordmark. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span aria-hidden="true" className="inline-block size-2.5 rounded-full bg-brand" />
      <span className="text-xl font-bold tracking-[-0.02em] text-foreground">Unread</span>
    </span>
  );
}

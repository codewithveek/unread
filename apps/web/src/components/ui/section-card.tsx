import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({ title, description, children, className, id }: { title: string; description?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} aria-label={title} className={cn("flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-base font-semibold">{title}</h2>
        {description ? <p className="m-0 text-[13px] leading-[1.45] text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

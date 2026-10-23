import type { ReactNode } from "react";

export interface PageHeadingProps {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}

export function PageHeading({ eyebrow, title, children }: PageHeadingProps) {
  return (
    <div className="flex flex-col gap-1">
      {eyebrow ? (
        <p className="m-0 font-mono text-[13px] font-medium tracking-[0.02em] text-muted-foreground">{eyebrow}</p>
      ) : null}
      <h1 className="m-0 text-[30px] leading-[1.1] font-bold tracking-[-0.03em]">{title}</h1>
      {children}
    </div>
  );
}

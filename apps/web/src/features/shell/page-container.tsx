import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Content width: full bleed on phones, 640 px on tablets, 1200 px on desktop. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[640px] px-6 pt-2 lg:max-w-[1200px] lg:px-10 lg:pt-10", className)}>
      {children}
    </div>
  );
}

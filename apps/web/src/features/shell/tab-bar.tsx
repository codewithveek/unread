"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav-items";

/** Bottom navigation below 1024 px. */
export function TabBar({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 border-t border-surface-2 bg-ground/95 px-3 pt-1.5 pb-[max(env(safe-area-inset-bottom),22px)] backdrop-blur",
        className,
      )}
    >
      <ul className="mx-auto grid max-w-[640px] grid-cols-3">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center gap-1 rounded-lg py-2 text-[11px] no-underline",
                  active
                    ? "font-semibold text-foreground hover:text-foreground"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

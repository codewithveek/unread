"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { isActive, NAV_ITEMS } from "./nav-items";

export interface SidebarNavProps {
  initials: string;
  email: string | undefined;
  className?: string;
}

/** Left navigation at 1024 px and up; replaces the tab bar. */
export function SidebarNav({ initials, email, className }: SidebarNavProps) {
  const pathname = usePathname();
  return (
    <aside
      className={cn(
        "sticky top-0 h-dvh w-60 flex-col border-r border-surface-2 bg-ground px-4 py-6",
        className,
      )}
    >
      <Link href="/today" className="mb-8 px-3 no-underline" aria-label="Unread, today">
        <BrandMark />
      </Link>
      <nav aria-label="Main" className="flex-1">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm no-underline",
                    active
                      ? "bg-surface font-semibold text-foreground hover:text-foreground"
                      : "font-medium text-muted-foreground hover:bg-surface hover:text-foreground",
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
      <div className="flex items-center gap-3 border-t border-surface-2 px-3 pt-4">
        <span
          aria-hidden="true"
          className="flex size-9 flex-none items-center justify-center rounded-full border border-line bg-surface text-xs font-semibold"
        >
          {initials}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm text-text-2">{email ?? "Signed in"}</span>
          {/* Plain <a>: auth routes must not be prefetched. */}
          <a href="/auth/logout" className="text-xs text-muted-foreground no-underline hover:text-foreground">
            Sign out
          </a>
        </div>
      </div>
    </aside>
  );
}

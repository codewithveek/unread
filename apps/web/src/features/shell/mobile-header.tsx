import Link from "next/link";
import { BrandMark } from "./brand-mark";

/** Top bar below 1024 px: wordmark and account button (canvas Home header). */
export function MobileHeader({ initials }: { initials: string }) {
  return (
    <header className="mx-auto flex w-full max-w-[640px] items-center justify-between px-6 pt-5 pb-2">
      <Link href="/today" className="no-underline" aria-label="Unread, today">
        <BrandMark />
      </Link>
      <Link
        href="/settings"
        aria-label="Account and settings"
        className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-sm font-semibold text-foreground no-underline hover:bg-surface-2 hover:text-foreground"
      >
        {initials}
      </Link>
    </header>
  );
}

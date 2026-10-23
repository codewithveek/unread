import type { ReactNode } from "react";
import { MobileHeader } from "./mobile-header";
import { SidebarNav } from "./sidebar-nav";
import { TabBar } from "./tab-bar";

export interface AppShellProps {
  initials: string;
  email: string | undefined;
  children: ReactNode;
}

/**
 * One tree for every width; CSS breakpoints switch between the phone/tablet
 * layout (header + bottom tab bar) and the desktop sidebar (prd §8).
 */
export function AppShell({ initials, email, children }: AppShellProps) {
  return (
    <div className="min-h-dvh lg:flex">
      <SidebarNav initials={initials} email={email} className="hidden lg:flex" />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <div className="lg:hidden">
          <MobileHeader initials={initials} />
        </div>
        <main id="main" className="flex-1 pb-28 lg:pb-10">
          {children}
        </main>
        <TabBar className="lg:hidden" />
      </div>
    </div>
  );
}

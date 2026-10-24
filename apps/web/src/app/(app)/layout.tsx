import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/features/shell/app-shell";
import { requireUser } from "@/features/users/current-user";
import { initialsFor } from "@/features/users/initials";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const { user, sessionUser } = await requireUser();
  const email = user.email ?? sessionUser.email;
  return (
    <AppShell initials={initialsFor(sessionUser.name, email)} email={email}>
      {children}
    </AppShell>
  );
}

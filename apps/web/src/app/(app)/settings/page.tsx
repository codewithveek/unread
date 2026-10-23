import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/features/shell/page-container";
import { PageHeading } from "@/features/shell/page-heading";
import { requireUser } from "@/features/users/current-user";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, sessionUser } = await requireUser();
  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeading eyebrow="SETTINGS" title="Your account" />
      <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 rounded-[20px] border border-line bg-surface p-5 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="m-0 truncate">{user.email ?? sessionUser.email ?? "Not shared"}</dd>
        <dt className="text-muted-foreground">Episode length</dt>
        <dd className="m-0">{user.episodeMinutes} min</dd>
        <dt className="text-muted-foreground">Delivery</dt>
        <dd className="m-0">
          {user.deliveryTime} ({user.timezone})
        </dd>
        <dt className="text-muted-foreground">News edition</dt>
        <dd className="m-0">{user.country}</dd>
      </dl>
      <Button asChild variant="secondary" className="self-start">
        {/* Plain <a>: auth routes must not be prefetched. */}
        <a href="/auth/logout">Sign out</a>
      </Button>
    </PageContainer>
  );
}

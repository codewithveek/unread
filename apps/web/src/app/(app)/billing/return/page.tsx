import type { Metadata } from "next";
import Link from "next/link";
import { planContextFor } from "@/features/settings/plan-context";
import { PageContainer } from "@/features/shell/page-container";
import { PageHeading } from "@/features/shell/page-heading";
import { AutoRefresh } from "@/features/today/auto-refresh";
import { requireUser } from "@/features/users/current-user";

export const metadata: Metadata = { title: "Activating Plus" };

/** Never grants access itself: it waits for the webhook to land (prd §8.2). */
export default async function BillingReturnPage() {
  const { user } = await requireUser("/billing/return");
  const { plan } = await planContextFor(user.id);
  const active = plan.source === "paid";
  return (
    <PageContainer className="flex flex-col gap-4">
      {active ? null : <AutoRefresh everyMs={3000} />}
      <PageHeading eyebrow="PLUS" title={active ? "You're on Plus" : "Activating your plan…"} />
      <p className="m-0 text-[15px] text-muted-foreground">
        {active
          ? "Studio voices, daily episodes and up to 20 minutes are on. Pick your voice in Settings."
          : "Payment received by Bachs; we're waiting for their confirmation. This usually takes a few seconds."}
      </p>
      <Link href="/settings" className="text-sm">
        Go to Settings
      </Link>
    </PageContainer>
  );
}

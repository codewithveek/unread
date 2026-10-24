import type { Metadata } from "next";
import { PageContainer } from "@/features/shell/page-container";
import { PageHeading } from "@/features/shell/page-heading";
import { requireUser } from "@/features/users/current-user";
import { forwardingAddress } from "@/features/users/forwarding-address";

export const metadata: Metadata = { title: "Sources" };

export default async function SourcesPage() {
  const { user } = await requireUser("/sources");
  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeading eyebrow="SOURCES" title="Forward your newsletters here" />
      <section aria-labelledby="forwarding" className="flex flex-col gap-2">
        <h2 id="forwarding" className="m-0 text-[15px] font-semibold">
          Your forwarding address
        </h2>
        <p className="m-0 truncate rounded-xl border border-line bg-surface px-3.5 py-3 font-mono text-[13px] text-text-2">
          {forwardingAddress(user.inboundAlias)}
        </p>
        <p className="m-0 text-sm leading-[1.45] text-muted-foreground">
          Forward an issue by hand, or set an auto-forward rule in your mail app. Only mail from your own address is
          accepted.
        </p>
      </section>
      <section aria-labelledby="newsletters" className="flex flex-col gap-2">
        <h2 id="newsletters" className="m-0 text-[15px] font-semibold">
          Newsletters
        </h2>
        <p className="m-0 text-sm leading-[1.45] text-muted-foreground">
          Every newsletter you forward shows up here, with a switch to include it and a priority.
        </p>
      </section>
    </PageContainer>
  );
}

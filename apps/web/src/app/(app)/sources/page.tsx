import type { Metadata } from "next";
import { PageContainer } from "@/features/shell/page-container";
import { PageHeading } from "@/features/shell/page-heading";

export const metadata: Metadata = { title: "Sources" };

export default function SourcesPage() {
  return (
    <PageContainer className="flex flex-col gap-3">
      <PageHeading eyebrow="SOURCES" title="Everything you saved" />
      <p className="m-0 text-[15px] leading-[1.45] text-muted-foreground">
        Your private feed link, pasted links, the forwarding address and saved items will live here.
      </p>
    </PageContainer>
  );
}

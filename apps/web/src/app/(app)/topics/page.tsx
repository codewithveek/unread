import type { Metadata } from "next";
import { PageContainer } from "@/features/shell/page-container";
import { PageHeading } from "@/features/shell/page-heading";

export const metadata: Metadata = { title: "Topics" };

export default function TopicsPage() {
  return (
    <PageContainer className="flex flex-col gap-3">
      <PageHeading eyebrow="TOPICS" title="What should we catch you up on?" />
      <p className="m-0 text-[15px] leading-[1.45] text-muted-foreground">
        Search any topic, team or place, and pick a few. Topic picking arrives with onboarding.
      </p>
    </PageContainer>
  );
}

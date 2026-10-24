import type { Metadata } from "next";
import { PageContainer } from "@/features/shell/page-container";
import { PageHeading } from "@/features/shell/page-heading";
import { ChapterListEmpty } from "@/features/today/chapter-list-empty";
import { DetailPanelEmpty } from "@/features/today/detail-panel-empty";
import { EmptyEpisodeCard } from "@/features/today/empty-episode-card";
import { episodeDateParts } from "@/features/today/format-date";
import { deliveryScheduleText } from "@/features/today/schedule";
import { requireUser } from "@/features/users/current-user";
import { forwardingAddress } from "@/features/users/forwarding-address";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const { user } = await requireUser();
  const date = episodeDateParts(new Date(), user.timezone);

  return (
    <PageContainer>
      <PageHeading eyebrow={date.eyebrow} title="Your morning brief" />
      <div className="mt-5 flex flex-col gap-5 lg:grid lg:grid-cols-[520px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-5">
          <EmptyEpisodeCard
            seed={`${user.id}:${date.isoDate}`}
            date={date}
            schedule={deliveryScheduleText(user)}
            forwardingAddress={forwardingAddress(user.inboundAlias)}
          />
          <ChapterListEmpty />
        </div>
        <div className="hidden lg:sticky lg:top-10 lg:block">
          <DetailPanelEmpty />
        </div>
      </div>
    </PageContainer>
  );
}

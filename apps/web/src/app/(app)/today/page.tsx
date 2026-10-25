import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadHome, recentEpisodes } from "@/features/episodes/queries";
import { planContextFor } from "@/features/settings/plan-context";
import { PageContainer } from "@/features/shell/page-container";
import { PageHeading } from "@/features/shell/page-heading";
import { AutoRefresh } from "@/features/today/auto-refresh";
import { ChapterList } from "@/features/today/chapter-list";
import { ChapterListEmpty } from "@/features/today/chapter-list-empty";
import { DetailPanelEmpty } from "@/features/today/detail-panel-empty";
import { EmptyEpisodeCard } from "@/features/today/empty-episode-card";
import { EpisodeCard } from "@/features/today/episode-card";
import { EpisodeHistory } from "@/features/today/episode-history";
import { FailureBanner } from "@/features/today/failure-banner";
import { episodeDateParts } from "@/features/today/format-date";
import { InProgressCard } from "@/features/today/in-progress-card";
import { MakeNowButton } from "@/features/today/make-now-button";
import { deliveryScheduleText } from "@/features/today/schedule";
import { TranscriptPanel } from "@/features/today/transcript-panel";
import { requireUser } from "@/features/users/current-user";
import { forwardingAddress } from "@/features/users/forwarding-address";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const { user } = await requireUser();
  if (!user.onboardedAt) redirect("/onboarding");
  const now = new Date();
  const date = episodeDateParts(now, user.timezone);
  const [home, ctx] = await Promise.all([loadHome(user.id, user.feedToken), planContextFor(user.id)]);
  const seed = `${user.id}:${date.isoDate}`;
  const latest = home.latest;
  // While a new one is being made the latest card is hidden, so it belongs in the list.
  const shownId = latest && !home.inProgress ? latest.id : undefined;
  const earlier = latest ? await recentEpisodes({ userId: user.id, feedToken: user.feedToken, limit: 7, excludeId: shownId }) : [];
  const historyDate = new Intl.DateTimeFormat("en-GB", { timeZone: user.timezone, weekday: "short", day: "numeric", month: "short" });

  const trialNote = ctx.plan.trial
    ? `Trial: ${ctx.plan.trial.episodesLeft} of ${ctx.plan.trial.episodeLimit} Studio episodes left`
    : null;
  const madeAt = latest
    ? new Intl.DateTimeFormat("en-GB", { timeZone: user.timezone, hour: "numeric", minute: "2-digit" }).format(new Date(latest.createdAt))
    : "";
  const sourceCount = latest ? new Set(latest.transcript.chapters.flatMap((c) => c.sources.map((s) => s.itemId))).size : 0;

  return (
    <PageContainer>
      {home.inProgress ? <AutoRefresh /> : null}
      <PageHeading eyebrow={date.eyebrow} title="Your morning brief" />
      <div className="mt-5 flex flex-col gap-5 lg:grid lg:grid-cols-[520px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-5">
          {home.notice ? <FailureBanner notice={home.notice} /> : null}
          {home.inProgress ? (
            <InProgressCard seed={seed} date={date} progress={home.inProgress} now={now.getTime()} />
          ) : latest ? (
            <EpisodeCard
              episode={latest}
              madeAt={madeAt}
              sourceCount={sourceCount}
              trialNote={trialNote}
              cover={{ seed: `${user.id}:${latest.id}`, ...episodeDateParts(new Date(latest.createdAt), user.timezone) }}
            />
          ) : (
            <>
              <EmptyEpisodeCard
                seed={seed}
                date={date}
                schedule={deliveryScheduleText(user)}
                forwardingAddress={forwardingAddress(user.inboundAlias)}
              />
              {home.queuedItems >= 2 ? <MakeNowButton label="Make my first episode" /> : null}
            </>
          )}
          {latest && !home.inProgress ? <ChapterList episode={latest} /> : <ChapterListEmpty />}
          <EpisodeHistory entries={earlier.map((episode) => ({ episode, dateLabel: historyDate.format(new Date(episode.createdAt)) }))} />
        </div>
        <div className="hidden lg:sticky lg:top-10 lg:block">
          {latest && !home.inProgress ? <TranscriptPanel episode={latest} /> : <DetailPanelEmpty />}
        </div>
      </div>
    </PageContainer>
  );
}

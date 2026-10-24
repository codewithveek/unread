"use client";

import type { PlayerEpisode } from "@/features/episodes/queries";
import { usePlayer } from "@/features/player/player-context";
import { TranscriptView } from "@/features/player/transcript-view";
import { DetailPanelEmpty } from "./detail-panel-empty";

/** Desktop right column: transcript + sources for the focused (or playing) chapter. */
export function TranscriptPanel({ episode }: { episode: PlayerEpisode }) {
  const player = usePlayer();
  const isCurrent = player.episode?.id === episode.id;
  const index = player.focusedChapter ?? (isCurrent ? player.chapterIndex : null);
  const chapter = index !== null ? episode.transcript.chapters[index] : undefined;
  if (index === null || !chapter) return <DetailPanelEmpty />;
  return (
    <section aria-label="Transcript and sources" className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface/40 p-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">{chapter.origin}</span>
        <h2 className="m-0 text-2xl leading-tight font-bold tracking-[-0.02em]">{chapter.title}</h2>
      </div>
      {isCurrent ? (
        <TranscriptView chapterIndex={index} />
      ) : (
        <button
          type="button"
          onClick={() => player.load(episode, { autoplay: true, startAt: chapter.startS })}
          className="self-start cursor-pointer text-sm text-link hover:text-link-hover"
        >
          Play from here
        </button>
      )}
    </section>
  );
}

"use client";

import type { PlayerEpisode } from "@/features/episodes/queries";
import { clock } from "@/features/player/format";
import { PlayIcon } from "@/features/player/icons";
import { usePlayer } from "@/features/player/player-context";
import { cn } from "@/lib/utils";

/**
 * "In this episode" (canvas screen 2). Phone: tap plays from that chapter and
 * opens Now playing. Desktop: tap shows its transcript and sources on the right.
 */
export function ChapterList({ episode }: { episode: PlayerEpisode }) {
  const player = usePlayer();
  const isCurrent = player.episode?.id === episode.id;

  const open = (index: number) => {
    const chapter = episode.transcript.chapters[index];
    if (!chapter) return;
    player.focusChapter(index);
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    player.load(episode, { autoplay: true, startAt: chapter.startS });
    player.setExpanded(true);
  };

  /** Desktop: rows open the transcript, so playing a chapter gets its own button. */
  const playFrom = (index: number) => {
    const chapter = episode.transcript.chapters[index];
    if (!chapter) return;
    player.focusChapter(index);
    player.load(episode, { autoplay: true, startAt: chapter.startS });
  };

  return (
    <section aria-labelledby="in-this-episode" className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <h2 id="in-this-episode" className="m-0 text-[15px] font-semibold">
          In this episode
        </h2>
        <button
          type="button"
          onClick={() => open(isCurrent ? (player.chapterIndex ?? 0) : 0)}
          className="cursor-pointer text-[13px] text-link hover:text-link-hover lg:hidden"
        >
          Transcript
        </button>
      </div>
      <ol className="m-0 list-none p-0">
        {episode.transcript.chapters.map((chapter, index) => {
          const playing = isCurrent && player.chapterIndex === index;
          const focused = player.focusedChapter === index;
          return (
            <li key={`${index}-${chapter.startS}`} className="flex items-start">
              <button
                type="button"
                onClick={() => open(index)}
                aria-current={playing ? "true" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 cursor-pointer items-start gap-3 border-b border-surface-2 py-3 text-left lg:rounded-lg lg:px-2",
                  focused && "lg:bg-surface",
                )}
              >
                <span className="w-[34px] flex-none pt-[3px] font-mono text-xs font-medium text-muted-foreground">{clock(chapter.startS)}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[15px] leading-[1.3] font-medium">{chapter.title}</span>
                  <span className="text-xs text-muted-foreground">{chapter.origin}</span>
                </span>
                {playing ? <span aria-label="Playing" className="mt-[7px] size-2 flex-none rounded-full bg-brand" /> : null}
              </button>
              <button
                type="button"
                onClick={() => playFrom(index)}
                aria-label={`Play from ${chapter.title}`}
                className="hidden size-11 flex-none cursor-pointer items-center justify-center self-center text-text-2 hover:text-foreground lg:flex"
              >
                <PlayIcon className="size-4" />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

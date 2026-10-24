"use client";

import { Back15Icon, Forward15Icon } from "./icons";
import { TransportControls } from "./controls";
import { usePlayer } from "./player-context";
import { ProgressBar } from "./progress-bar";

/** Persistent bottom player at 1024 px and up (prd §9). */
export function PlayerBar() {
  const { episode, chapterIndex, skipBy, focusChapter } = usePlayer();
  if (!episode) return null;
  const chapter = chapterIndex !== null ? episode.transcript.chapters[chapterIndex] : null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 hidden border-t border-line bg-surface/95 backdrop-blur lg:block lg:pl-60">
      <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6 px-10 py-3">
        <button
          type="button"
          onClick={() => focusChapter(chapterIndex)}
          className="flex min-w-0 cursor-pointer items-center gap-3 text-left"
          aria-label="Show transcript for this chapter"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- private, token-scoped cover */}
          <img src={episode.coverUrl} alt="" className="size-12 flex-none rounded-lg object-cover" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{chapter?.title ?? episode.title}</span>
            <span className="truncate text-xs text-muted-foreground">{chapter?.origin ?? "Unread"}</span>
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => skipBy(-15)} aria-label="Back 15 seconds" className="flex size-11 cursor-pointer items-center justify-center text-text-2">
            <Back15Icon className="size-6" />
          </button>
          <TransportControls compact />
          <button type="button" onClick={() => skipBy(15)} aria-label="Forward 15 seconds" className="flex size-11 cursor-pointer items-center justify-center text-text-2">
            <Forward15Icon className="size-6" />
          </button>
        </div>
        <ProgressBar className="min-w-0" />
      </div>
    </div>
  );
}

"use client";

import { PlayPauseButton } from "./controls";
import { usePlayer, usePlayerTime } from "./player-context";

/** Compact bar above the tab bar (phone/tablet); tap to open Now playing. */
export function MiniPlayer() {
  const { episode, chapterIndex, setExpanded, status } = usePlayer();
  const { currentTime, duration } = usePlayerTime();
  if (!episode) return null;
  const chapter = chapterIndex !== null ? episode.transcript.chapters[chapterIndex] : null;
  const pct = duration ? (currentTime / duration) * 100 : 0;
  return (
    <div className="fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),22px)+62px)] z-20 px-3 lg:hidden">
      <div className="relative mx-auto flex max-w-[640px] items-center gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-2 pr-3 shadow-lg">
        <button type="button" onClick={() => setExpanded(true)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left" aria-label="Open player">
          {/* eslint-disable-next-line @next/next/no-img-element -- private, token-scoped cover */}
          <img src={episode.coverUrl} alt="" className="size-11 flex-none rounded-lg object-cover" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{chapter?.title ?? episode.title}</span>
            <span className="truncate text-xs text-muted-foreground">
              {status === "error" ? "Couldn't load the audio. Tap play to retry" : (chapter?.origin ?? "Unread")}
            </span>
          </span>
        </button>
        <PlayPauseButton size="sm" />
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-line">
          <span className="block h-full bg-brand" style={{ width: `${pct}%` }} />
        </span>
      </div>
    </div>
  );
}

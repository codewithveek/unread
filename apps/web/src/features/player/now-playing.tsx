"use client";

import { useEffect } from "react";
import { ProgressBar } from "./progress-bar";
import { TransportControls } from "./controls";
import { ChevronDownIcon } from "./icons";
import { usePlayer } from "./player-context";
import { TranscriptView } from "./transcript-view";

/** Full-screen Now playing below 1024 px (canvas screen 3). */
export function NowPlaying() {
  const { episode, expanded, setExpanded, chapterIndex } = usePlayer();

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  if (!episode || !expanded) return null;
  const chapters = episode.transcript.chapters;
  const index = chapterIndex ?? 0;
  const chapter = chapters[index];
  return (
    <div role="dialog" aria-modal="true" aria-label="Now playing" className="fixed inset-0 z-40 flex flex-col bg-ground lg:hidden">
      <header className="flex items-center justify-between px-3 pt-3">
        <button type="button" onClick={() => setExpanded(false)} aria-label="Close player" className="flex size-11 cursor-pointer items-center justify-center text-foreground">
          <ChevronDownIcon className="size-[22px]" />
        </button>
        <span className="font-mono text-xs font-medium text-muted-foreground">
          {chapterIndex === null ? "INTRO" : `CHAPTER ${index + 1} OF ${chapters.length}`}
        </span>
        <span className="size-11" aria-hidden="true" />
      </header>
      <section aria-label="Current chapter" className="flex flex-col gap-1.5 px-6 pt-3">
        <span className="text-xs text-muted-foreground">{chapter?.origin ?? "Unread"}</span>
        <h1 className="m-0 text-2xl leading-tight font-bold tracking-[-0.02em]">{chapter?.title ?? episode.title}</h1>
      </section>
      <section aria-label="Transcript" className="flex-1 overflow-y-auto px-6 pt-[18px] pb-4">
        {chapter ? <TranscriptView chapterIndex={index} /> : <p className="text-[17px] text-text-2">{episode.transcript.intro.map((l) => l.text).join(" ")}</p>}
      </section>
      <section aria-label="Player controls" className="flex flex-col gap-4 border-t border-surface-2 bg-ground px-6 pt-4 pb-[max(env(safe-area-inset-bottom),28px)]">
        <ProgressBar />
        <TransportControls />
      </section>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { ProgressBar } from "./progress-bar";
import { PlayerError, TransportControls } from "./controls";
import { ChevronDownIcon } from "./icons";
import { usePlayer, usePlayerTime } from "./player-context";
import { SectionTranscript, TranscriptView } from "./transcript-view";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Full-screen Now playing below 1024 px (canvas screen 3). */
export function NowPlaying() {
  const { episode, expanded, setExpanded, chapterIndex } = usePlayer();
  const { currentTime } = usePlayerTime();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const open = Boolean(episode && expanded);

  // Modal behaviour: lock page scroll, focus inside, trap Tab, give focus back on close.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [open]);

  if (!episode || !expanded) return null;
  const { chapters, intro, outro } = episode.transcript;
  const outroStart = outro[0]?.startS;
  const section = chapterIndex === null ? "intro" : outroStart !== undefined && currentTime >= outroStart - 0.05 ? "outro" : "chapter";
  const index = chapterIndex ?? 0;
  const chapter = chapters[index];
  const label = section === "intro" ? "INTRO" : section === "outro" ? "OUTRO" : `CHAPTER ${index + 1} OF ${chapters.length}`;
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Now playing" className="fixed inset-0 z-40 flex flex-col bg-ground lg:hidden">
      <header className="flex items-center justify-between px-3 pt-3">
        <button
          ref={closeRef}
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Close player"
          className="flex size-11 cursor-pointer items-center justify-center text-foreground"
        >
          <ChevronDownIcon className="size-[22px]" />
        </button>
        <span className="font-mono text-xs font-medium text-muted-foreground">{label}</span>
        <span className="size-11" aria-hidden="true" />
      </header>
      <section aria-label="Current chapter" className="flex flex-col gap-1.5 px-6 pt-3">
        <span className="text-xs text-muted-foreground">{section === "chapter" ? (chapter?.origin ?? "Unread") : "Unread"}</span>
        <h1 className="m-0 text-2xl leading-tight font-bold tracking-[-0.02em]">
          {section === "chapter" ? (chapter?.title ?? episode.title) : episode.title}
        </h1>
      </section>
      <section aria-label="Transcript" className="flex-1 overflow-y-auto px-6 pt-[18px] pb-4">
        {section === "intro" ? (
          <SectionTranscript lines={intro} active />
        ) : section === "outro" ? (
          <SectionTranscript lines={outro} active />
        ) : chapter ? (
          <TranscriptView chapterIndex={index} />
        ) : null}
      </section>
      <section aria-label="Player controls" className="flex flex-col gap-4 border-t border-surface-2 bg-ground px-6 pt-4 pb-[max(env(safe-area-inset-bottom),28px)]">
        <ProgressBar />
        <TransportControls />
        <PlayerError />
      </section>
    </div>
  );
}

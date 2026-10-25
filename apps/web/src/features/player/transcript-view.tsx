"use client";

import type { TranscriptLine } from "@unread/core/episodes/transcript";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LinkIcon } from "./icons";
import { usePlayer, usePlayerTime } from "./player-context";

/**
 * Lines with the spoken one highlighted. Follows playback until the reader
 * scrolls; then a "Back to the current line" button brings it back.
 */
function LineList({ lines, active }: { lines: TranscriptLine[]; active: boolean }) {
  const { seek } = usePlayer();
  const { currentTime } = usePlayerTime();
  const [follow, setFollow] = useState(true);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const activeLine = active ? lines.findLastIndex((l) => currentTime >= l.startS - 0.05) : -1;

  useEffect(() => {
    if (follow) activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLine, follow]);

  const backToCurrent = () => {
    setFollow(true);
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  return (
    // Wheel/touch scrolling inside the transcript means "let me read": stop following.
    <div className="relative flex flex-col gap-3.5" onWheel={() => setFollow(false)} onTouchMove={() => setFollow(false)}>
      {lines.map((line, i) => (
        <button
          type="button"
          key={`${i}-${line.startS}`}
          ref={i === activeLine ? activeRef : undefined}
          onClick={() => {
            setFollow(true);
            seek(line.startS);
          }}
          aria-current={i === activeLine ? "true" : undefined}
          className={cn(
            "-mx-2.5 cursor-pointer rounded-[10px] px-2.5 py-2 text-left text-[17px] leading-normal",
            i === activeLine ? "bg-brand/15 text-foreground" : "text-dim hover:text-text-2",
          )}
        >
          {line.text}
        </button>
      ))}
      {!follow && activeLine >= 0 ? (
        <button
          type="button"
          onClick={backToCurrent}
          className="sticky bottom-2 z-10 min-h-11 cursor-pointer self-center rounded-full border border-line bg-surface px-4 text-sm font-medium shadow-lg"
        >
          Back to the current line
        </button>
      ) : null}
    </div>
  );
}

/** Intro or outro text (no sources: they're templates). */
export function SectionTranscript({ lines, active }: { lines: TranscriptLine[]; active: boolean }) {
  return <LineList lines={lines} active={active} />;
}

/** Transcript of one chapter, highlighting the line being spoken, plus every source it cites. */
export function TranscriptView({ chapterIndex, className }: { chapterIndex: number; className?: string }) {
  const { episode, chapterIndex: playingIndex } = usePlayer();
  const chapter = episode?.transcript.chapters[chapterIndex];
  if (!chapter) return null;
  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      <LineList lines={chapter.lines} active={playingIndex === chapterIndex} />
      <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Sources">
        {chapter.sources.map((source) => (
          <li key={source.itemId} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-3">
            <LinkIcon className="size-[18px] flex-none text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{source.role === "primary" ? "Source" : "Also covered by"}</span>
              <span className="truncate text-sm font-medium">
                {source.label} · {source.title}
              </span>
            </div>
            {source.url ? (
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="py-3 pl-2 text-sm no-underline">
                Open
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

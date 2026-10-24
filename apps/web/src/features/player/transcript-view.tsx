"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { LinkIcon } from "./icons";
import { usePlayer } from "./player-context";

/** Transcript of one chapter, highlighting the line being spoken, plus every source it cites. */
export function TranscriptView({ chapterIndex, className }: { chapterIndex: number; className?: string }) {
  const { episode, currentTime, chapterIndex: playingIndex, seek } = usePlayer();
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const chapter = episode?.transcript.chapters[chapterIndex];
  const isPlayingChapter = playingIndex === chapterIndex;
  const activeLine = isPlayingChapter && chapter ? chapter.lines.findLastIndex((l) => currentTime >= l.startS - 0.05) : -1;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLine]);

  if (!chapter) return null;
  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      {chapter.lines.map((line, i) => (
        <button
          type="button"
          key={`${i}-${line.startS}`}
          ref={i === activeLine ? activeRef : undefined}
          onClick={() => seek(line.startS)}
          aria-current={i === activeLine ? "true" : undefined}
          className={cn(
            "-mx-2.5 cursor-pointer rounded-[10px] px-2.5 py-2 text-left text-[17px] leading-normal",
            i === activeLine ? "bg-brand/15 text-foreground" : "text-dim hover:text-text-2",
          )}
        >
          {line.text}
        </button>
      ))}
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

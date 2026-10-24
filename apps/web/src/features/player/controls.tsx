"use client";

import { cn } from "@/lib/utils";
import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from "./icons";
import { usePlayer } from "./player-context";

export function PlayPauseButton({ size = "lg", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const { playing, toggle } = usePlayer();
  const dims = size === "lg" ? "size-[68px]" : size === "md" ? "size-14" : "size-11";
  const icon = size === "sm" ? "size-5" : "size-6";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? "Pause" : "Play"}
      className={cn("flex flex-none cursor-pointer items-center justify-center rounded-full bg-brand text-on-brand", dims, className)}
    >
      {playing ? <PauseIcon className={icon} /> : <PlayIcon className={icon} />}
    </button>
  );
}

/** Speed · previous · play · next · skip story (canvas Now playing controls). */
export function TransportControls({ compact = false }: { compact?: boolean }) {
  const { rate, cycleRate, previousChapter, nextChapter, skipStory } = usePlayer();
  return (
    <div className={cn("flex items-center", compact ? "gap-2" : "justify-between")}>
      <button
        type="button"
        onClick={cycleRate}
        aria-label={`Playback speed ${rate}×`}
        className="h-11 w-[52px] cursor-pointer font-mono text-sm font-medium text-text-2"
      >
        {rate}×
      </button>
      <button type="button" onClick={previousChapter} aria-label="Previous chapter" className="flex size-12 cursor-pointer items-center justify-center text-foreground">
        <PrevIcon className="size-6" />
      </button>
      <PlayPauseButton size={compact ? "md" : "lg"} />
      <button type="button" onClick={nextChapter} aria-label="Next chapter" className="flex size-12 cursor-pointer items-center justify-center text-foreground">
        <NextIcon className="size-6" />
      </button>
      <button type="button" onClick={skipStory} aria-label="Skip this story" className="h-11 w-[52px] cursor-pointer text-[13px] font-medium text-text-2">
        Skip
      </button>
    </div>
  );
}

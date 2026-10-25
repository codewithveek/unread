"use client";

import { cn } from "@/lib/utils";
import { NextIcon, PauseIcon, PlayIcon, PrevIcon, RetryIcon, SpinnerIcon } from "./icons";
import { usePlayer } from "./player-context";

/** Play/pause that also shows loading (spinner) and a failed load (retry). */
export function PlayPauseButton({ size = "lg", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const { playing, toggle, status, buffering } = usePlayer();
  const dims = size === "lg" ? "size-[68px]" : size === "md" ? "size-14" : "size-11";
  const icon = size === "sm" ? "size-5" : "size-6";
  const waiting = (playing && buffering) || (status === "loading" && playing);
  const label = status === "error" ? "Couldn't load the audio. Retry" : waiting ? "Loading, pause" : playing ? "Pause" : "Play";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-busy={waiting || undefined}
      className={cn("flex flex-none cursor-pointer items-center justify-center rounded-full bg-brand text-on-brand", dims, className)}
    >
      {status === "error" ? (
        <RetryIcon className={icon} />
      ) : waiting ? (
        <SpinnerIcon className={cn(icon, "animate-spin motion-reduce:animate-none")} />
      ) : playing ? (
        <PauseIcon className={icon} />
      ) : (
        <PlayIcon className={icon} />
      )}
    </button>
  );
}

/** One line under the controls when the audio couldn't be fetched. */
export function PlayerError({ className }: { className?: string }) {
  const { status, retry } = usePlayer();
  if (status !== "error") return null;
  return (
    <p role="alert" className={cn("m-0 flex items-center justify-center gap-2 text-sm text-muted-foreground", className)}>
      Couldn&apos;t load the audio.
      <button type="button" onClick={retry} className="min-h-11 cursor-pointer px-1 text-link hover:text-link-hover">
        Try again
      </button>
    </p>
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

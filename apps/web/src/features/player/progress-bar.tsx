"use client";

import { cn } from "@/lib/utils";
import { clock, remaining } from "./format";
import { usePlayer } from "./player-context";

/** Seekable progress with chapter marks (canvas Now playing). A native range input keeps it accessible. */
export function ProgressBar({ className, showTimes = true }: { className?: string; showTimes?: boolean }) {
  const { episode, currentTime, duration, seek } = usePlayer();
  if (!episode) return null;
  const pct = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          {episode.transcript.chapters.slice(1).map((c) => (
            <span
              key={c.startS}
              aria-hidden="true"
              className="absolute -top-[3px] h-3 w-0.5 bg-ground"
              style={{ left: `${duration ? (c.startS / duration) * 100 : 0}%` }}
            />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(duration))}
          step={1}
          value={Math.round(currentTime)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          aria-valuetext={`${clock(currentTime)} of ${clock(duration)}`}
          className="absolute inset-0 h-6 w-full cursor-pointer opacity-0"
        />
      </div>
      {showTimes ? (
        <div className="flex justify-between font-mono text-xs text-muted-foreground">
          <span>{clock(currentTime)}</span>
          <span>{remaining(currentTime, duration)}</span>
        </div>
      ) : null}
    </div>
  );
}

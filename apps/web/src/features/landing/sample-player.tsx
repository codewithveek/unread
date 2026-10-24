"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { clock } from "@/features/player/format";
import { PauseIcon, PlayIcon } from "@/features/player/icons";
import { cn } from "@/lib/utils";
import { SAMPLE_EPISODE } from "./content";

interface SampleAudio {
  playing: boolean;
  current: number;
  duration: number;
  /** The sample file failed to load. */
  unavailable: boolean;
  toggle: () => void;
  playFrom: (seconds: number) => void;
}

const SampleAudioContext = createContext<SampleAudio | null>(null);

function useSampleAudio(): SampleAudio {
  const value = useContext(SampleAudioContext);
  if (!value) throw new Error("useSampleAudio must be used inside SampleAudioProvider");
  return value;
}

/** One audio element for the landing page, shared by the hero card and the chapter buttons. */
export function SampleAudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number>(SAMPLE_EPISODE.durationSeconds);
  const [unavailable, setUnavailable] = useState(false);

  const play = () => {
    audioRef.current?.play().catch(() => setPlaying(false));
  };

  const value: SampleAudio = {
    playing,
    current,
    duration,
    unavailable,
    toggle: () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) play();
      else audio.pause();
    },
    playFrom: (seconds) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = seconds;
      play();
    },
  };

  return (
    <SampleAudioContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        src={SAMPLE_EPISODE.src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setUnavailable(true);
        }}
      />
    </SampleAudioContext.Provider>
  );
}

export function SampleCard() {
  const { playing, current, duration, unavailable, toggle } = useSampleAudio();
  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div
      id="sample"
      className="flex max-w-[520px] scroll-mt-24 items-center gap-3.5 rounded-2xl border border-line bg-surface py-3 pr-4 pl-3"
    >
      <button
        type="button"
        onClick={toggle}
        disabled={unavailable}
        aria-label={playing ? "Pause sample episode" : "Play sample episode"}
        className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full bg-brand text-on-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        {playing ? <PauseIcon className="size-[18px]" /> : <PlayIcon className="size-[18px]" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex justify-between gap-3 text-[13px]">
          <span className="truncate font-semibold">{unavailable ? "Sample episode coming soon" : SAMPLE_EPISODE.title}</span>
          <span className="flex-none font-mono text-muted-foreground">
            {clock(current)} / {clock(duration)}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Sample progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="h-1 rounded-full bg-line"
        >
          <div className="h-1 rounded-full bg-brand" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Plays the sample from a chapter's start; shows pause while that chapter is the one playing. */
export function ChapterPlayButton({
  label,
  startSeconds,
  endSeconds,
  className,
}: {
  label: string;
  startSeconds: number;
  endSeconds: number;
  className?: string;
}) {
  const { playing, current, unavailable, toggle, playFrom } = useSampleAudio();
  const inChapter = current >= startSeconds && current < endSeconds;
  const active = playing && inChapter;

  return (
    <button
      type="button"
      onClick={() => (inChapter ? toggle() : playFrom(startSeconds))}
      disabled={unavailable}
      aria-label={active ? `Pause ${label}` : `Play ${label}`}
      className={cn(
        "flex size-11 cursor-pointer items-center justify-center rounded-full bg-brand text-on-brand disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {active ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
    </button>
  );
}

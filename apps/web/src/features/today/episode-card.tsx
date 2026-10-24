"use client";

import type { PlayerEpisode } from "@/features/episodes/queries";
import { clock, minutesLabel, remaining } from "@/features/player/format";
import { PauseIcon, PlayIcon } from "@/features/player/icons";
import { usePlayer } from "@/features/player/player-context";
import { EpisodeCover } from "./episode-cover";

export interface EpisodeCardProps {
  episode: PlayerEpisode;
  /** "made at 6:00" in the user's timezone. */
  madeAt: string;
  sourceCount: number;
  trialNote: string | null;
  cover: { seed: string; day: string; caption: string };
}

function storiesLine(title: string): string {
  const afterDate = title.split(": ").slice(1).join(": ");
  return afterDate ? afterDate.charAt(0).toUpperCase() + afterDate.slice(1) : title;
}

/** Home's episode card (canvas screen 2): cover, what's in it, big play button, progress. */
export function EpisodeCard({ episode, madeAt, sourceCount, trialNote, cover }: EpisodeCardProps) {
  const player = usePlayer();
  const isCurrent = player.episode?.id === episode.id;
  const playing = isCurrent && player.playing;
  const time = isCurrent ? player.currentTime : 0;
  const duration = isCurrent ? player.duration : episode.durationS;
  const pct = duration ? (time / duration) * 100 : 0;

  const onPlay = () => {
    if (isCurrent) player.toggle();
    else player.load(episode, { autoplay: true });
  };

  return (
    <section aria-label="Today's episode" className="overflow-hidden rounded-[20px] border border-line bg-surface">
      <EpisodeCover seed={cover.seed} day={cover.day} caption={cover.caption} />
      <div className="flex flex-col gap-3.5 px-[18px] pt-4 pb-[18px]">
        <div className="flex flex-col gap-1">
          <p className="m-0 text-[17px] font-semibold tracking-[-0.01em]">{storiesLine(episode.title)}</p>
          <p className="m-0 font-mono text-[13px] text-muted-foreground">
            {minutesLabel(episode.durationS)} · made at {madeAt} · {sourceCount} sources ·{" "}
            {episode.voiceProvider === "elevenlabs" ? "Studio voice" : "Free voice"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPlay}
            aria-label={playing ? "Pause episode" : "Play today's episode"}
            className="flex size-14 flex-none cursor-pointer items-center justify-center rounded-full bg-brand text-on-brand"
          >
            {playing ? <PauseIcon className="size-[22px]" /> : <PlayIcon className="size-[22px]" />}
          </button>
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-1 overflow-hidden rounded-sm bg-line">
              <div className="h-1 bg-brand" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between font-mono text-xs text-muted-foreground">
              <span>{clock(time)}</span>
              <span>{remaining(time, duration)}</span>
            </div>
          </div>
        </div>
        {trialNote ? <p className="m-0 text-[13px] text-text-2">{trialNote}</p> : null}
      </div>
    </section>
  );
}

"use client";

import type { PlayerEpisode } from "@/features/episodes/queries";
import { clock, minutesLabel } from "@/features/player/format";
import { PauseIcon, PlayIcon } from "@/features/player/icons";
import { storedPosition, usePlayer, wasPlayed } from "@/features/player/player-context";
import { useBrowserValue } from "@/lib/use-browser-value";

export interface HistoryEntry {
  episode: PlayerEpisode;
  /** "Fri 23 Oct", in the user's timezone (formatted on the server). */
  dateLabel: string;
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const { episode, dateLabel } = entry;
  const player = usePlayer();
  const saved = useBrowserValue(() => storedPosition(episode.id), 0);
  const played = useBrowserValue(() => wasPlayed(episode.id), false);
  const isCurrent = player.episode?.id === episode.id;
  const playing = isCurrent && player.playing;
  const resumable = saved > 0 && saved < episode.durationS - 5;
  const state = isCurrent ? (playing ? "Playing" : "Paused") : resumable ? `Resume from ${clock(saved)}` : played ? "Played" : null;
  const onPlay = () => (isCurrent ? player.toggle() : player.load(episode, { autoplay: true }));
  return (
    <li className="flex items-center gap-3 border-b border-surface-2 py-3">
      <button
        type="button"
        onClick={onPlay}
        aria-label={`${playing ? "Pause" : "Play"} ${dateLabel} episode`}
        className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border border-line text-foreground"
      >
        {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
      </button>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-medium">{episode.title}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {dateLabel} · {minutesLabel(episode.durationS)}
          {state ? ` · ${state}` : ""}
        </span>
      </span>
    </li>
  );
}

/** Earlier episodes, playable in the web player (the feed has them too). */
export function EpisodeHistory({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="earlier-episodes" className="flex flex-col gap-1">
      <h2 id="earlier-episodes" className="m-0 text-[15px] font-semibold">
        Earlier episodes
      </h2>
      <ul className="m-0 list-none p-0">
        {entries.map((entry) => (
          <HistoryRow key={entry.episode.id} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

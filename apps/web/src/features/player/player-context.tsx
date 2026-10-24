"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerEpisode } from "@/features/episodes/queries";

const RATES = [1, 1.2, 1.5, 1.75, 2, 0.8] as const;

export interface PlayerState {
  episode: PlayerEpisode | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  expanded: boolean;
  /** Chapter shown in the desktop transcript panel (clicked, or the one playing). */
  focusedChapter: number | null;
  chapterIndex: number | null;
}

export interface PlayerApi extends PlayerState {
  load: (episode: PlayerEpisode, options?: { autoplay?: boolean; startAt?: number }) => void;
  toggle: () => void;
  seek: (time: number) => void;
  skipBy: (seconds: number) => void;
  goToChapter: (index: number) => void;
  nextChapter: () => void;
  previousChapter: () => void;
  skipStory: () => void;
  cycleRate: () => void;
  setExpanded: (expanded: boolean) => void;
  focusChapter: (index: number | null) => void;
}

const PlayerContext = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer outside PlayerProvider");
  return ctx;
}

export function chapterAt(episode: PlayerEpisode | null, time: number): number | null {
  if (!episode) return null;
  const chapters = episode.transcript.chapters;
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (time >= (chapters[i]?.startS ?? 0) - 0.05) return i;
  }
  return null;
}

function sendEvent(body: { episodeId: string; chapterIndex: number | null; event: "play" | "skip" | "complete" | "seek"; positionS: number }) {
  void fetch("/api/listen", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
}

function storedPosition(id: string): number {
  try {
    return Number(localStorage.getItem(`unread:pos:${id}`) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function storePosition(id: string, time: number) {
  try {
    localStorage.setItem(`unread:pos:${id}`, String(Math.floor(time)));
  } catch {
    // private mode: fine
  }
}

/** One audio element for the whole app (prd §9: global player, persists across navigation). */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [episode, setEpisode] = useState<PlayerEpisode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [focusedChapter, focusChapter] = useState<number | null>(null);
  const lastChapter = useRef<number | null>(null);
  const seeking = useRef(false);

  const chapterIndex = chapterAt(episode, currentTime);

  const loadedId = useRef<string | null>(null);

  const load = useCallback((next: PlayerEpisode, options: { autoplay?: boolean; startAt?: number } = {}) => {
    const audio = audioRef.current;
    if (!audio) return;
    // Side effects stay out of state updaters: React may run those after play().
    if (loadedId.current !== next.id) {
      loadedId.current = next.id;
      audio.src = next.audioUrl;
      audio.currentTime = options.startAt ?? storedPosition(next.id);
      lastChapter.current = null;
      setEpisode(next);
      setDuration(next.durationS);
    } else if (options.startAt !== undefined) {
      audio.currentTime = options.startAt;
    }
    if (options.autoplay !== false) void audio.play().catch(() => undefined);
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  }, []);

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (!audio || !episode) return;
      seeking.current = true;
      audio.currentTime = Math.max(0, Math.min(time, audio.duration || episode.durationS));
      setCurrentTime(audio.currentTime);
    },
    [episode],
  );

  const skipBy = useCallback((seconds: number) => seek((audioRef.current?.currentTime ?? 0) + seconds), [seek]);

  const goToChapter = useCallback(
    (index: number) => {
      const chapter = episode?.transcript.chapters[index];
      if (chapter) seek(chapter.startS);
    },
    [episode, seek],
  );

  const nextChapter = useCallback(() => {
    if (!episode) return;
    const idx = chapterAt(episode, audioRef.current?.currentTime ?? 0);
    const next = idx === null ? 0 : idx + 1;
    if (next < episode.transcript.chapters.length) goToChapter(next);
    else seek(episode.durationS);
  }, [episode, goToChapter, seek]);

  const previousChapter = useCallback(() => {
    if (!episode) return;
    const time = audioRef.current?.currentTime ?? 0;
    const idx = chapterAt(episode, time);
    if (idx === null) return seek(0);
    const start = episode.transcript.chapters[idx]?.startS ?? 0;
    // Like a CD player: restart the chapter unless we're at its start.
    goToChapter(time - start > 3 || idx === 0 ? idx : idx - 1);
  }, [episode, goToChapter, seek]);

  const skipStory = useCallback(() => {
    if (!episode) return;
    const time = audioRef.current?.currentTime ?? 0;
    sendEvent({ episodeId: episode.id, chapterIndex: chapterAt(episode, time), event: "skip", positionS: time });
    nextChapter();
  }, [episode, nextChapter]);

  const cycleRate = useCallback(() => {
    setRate((r) => {
      const next = RATES[(RATES.indexOf(r as (typeof RATES)[number]) + 1) % RATES.length] ?? 1;
      if (audioRef.current) audioRef.current.playbackRate = next;
      return next;
    });
  }, []);

  // Audio element events.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => {
      setPlaying(true);
      if (episode) sendEvent({ episodeId: episode.id, chapterIndex: chapterAt(episode, audio.currentTime), event: "play", positionS: audio.currentTime });
    };
    const onPause = () => setPlaying(false);
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      if (!episode) return;
      const idx = chapterAt(episode, audio.currentTime);
      const prev = lastChapter.current;
      if (!seeking.current && prev !== null && idx !== null && idx === prev + 1) {
        sendEvent({ episodeId: episode.id, chapterIndex: prev, event: "complete", positionS: audio.currentTime });
      }
      lastChapter.current = idx;
      if (Math.floor(audio.currentTime) % 5 === 0) storePosition(episode.id, audio.currentTime);
    };
    const onSeeked = () => {
      if (episode && seeking.current) sendEvent({ episodeId: episode.id, chapterIndex: chapterAt(episode, audio.currentTime), event: "seek", positionS: audio.currentTime });
      seeking.current = false;
      lastChapter.current = episode ? chapterAt(episode, audio.currentTime) : null;
    };
    const onMeta = () => setDuration(audio.duration || episode?.durationS || 0);
    const onEnded = () => {
      setPlaying(false);
      if (episode) {
        sendEvent({ episodeId: episode.id, chapterIndex: episode.transcript.chapters.length - 1, event: "complete", positionS: audio.currentTime });
        storePosition(episode.id, 0);
      }
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("seeked", onSeeked);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("seeked", onSeeked);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, [episode]);

  // Media Session: lock-screen controls and metadata (prd §9).
  useEffect(() => {
    if (!episode || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const chapter = chapterIndex !== null ? episode.transcript.chapters[chapterIndex] : null;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: chapter?.title ?? episode.title,
      artist: chapter?.origin ?? "Unread",
      album: episode.title,
      artwork: [{ src: episode.coverUrl, sizes: "1200x1200", type: "image/png" }],
    });
  }, [episode, chapterIndex]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => toggle()],
      ["pause", () => toggle()],
      ["seekbackward", () => skipBy(-15)],
      ["seekforward", () => skipBy(15)],
      ["previoustrack", () => previousChapter()],
      ["nexttrack", () => nextChapter()],
      ["seekto", (d) => d.seekTime !== undefined && seek(d.seekTime)],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // unsupported action
      }
    }
  }, [toggle, skipBy, previousChapter, nextChapter, seek]);

  // Desktop shortcuts: space, ←/→ 15 s, shift+←/→ chapter (prd §9).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!episode || event.metaKey || event.ctrlKey || event.altKey || !target) return;
      if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      // A focused button/link already handles Space itself.
      if (event.key === " " && /^(BUTTON|A)$/.test(target.tagName)) return;
      if (event.key === " ") {
        event.preventDefault();
        toggle();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (event.shiftKey) previousChapter();
        else skipBy(-15);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (event.shiftKey) nextChapter();
        else skipBy(15);
      } else if (event.key === "Escape") {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [episode, toggle, skipBy, previousChapter, nextChapter]);

  const api = useMemo<PlayerApi>(
    () => ({
      episode,
      playing,
      currentTime,
      duration: duration || episode?.durationS || 0,
      rate,
      expanded,
      focusedChapter,
      chapterIndex,
      load,
      toggle,
      seek,
      skipBy,
      goToChapter,
      nextChapter,
      previousChapter,
      skipStory,
      cycleRate,
      setExpanded,
      focusChapter,
    }),
    [episode, playing, currentTime, duration, rate, expanded, focusedChapter, chapterIndex, load, toggle, seek, skipBy, goToChapter, nextChapter, previousChapter, skipStory, cycleRate],
  );

  return (
    <PlayerContext.Provider value={api}>
      {children}
      {/* The transcript is the caption track (prd §9). */}
      <audio ref={audioRef} preload="metadata" className="hidden" />
    </PlayerContext.Provider>
  );
}

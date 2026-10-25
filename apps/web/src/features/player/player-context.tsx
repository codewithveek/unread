"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerEpisode } from "@/features/episodes/queries";

const RATES = [1, 1.2, 1.5, 1.75, 2, 0.8] as const;

export type PlayerStatus = "idle" | "loading" | "ready" | "error";

export interface PlayerState {
  episode: PlayerEpisode | null;
  playing: boolean;
  /** "loading" until the audio's metadata arrives; "error" when it couldn't be fetched or decoded. */
  status: PlayerStatus;
  /** Playback is waiting for data (slow network). */
  buffering: boolean;
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
  /** Fetch the audio again from where it stopped (after an error). */
  retry: () => void;
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

export interface PlayerTime {
  currentTime: number;
  duration: number;
}

const PlayerContext = createContext<PlayerApi | null>(null);
/** Separate, so the ~4 Hz time updates only re-render what shows the time. */
const PlayerTimeContext = createContext<PlayerTime>({ currentTime: 0, duration: 0 });

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer outside PlayerProvider");
  return ctx;
}

export function usePlayerTime(): PlayerTime {
  return useContext(PlayerTimeContext);
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

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode: fine
  }
}

/** Saved listening position for an episode (seconds), 0 if none. */
export function storedPosition(id: string): number {
  return Number(readStorage(`unread:pos:${id}`) ?? 0) || 0;
}

/** Whether this browser has played the episode to the end. */
export function wasPlayed(id: string): boolean {
  return readStorage(`unread:played:${id}`) === "1";
}

function storePosition(id: string, time: number) {
  writeStorage(`unread:pos:${id}`, String(Math.floor(time)));
}

function storedRate(): number {
  const value = Number(readStorage("unread:rate"));
  return (RATES as readonly number[]).includes(value) ? value : 1;
}

/** One audio element for the whole app (prd §9: global player, persists across navigation). */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [episode, setEpisode] = useState<PlayerEpisode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [buffering, setBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [focusedChapter, focusChapter] = useState<number | null>(null);
  const lastChapter = useRef<number | null>(null);
  const seeking = useRef(false);
  const loadedId = useRef<string | null>(null);
  /** Where to start once metadata arrives: Safari ignores currentTime set before then. */
  const pendingStart = useRef<number | null>(null);
  /** Keep playing after an automatic retry if we were playing when it failed. */
  const resumeAfterRetry = useRef(false);
  const retried = useRef(false);
  const lastSaved = useRef(-1);

  const chapterIndex = chapterAt(episode, currentTime);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio?.src) return;
    audio.play().catch((error: unknown) => {
      // NotAllowedError (autoplay policy) and AbortError (a new load) aren't failures.
      if (error instanceof DOMException && error.name === "NotSupportedError") setStatus("error");
    });
  }, []);

  const startAt = useCallback((audio: HTMLAudioElement, time: number) => {
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) audio.currentTime = time;
    else pendingStart.current = time;
    setCurrentTime(time);
  }, []);

  const load = useCallback(
    (next: PlayerEpisode, options: { autoplay?: boolean; startAt?: number } = {}) => {
      const audio = audioRef.current;
      if (!audio) return;
      // Side effects stay out of state updaters: React may run those after play().
      if (loadedId.current !== next.id) {
        loadedId.current = next.id;
        retried.current = false;
        lastSaved.current = -1;
        const saved = storedPosition(next.id);
        // A saved position in the last few seconds means it was finished: start over.
        const from = options.startAt ?? (saved < next.durationS - 5 ? saved : 0);
        pendingStart.current = from;
        // A new src resets playbackRate to defaultPlaybackRate, so set both.
        const nextRate = storedRate();
        audio.defaultPlaybackRate = nextRate;
        audio.src = next.audioUrl;
        audio.playbackRate = nextRate;
        lastChapter.current = null;
        setRate(nextRate);
        setStatus("loading");
        setBuffering(false);
        setEpisode(next);
        setCurrentTime(from);
        setDuration(next.durationS);
      } else if (options.startAt !== undefined) {
        startAt(audio, options.startAt);
      }
      if (options.autoplay !== false) play();
    },
    [play, startAt],
  );

  const retry = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !episode) return;
    // Setting src again re-requests /audio/…, which also mints a fresh signed URL.
    pendingStart.current = audio.currentTime || pendingStart.current;
    retried.current = false;
    audio.src = episode.audioUrl;
    setStatus("loading");
    play();
  }, [episode, play]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio?.src) return;
    if (status === "error") return retry();
    if (audio.paused) play();
    else audio.pause();
  }, [status, retry, play]);

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (!audio || !episode) return;
      const target = Math.max(0, Math.min(time, audio.duration || episode.durationS));
      if (audio.readyState < HTMLMediaElement.HAVE_METADATA) {
        pendingStart.current = target;
        setCurrentTime(target);
        return;
      }
      seeking.current = true;
      audio.currentTime = target;
      setCurrentTime(target);
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
    const next = RATES[(RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length] ?? 1;
    const audio = audioRef.current;
    if (audio) {
      audio.defaultPlaybackRate = next;
      audio.playbackRate = next;
    }
    writeStorage("unread:rate", String(next));
    setRate(next);
  }, [rate]);

  // Audio element events.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const session = typeof navigator !== "undefined" && "mediaSession" in navigator ? navigator.mediaSession : null;
    const updatePosition = () => {
      if (!session?.setPositionState || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
      try {
        session.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime, audio.duration) });
      } catch {
        // Some browsers reject edge values; the lock screen just shows less.
      }
    };
    const save = () => {
      if (episode && !audio.ended) storePosition(episode.id, audio.currentTime);
    };
    const onPlay = () => {
      setPlaying(true);
      if (session) session.playbackState = "playing";
      updatePosition();
      if (episode) sendEvent({ episodeId: episode.id, chapterIndex: chapterAt(episode, audio.currentTime), event: "play", positionS: audio.currentTime });
    };
    const onPause = () => {
      setPlaying(false);
      if (session) session.playbackState = "paused";
      updatePosition();
      save();
    };
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      if (!episode) return;
      const idx = chapterAt(episode, audio.currentTime);
      const prev = lastChapter.current;
      if (!seeking.current && prev !== null && idx !== null && idx === prev + 1) {
        sendEvent({ episodeId: episode.id, chapterIndex: prev, event: "complete", positionS: audio.currentTime });
      }
      lastChapter.current = idx;
      const second = Math.floor(audio.currentTime);
      if (second % 5 === 0 && second !== lastSaved.current) {
        lastSaved.current = second;
        save();
      }
    };
    const onSeeked = () => {
      if (episode && seeking.current) sendEvent({ episodeId: episode.id, chapterIndex: chapterAt(episode, audio.currentTime), event: "seek", positionS: audio.currentTime });
      seeking.current = false;
      lastChapter.current = episode ? chapterAt(episode, audio.currentTime) : null;
      updatePosition();
    };
    const onMeta = () => {
      setDuration(audio.duration || episode?.durationS || 0);
      setStatus("ready");
      const start = pendingStart.current;
      pendingStart.current = null;
      if (start !== null && start > 0) audio.currentTime = start;
      if (resumeAfterRetry.current) {
        resumeAfterRetry.current = false;
        play();
      }
      updatePosition();
    };
    const onEnded = () => {
      setPlaying(false);
      if (session) session.playbackState = "paused";
      if (episode) {
        sendEvent({ episodeId: episode.id, chapterIndex: episode.transcript.chapters.length - 1, event: "complete", positionS: audio.currentTime });
        storePosition(episode.id, 0);
        writeStorage(`unread:played:${episode.id}`, "1");
      }
    };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      setStatus("ready");
    };
    const onError = () => {
      setBuffering(false);
      if (!episode) return;
      // One quiet retry: covers an expired signed URL or a dropped connection.
      if (!retried.current) {
        retried.current = true;
        resumeAfterRetry.current = !audio.paused;
        pendingStart.current = audio.currentTime || pendingStart.current;
        audio.src = episode.audioUrl;
        setStatus("loading");
        return;
      }
      setPlaying(false);
      setStatus("error");
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("seeked", onSeeked);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("ratechange", updatePosition);
    audio.addEventListener("error", onError);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("seeked", onSeeked);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("ratechange", updatePosition);
      audio.removeEventListener("error", onError);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
    };
  }, [episode, play]);

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
    // Explicit play/pause: a toggle would start playback from a lock-screen "pause" if state drifted.
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => play()],
      ["pause", () => audioRef.current?.pause()],
      ["seekbackward", (d) => skipBy(-(d.seekOffset ?? 15))],
      ["seekforward", (d) => skipBy(d.seekOffset ?? 15)],
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
  }, [play, skipBy, previousChapter, nextChapter, seek]);

  // Desktop shortcuts: space, ←/→ 15 s, shift+←/→ chapter (prd §9).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!episode || event.metaKey || event.ctrlKey || event.altKey || !target) return;
      // The seek slider keeps its own arrow keys, but Space still plays/pauses there.
      const onSlider = target instanceof HTMLInputElement && target.type === "range";
      if (!(onSlider && event.key === " ")) {
        if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      }
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

  const fullDuration = duration || episode?.durationS || 0;
  const api = useMemo<PlayerApi>(
    () => ({
      episode,
      playing,
      status,
      buffering,
      duration: fullDuration,
      rate,
      expanded,
      focusedChapter,
      chapterIndex,
      load,
      toggle,
      retry,
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
    [episode, playing, status, buffering, fullDuration, rate, expanded, focusedChapter, chapterIndex, load, toggle, retry, seek, skipBy, goToChapter, nextChapter, previousChapter, skipStory, cycleRate],
  );
  const time = useMemo<PlayerTime>(() => ({ currentTime, duration: fullDuration }), [currentTime, fullDuration]);

  return (
    <PlayerContext.Provider value={api}>
      <PlayerTimeContext.Provider value={time}>
        {children}
        {/* The transcript is the caption track (prd §9). */}
        <audio ref={audioRef} preload="metadata" className="hidden" />
      </PlayerTimeContext.Provider>
    </PlayerContext.Provider>
  );
}

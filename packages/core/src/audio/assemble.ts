import { spawn } from "node:child_process";
import { SAMPLE_RATE } from "../voice/voice-provider";

export interface AssemblyChapter {
  title: string;
  clips: Float32Array[];
}

export interface Sfx {
  intro?: Float32Array;
  transition?: Float32Array;
  outro?: Float32Array;
}

export interface AssembledEpisode {
  mp3: Uint8Array;
  durationS: number;
  /** Start/end of each chapter in seconds, from clip durations (prd §6 step 7). */
  chapters: { title: string; startS: number; endS: number; lineStarts: number[] }[];
  introLineStarts: number[];
  outroLineStarts: number[];
}

const LINE_GAP_S = 0.28;
const CHAPTER_GAP_S = 0.7;

function silence(seconds: number): Float32Array {
  return new Float32Array(Math.round(seconds * SAMPLE_RATE));
}

function concat(parts: Float32Array[]): Float32Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function runFfmpeg(ffmpegPath: string, args: string[], input: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    proc.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => {
      err = (err + chunk.toString()).slice(-4000);
    });
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve(new Uint8Array(Buffer.concat(out))) : reject(new Error(`ffmpeg exited ${code}: ${err}`))));
    proc.stdin.end(input);
  });
}

/** Decode any audio file (e.g. an SFX MP3) to 24 kHz mono float PCM. */
export async function decodeToPcm(ffmpegPath: string, file: Uint8Array): Promise<Float32Array> {
  const pcm = await runFfmpeg(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", String(SAMPLE_RATE), "pipe:1"], file);
  return new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);
}

/**
 * Intro, chapters and outro with short pauses and optional SFX, normalised to
 * −16 LUFS and encoded as MP3 by ffmpeg in one pass.
 */
export async function assembleEpisode(options: {
  ffmpegPath: string;
  intro: Float32Array[];
  chapters: AssemblyChapter[];
  outro: Float32Array[];
  sfx?: Sfx;
  title: string;
}): Promise<AssembledEpisode> {
  const { sfx = {} } = options;
  const parts: Float32Array[] = [];
  let samples = 0;
  const push = (p: Float32Array) => {
    parts.push(p);
    samples += p.length;
  };
  const pushLines = (clips: Float32Array[]): number[] =>
    clips.map((clip, i) => {
      if (i > 0) push(silence(LINE_GAP_S));
      const start = samples / SAMPLE_RATE;
      push(clip);
      return start;
    });

  if (sfx.intro) push(sfx.intro);
  const introLineStarts = pushLines(options.intro);
  const chapters: AssembledEpisode["chapters"] = [];
  for (const chapter of options.chapters) {
    push(silence(CHAPTER_GAP_S / 2));
    if (sfx.transition) push(sfx.transition);
    push(silence(CHAPTER_GAP_S / 2));
    const start = samples / SAMPLE_RATE;
    const lineStarts = pushLines(chapter.clips);
    chapters.push({ title: chapter.title, startS: start, endS: samples / SAMPLE_RATE, lineStarts });
  }
  push(silence(CHAPTER_GAP_S));
  const outroLineStarts = pushLines(options.outro);
  if (sfx.outro) push(sfx.outro);

  const pcm = concat(parts);
  const mp3 = await runFfmpeg(
    options.ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "f32le",
      "-ar",
      String(SAMPLE_RATE),
      "-ac",
      "1",
      "-i",
      "pipe:0",
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      "-ar",
      "44100",
      "-ac",
      "1",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "96k",
      "-metadata",
      `title=${options.title}`,
      "-metadata",
      "artist=Unread",
      "-f",
      "mp3",
      "pipe:1",
    ],
    new Uint8Array(pcm.buffer),
  );
  return { mp3, durationS: pcm.length / SAMPLE_RATE, chapters, introLineStarts, outroLineStarts };
}

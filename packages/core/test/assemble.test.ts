import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { assembleEpisode, decodeToPcm } from "../src/audio";
import { SAMPLE_RATE } from "../src/voice/voice-provider";

const ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg";
const hasFfmpeg = spawnSync(ffmpegPath, ["-version"]).status === 0;

/** A quiet tone, so loudnorm has something to lift. */
function tone(seconds: number, hz = 220, gain = 0.05): Float32Array {
  const out = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  for (let i = 0; i < out.length; i++) out[i] = Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE) * gain;
  return out;
}

describe.skipIf(!hasFfmpeg)("assembleEpisode (real ffmpeg)", () => {
  it("writes an MP3 with an Info header, chapter timings from clip lengths, and normalised loudness", async () => {
    const result = await assembleEpisode({
      ffmpegPath,
      intro: [tone(1)],
      chapters: [
        { title: "One", clips: [tone(0.5), tone(1)] },
        { title: "Two", clips: [tone(0.5), tone(0.8)] },
      ],
      outro: [tone(0.6)],
      title: "Test: two chapters",
    });
    const head = new TextDecoder("latin1").decode(result.mp3.slice(0, 4096));
    // Written to a file, so ffmpeg could fill in the Info (CBR Xing) header.
    expect(head.includes("Info") || head.includes("Xing")).toBe(true);
    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0]?.startS).toBeGreaterThan(1);
    expect(result.chapters[1]?.startS).toBeGreaterThan(result.chapters[0]?.endS ?? 0);
    expect(result.chapters[0]?.lineStarts[1]).toBeCloseTo((result.chapters[0]?.startS ?? 0) + 0.5 + 0.28, 2);

    // Decoded length matches the computed duration (timings line up with what plays).
    const decoded = await decodeToPcm(ffmpegPath, result.mp3);
    expect(Math.abs(decoded.length / SAMPLE_RATE - result.durationS)).toBeLessThan(0.15);
    // Two-pass linear loudnorm lifts the quiet tone.
    const peak = decoded.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak).toBeGreaterThan(0.1);
  });

  it("still encodes pure silence (loudness can't be measured)", async () => {
    const silent = new Float32Array(SAMPLE_RATE);
    const result = await assembleEpisode({ ffmpegPath, intro: [silent], chapters: [{ title: "x", clips: [silent] }], outro: [], title: "Silent" });
    expect(result.mp3.byteLength).toBeGreaterThan(1000);
  });
});

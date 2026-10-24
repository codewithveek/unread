import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createKokoroProvider, KOKORO_FREE_VOICES } from "@unread/core/voice";

/** One-off: short MP3 previews of the free voices for the picker (apps/web/public/voices). */
async function main() {
  const out = join(import.meta.dirname, "../../../web/public/voices");
  mkdirSync(out, { recursive: true });
  const kokoro = createKokoroProvider({ modelId: "onnx-community/Kokoro-82M-v1.0-ONNX", concurrency: 1 });
  for (const voice of KOKORO_FREE_VOICES) {
    const clip = await kokoro.synthesize({
      voiceId: voice.id,
      text: "Good morning. This is Unread: your newsletters, minus the overlap, in a few minutes of audio.",
    });
    const mp3 = spawnSync(
      process.env.FFMPEG_PATH ?? "ffmpeg",
      ["-hide_banner", "-loglevel", "error", "-f", "f32le", "-ar", "24000", "-ac", "1", "-i", "pipe:0", "-af", "loudnorm=I=-16:TP=-1.5", "-ar", "44100", "-b:a", "64k", "-f", "mp3", "pipe:1"],
      { input: Buffer.from(clip.samples.buffer) },
    );
    writeFileSync(join(out, `${voice.id}.mp3`), mp3.stdout);
    console.log(voice.id, mp3.stdout.byteLength);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

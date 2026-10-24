import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { createElevenLabsProvider, type ElevenLabsApi, pcm16ToFloat32, VoiceNotConfiguredError, voiceProviderFor } from "../src/voice";

describe("ElevenLabs provider", () => {
  it("decodes 16-bit PCM", () => {
    const bytes = new Uint8Array(new Int16Array([0, 16384, -32768, 32767]).buffer);
    expect(Array.from(pcm16ToFloat32(bytes))).toEqual([0, 0.5, -1, 32767 / 32768]);
  });

  it("uses Flash by default and Studio (eleven_v4) when asked, with request stitching", async () => {
    const calls: { voiceId: string; request: Record<string, unknown> }[] = [];
    const api: ElevenLabsApi = {
      textToSpeech: {
        async convert(voiceId, request) {
          calls.push({ voiceId, request });
          return new Response(new Uint8Array(new Int16Array(2400).buffer)).body as ReadableStream<Uint8Array>;
        },
      },
    };
    const flash = createElevenLabsProvider({ api, quality: "flash" });
    const clip = await flash.synthesize({ text: "Second line.", voiceId: "voice123456", previousText: "First line.", nextText: "Third." });
    expect(clip).toMatchObject({ sampleRate: 24_000 });
    expect(clip.samples.length).toBe(2400);
    expect(calls[0]).toEqual({
      voiceId: "voice123456",
      request: { text: "Second line.", modelId: "eleven_flash_v2_5", outputFormat: "pcm_24000", previousText: "First line.", nextText: "Third." },
    });
    expect(flash.centsPer1kChars).toBe(4);
    const studio = createElevenLabsProvider({ api, quality: "studio" });
    expect([studio.model, studio.centsPer1kChars]).toEqual(["eleven_v4", 8]);
  });

  it("refuses to run without a key", () => {
    const config = loadConfig({ DATABASE_URL: "postgres://x:y@localhost/z" });
    expect(() => voiceProviderFor("elevenlabs", config)).toThrow(VoiceNotConfiguredError);
  });

  it("prefers PG_URL over DATABASE_URL", () => {
    expect(loadConfig({ PG_URL: "postgres://a@tiger/db", DATABASE_URL: "postgres://b@local/db" }).env.DATABASE_URL).toBe("postgres://a@tiger/db");
    expect(loadConfig({ DATABASE_URL: "postgres://b@local/db" }).env.DATABASE_URL).toBe("postgres://b@local/db");
  });
});

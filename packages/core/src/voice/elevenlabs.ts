import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { pcm16ToFloat32, readAll } from "./pcm";
import { SAMPLE_RATE, type SynthesizeRequest, type VoiceClip, type VoiceProvider, VoiceNotConfiguredError } from "./voice-provider";

/**
 * prd §8: Flash by default; "Studio voices" use ElevenLabs' highest-quality
 * model (eleven_v4 supersedes Multilingual v2/v3, ADR 0006). Cents are list
 * prices per 1K characters (verify before launch).
 */
export const ELEVENLABS_MODELS = {
  flash: { id: "eleven_flash_v2_5", centsPer1kChars: 4 },
  studio: { id: "eleven_v4", centsPer1kChars: 8 },
} as const;

export type ElevenLabsQuality = keyof typeof ELEVENLABS_MODELS;

/** Default voice until the user picks one: George (narrative). */
export const DEFAULT_ELEVENLABS_VOICE = "JBFqnCBsd6RMkjVDRZzb";

/** The parts of the SDK we use, so tests can stand in for the API. */
export interface ElevenLabsApi {
  textToSpeech: {
    convert(
      voiceId: string,
      request: { text: string; modelId: string; outputFormat: "pcm_24000"; previousText?: string; nextText?: string },
    ): Promise<ReadableStream<Uint8Array>>;
  };
}

/** The SDK reads ELEVENLABS_API_KEY from the environment; the key never goes in code. */
export function elevenLabsClient(apiKey?: string): ElevenLabsClient {
  if (!apiKey) throw new VoiceNotConfiguredError("ElevenLabs isn't set up (ELEVENLABS_API_KEY)");
  return new ElevenLabsClient({ apiKey });
}

export function createElevenLabsProvider(options: { api: ElevenLabsApi; quality: ElevenLabsQuality; concurrency?: number }): VoiceProvider {
  const model = ELEVENLABS_MODELS[options.quality];
  return {
    id: "elevenlabs",
    model: model.id,
    centsPer1kChars: model.centsPer1kChars,
    concurrency: options.concurrency ?? 4,
    async synthesize(request: SynthesizeRequest): Promise<VoiceClip> {
      // Request stitching: neighbouring lines keep tone and pacing continuous across clips.
      const stream = await options.api.textToSpeech.convert(request.voiceId, {
        text: request.text,
        modelId: model.id,
        outputFormat: "pcm_24000",
        ...(request.previousText ? { previousText: request.previousText } : {}),
        ...(request.nextText ? { nextText: request.nextText } : {}),
      });
      return { samples: pcm16ToFloat32(await readAll(stream)), sampleRate: SAMPLE_RATE };
    },
  };
}

export interface StudioVoice {
  id: string;
  name: string;
  description: string;
  previewUrl: string | null;
}

/** Voices for the Plus picker (prd §8.1): the account's voices, including library voices it has added. */
export async function listStudioVoices(client: ElevenLabsClient): Promise<StudioVoice[]> {
  const voices: StudioVoice[] = [];
  let nextPageToken: string | undefined;
  do {
    const page = await client.voices.search({ pageSize: 100, ...(nextPageToken ? { nextPageToken } : {}) });
    for (const v of page.voices) {
      const labels = v.labels ?? {};
      voices.push({
        id: v.voiceId,
        name: v.name ?? v.voiceId,
        description: [labels.gender, labels.accent, labels.descriptive ?? labels.description, labels.use_case].filter(Boolean).join(" · "),
        previewUrl: v.previewUrl ?? null,
      });
    }
    nextPageToken = page.hasMore ? page.nextPageToken : undefined;
  } while (nextPageToken && voices.length < 500);
  return voices;
}

/** The fixed SFX set (prd §8.1), generated once and reused on every plan. */
export const SFX_PROMPTS = {
  "sfx-intro": { text: "Short warm podcast intro sting, soft synth swell with a gentle bell, modern and clean, no voice", durationSeconds: 2.5 },
  "sfx-transition": { text: "Subtle soft whoosh transition for a podcast, airy and clean, no voice", durationSeconds: 1 },
  "sfx-outro": { text: "Short gentle podcast outro sting, warm synth resolving chord, calm, no voice", durationSeconds: 2.5 },
} as const;

export async function generateSoundEffect(client: ElevenLabsClient, key: keyof typeof SFX_PROMPTS): Promise<Uint8Array> {
  const prompt = SFX_PROMPTS[key];
  const stream = await client.textToSoundEffects.convert({
    text: prompt.text,
    durationSeconds: prompt.durationSeconds,
    promptInfluence: 0.6,
    outputFormat: "mp3_44100_128",
  });
  return readAll(stream);
}

/** The "Upgrade to Studio voices" sample: the same intro in a Studio voice (prd §8.1). */
export const STUDIO_PREVIEW_TEXT =
  "This is Unread for Saturday. Six stories today, from Morning Brew, The Hustle and your saved links. Here's the first one.";

export async function generateStudioPreview(client: ElevenLabsClient, voiceId: string): Promise<Uint8Array> {
  const stream = await client.textToSpeech.convert(voiceId, {
    text: STUDIO_PREVIEW_TEXT,
    modelId: ELEVENLABS_MODELS.studio.id,
    outputFormat: "mp3_44100_128",
  });
  return readAll(stream);
}

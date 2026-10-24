import type { VoiceProvider as VoiceProviderId } from "@unread/db";
import type { CoreConfig } from "../config";
import { createElevenLabsProvider, type ElevenLabsQuality, elevenLabsClient } from "./elevenlabs";
import { createKokoroProvider } from "./kokoro";
import type { VoiceProvider } from "./voice-provider";

export * from "./cache";
export * from "./elevenlabs";
export * from "./pcm";
export * from "./kokoro";
export * from "./voice-provider";
export * from "./voices";

/** Provider for the user's effective plan (prd §8.1); Studio quality only matters for ElevenLabs. */
export function voiceProviderFor(id: VoiceProviderId, config: CoreConfig, options: { quality?: ElevenLabsQuality } = {}): VoiceProvider {
  if (id === "kokoro") {
    return createKokoroProvider({
      modelId: config.env.KOKORO_MODEL,
      concurrency: config.env.KOKORO_CONCURRENCY,
      cacheDir: config.env.MODEL_CACHE_DIR,
    });
  }
  return createElevenLabsProvider({ api: elevenLabsClient(config.env.ELEVENLABS_API_KEY), quality: options.quality ?? "flash" });
}

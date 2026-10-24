import type { VoiceProvider as VoiceProviderId } from "@unread/db";
import type { CoreConfig } from "../config";
import { createKokoroProvider } from "./kokoro";
import { type VoiceProvider, VoiceNotConfiguredError } from "./voice-provider";

export * from "./cache";
export * from "./kokoro";
export * from "./voice-provider";
export * from "./voices";

/** Provider for the user's effective plan (prd §8.1). */
export function voiceProviderFor(id: VoiceProviderId, config: CoreConfig): VoiceProvider {
  if (id === "kokoro") {
    return createKokoroProvider({ modelId: config.env.KOKORO_MODEL, concurrency: config.env.KOKORO_CONCURRENCY });
  }
  throw new VoiceNotConfiguredError("ElevenLabs isn't set up yet (ELEVENLABS_API_KEY)");
}

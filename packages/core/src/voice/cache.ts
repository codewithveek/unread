import { type Storage, storageKeys } from "../storage";
import { sha256Hex } from "../util/hash";
import type { SynthesizeRequest, VoiceClip, VoiceProvider } from "./voice-provider";

function toBytes(samples: Float32Array): Uint8Array {
  return new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
}

/**
 * Cache clips by text + voice + provider + model (prd §6 step 7), so retries
 * and re-runs never pay twice.
 */
export function withVoiceCache(provider: VoiceProvider, storage: Storage): VoiceProvider {
  return {
    ...provider,
    async synthesize(request: SynthesizeRequest): Promise<VoiceClip> {
      const key = storageKeys.voiceCache(sha256Hex(`${provider.id}|${provider.model}|${request.voiceId}|${request.text}`));
      const cached = await storage.get(key);
      if (cached) {
        const copy = cached.slice().buffer;
        return { samples: new Float32Array(copy), sampleRate: 24_000 };
      }
      const clip = await provider.synthesize(request);
      await storage.put(key, toBytes(clip.samples), "application/octet-stream");
      return clip;
    },
  };
}

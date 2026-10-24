import { tmpdir } from "node:os";
import { join } from "node:path";
import { SAMPLE_RATE, type SynthesizeRequest, type VoiceClip, type VoiceProvider } from "./voice-provider";
import { KOKORO_FREE_VOICES } from "./voices";

type KokoroModel = {
  generate(text: string, options: { voice: string; speed?: number }): Promise<{ audio: Float32Array; sampling_rate: number }>;
};

let loading: Promise<KokoroModel> | undefined;

/** Kokoro-82M (Apache-2.0) on the worker's CPU via kokoro-js (ADR 0006). */
export function createKokoroProvider(options: { modelId: string; concurrency: number; cacheDir?: string }): VoiceProvider {
  const load = async () => {
    const transformers = await import("@huggingface/transformers");
    transformers.env.cacheDir = options.cacheDir ?? join(tmpdir(), "unread-models");
    const { KokoroTTS } = await import("kokoro-js");
    return (await KokoroTTS.from_pretrained(options.modelId, { dtype: "q8", device: "cpu" })) as unknown as KokoroModel;
  };
  return {
    id: "kokoro",
    model: "kokoro-82m-v1.0-q8",
    centsPer1kChars: 0,
    concurrency: options.concurrency,
    async synthesize(request: SynthesizeRequest): Promise<VoiceClip> {
      loading ??= load();
      const tts = await loading;
      const voice = KOKORO_FREE_VOICES.some((v) => v.id === request.voiceId) ? request.voiceId : "af_heart";
      const audio = await tts.generate(request.text, { voice });
      if (audio.sampling_rate !== SAMPLE_RATE) throw new Error(`Unexpected Kokoro sample rate ${audio.sampling_rate}`);
      return { samples: audio.audio, sampleRate: audio.sampling_rate };
    },
  };
}

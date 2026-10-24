import type { VoiceProvider as VoiceProviderId } from "@unread/db";

/** Mono float PCM at `sampleRate`. Everything is resampled to 24 kHz before assembly. */
export interface VoiceClip {
  samples: Float32Array;
  sampleRate: number;
}

export interface SynthesizeRequest {
  text: string;
  voiceId: string;
  /** Neighbouring text, for providers that support continuity between requests. */
  previousText?: string;
  nextText?: string;
}

/** prd §8.1: the pipeline picks a provider by effective plan; voice code never checks plans. */
export interface VoiceProvider {
  readonly id: VoiceProviderId;
  readonly model: string;
  /** Estimated cost in US cents per 1,000 characters (0 for Kokoro). */
  readonly centsPer1kChars: number;
  /** Jobs this provider can run at once. */
  readonly concurrency: number;
  synthesize(request: SynthesizeRequest): Promise<VoiceClip>;
}

export class VoiceNotConfiguredError extends Error {}

export const SAMPLE_RATE = 24_000;

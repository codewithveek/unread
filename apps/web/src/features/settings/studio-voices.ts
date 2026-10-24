import "server-only";
import { DEFAULT_ELEVENLABS_VOICE, elevenLabsClient, listStudioVoices, type StudioVoice } from "@unread/core/voice/elevenlabs";
import { serverEnv } from "@/lib/env";

let cache: { at: number; voices: StudioVoice[] } | undefined;
const TTL_MS = 60 * 60 * 1000;

/** The Plus voice library (cached for an hour). Empty when ElevenLabs isn't configured or is down. */
export async function studioVoices(): Promise<StudioVoice[]> {
  const key = serverEnv().ELEVENLABS_API_KEY;
  if (!key) return [];
  if (cache && Date.now() - cache.at < TTL_MS) return cache.voices;
  try {
    const voices = await listStudioVoices(elevenLabsClient(key));
    cache = { at: Date.now(), voices };
    return voices;
  } catch (error) {
    console.error("Could not list ElevenLabs voices", error);
    return cache?.voices ?? [];
  }
}

export async function isStudioVoice(id: string): Promise<boolean> {
  return id === DEFAULT_ELEVENLABS_VOICE || (await studioVoices()).some((v) => v.id === id);
}

export { DEFAULT_ELEVENLABS_VOICE };

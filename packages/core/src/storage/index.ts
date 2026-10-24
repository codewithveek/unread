import type { CoreConfig } from "../config";
import { createLocalStorage } from "./local-storage";
import { createS3Storage } from "./s3-storage";
import type { Storage } from "./storage";

export * from "./storage";
export { createLocalStorage } from "./local-storage";
export { createS3Storage } from "./s3-storage";

export function storageFromConfig(config: CoreConfig): Storage {
  const s = config.storage;
  if (s.driver === "s3") return createS3Storage(s);
  return createLocalStorage(s.dir);
}

/** Storage keys, in one place so deletion by user prefix stays correct. */
export const storageKeys = {
  userPrefix: (userId: string) => `users/${userId}/`,
  rawEmail: (userId: string, inboundId: string) => `users/${userId}/raw/${inboundId}.eml`,
  episodeAudio: (userId: string, episodeId: string) => `users/${userId}/episodes/${episodeId}/audio.mp3`,
  episodeCover: (userId: string, episodeId: string, size: number) =>
    `users/${userId}/episodes/${episodeId}/cover-${size}.png`,
  stepOutput: (userId: string, episodeId: string, step: string) =>
    `users/${userId}/episodes/${episodeId}/steps/${step}.json`,
  voiceCache: (hash: string) => `cache/voice/${hash.slice(0, 2)}/${hash}.wav`,
  asset: (name: string) => `assets/${name}`,
};

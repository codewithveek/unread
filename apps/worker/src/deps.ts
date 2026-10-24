import type { EpisodeDeps } from "@unread/core/episodes";
import { type VoiceProvider, voiceProviderFor } from "@unread/core/voice";
import { workerContext } from "./context";

export function episodeDeps(): EpisodeDeps {
  const ctx = workerContext();
  const providers = new Map<string, VoiceProvider>();
  return {
    config: ctx.config,
    db: ctx.db,
    storage: ctx.storage,
    model: ctx.model,
    embedder: ctx.embedder,
    voiceFor: (id, options = {}) => {
      const key = `${id}:${options.quality ?? "flash"}`;
      const existing = providers.get(key);
      if (existing) return existing;
      const provider = voiceProviderFor(id, ctx.config, options);
      providers.set(key, provider);
      return provider;
    },
  };
}

import type { EpisodeDeps } from "@unread/core/episodes";
import { voiceProviderFor } from "@unread/core/voice";
import { workerContext } from "./context";

export function episodeDeps(): EpisodeDeps {
  const ctx = workerContext();
  const providers = new Map<string, ReturnType<typeof voiceProviderFor>>();
  return {
    config: ctx.config,
    db: ctx.db,
    storage: ctx.storage,
    model: ctx.model,
    embedder: ctx.embedder,
    voiceFor: (id) => {
      const existing = providers.get(id);
      if (existing) return existing;
      const provider = voiceProviderFor(id, ctx.config);
      providers.set(id, provider);
      return provider;
    },
  };
}

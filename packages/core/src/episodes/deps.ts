import type { Database, VoiceProvider as VoiceProviderId } from "@unread/db";
import type { CoreConfig } from "../config";
import type { Embedder } from "../embeddings";
import type { ModelClient } from "../model";
import type { Storage } from "../storage";
import type { ElevenLabsQuality, VoiceProvider } from "../voice";

export interface EpisodeDeps {
  config: CoreConfig;
  db: Database;
  storage: Storage;
  model: () => ModelClient;
  embedder: Embedder;
  voiceFor: (id: VoiceProviderId, options?: { quality?: ElevenLabsQuality }) => VoiceProvider;
  now?: () => Date;
}

import { type CoreConfig, loadConfig } from "@unread/core/config";
import { createEmbeddingGemma, type Embedder } from "@unread/core/embeddings";
import { type ModelClient, modelClientFromConfig } from "@unread/core/model";
import { type Storage, storageFromConfig } from "@unread/core/storage";
import { createDb, type Database } from "@unread/db";

export interface WorkerContext {
  config: CoreConfig;
  db: Database;
  storage: Storage;
  model: () => ModelClient;
  embedder: Embedder;
}

let cached: WorkerContext | undefined;

/** Lazily built dependencies shared by CLIs, Temporal activities and the poller. */
export function workerContext(): WorkerContext {
  if (cached) return cached;
  const config = loadConfig();
  let model: ModelClient | undefined;
  cached = {
    config,
    db: createDb({ url: config.env.DATABASE_URL, max: 5 }),
    storage: storageFromConfig(config),
    model: () => (model ??= modelClientFromConfig(config)),
    embedder: createEmbeddingGemma({ modelId: config.env.EMBEDDING_MODEL }),
  };
  return cached;
}

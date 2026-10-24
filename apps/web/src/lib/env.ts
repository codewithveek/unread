import "server-only";
import { type CoreConfig, loadConfig } from "@unread/core/config";

let cached: CoreConfig | undefined;

/** Validated config shared with the worker. Read lazily so `next build` works without secrets. */
export function coreConfig(): CoreConfig {
  cached ??= loadConfig();
  return cached;
}

export function serverEnv(): CoreConfig["env"] {
  return coreConfig().env;
}

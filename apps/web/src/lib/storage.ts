import "server-only";
import { type Storage, storageFromConfig } from "@unread/core/storage";
import { coreConfig } from "./env";

let cached: Storage | undefined;

export function storage(): Storage {
  cached ??= storageFromConfig(coreConfig());
  return cached;
}

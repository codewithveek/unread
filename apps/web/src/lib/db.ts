import "server-only";
import { createDb, type Database } from "@unread/db";
import { serverEnv } from "./env";

const globalForDb = globalThis as unknown as { unreadDb?: Database };

/** One pool per server process (survives dev hot reloads). */
export function db(): Database {
  globalForDb.unreadDb ??= createDb({ url: serverEnv().DATABASE_URL });
  return globalForDb.unreadDb;
}

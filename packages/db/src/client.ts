import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

export interface CreateDbOptions {
  url: string;
  /** Max pool size. Keep small on Render's starter plans. */
  max?: number;
  /** Disable prepared statements when going through a transaction-mode pooler. */
  prepare?: boolean;
}

export function createDb({ url, max = 5, prepare = true }: CreateDbOptions) {
  const sql = postgres(url, { max, prepare });
  return drizzle({ client: sql, schema, casing: "snake_case" });
}

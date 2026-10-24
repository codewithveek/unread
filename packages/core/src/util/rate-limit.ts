import { type Database, schema } from "@unread/db";
import { sql } from "drizzle-orm";

/**
 * Fixed-window limiter in Postgres (works across instances). Returns true
 * when the hit is allowed. Key examples: `paste:<userId>`, `promo:<userId>`.
 */
export async function rateLimit(options: { db: Database; key: string; limit: number; windowSeconds: number; now?: Date }): Promise<boolean> {
  const now = options.now ?? new Date();
  const windowMs = options.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const [row] = await options.db
    .insert(schema.rateLimitHits)
    .values({ key: options.key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [schema.rateLimitHits.key, schema.rateLimitHits.windowStart],
      set: { count: sql`${schema.rateLimitHits.count} + 1` },
    })
    .returning({ count: schema.rateLimitHits.count });
  return (row?.count ?? 1) <= options.limit;
}

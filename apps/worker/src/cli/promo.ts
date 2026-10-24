import { normalizeCode } from "@unread/core/promo";
import { schema } from "@unread/db";
import { desc } from "drizzle-orm";
import { workerContext } from "../context";
import { parseArgs } from "./args";

/**
 * `pnpm promo create --code HACK2026 --days 14 --episodes 3 [--max 200] [--expires 2026-12-31] [--note "..."]`
 * `pnpm promo list`
 */
async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const { db } = workerContext();
  if (command === "create") {
    const code = normalizeCode(args.get("code") ?? "");
    if (!code) throw new Error("--code is required");
    const [row] = await db
      .insert(schema.promoCodes)
      .values({
        code,
        trialDays: Number(args.get("days") ?? 14),
        trialEpisodeLimit: Number(args.get("episodes") ?? 3),
        maxRedemptions: args.has("max") ? Number(args.get("max")) : null,
        expiresAt: args.has("expires") ? new Date(String(args.get("expires"))) : null,
        note: args.get("note") ?? null,
      })
      .returning();
    console.log(JSON.stringify(row, null, 2));
  } else if (command === "list") {
    for (const c of await db.select().from(schema.promoCodes).orderBy(desc(schema.promoCodes.createdAt))) {
      console.log(`${c.code}\t${c.trialDays}d\t${c.trialEpisodeLimit} eps\t${c.redeemedCount}/${c.maxRedemptions ?? "∞"}\t${c.active ? "active" : "off"}`);
    }
  } else {
    console.error("Usage: pnpm promo create --code CODE --days 14 --episodes 3 [--max N] [--expires YYYY-MM-DD] | pnpm promo list");
    process.exit(2);
  }
  await db.$client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

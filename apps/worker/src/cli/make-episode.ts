import { makeEpisode, requestEpisodeNow } from "@unread/core/episodes";
import { schema } from "@unread/db";
import { eq } from "drizzle-orm";
import { workerContext } from "../context";
import { episodeDeps } from "../deps";
import { parseArgs } from "./args";

/** `pnpm make-episode --user <id>`: make and publish one episode now, in this process. */
async function main() {
  const userId = parseArgs(process.argv.slice(2)).get("user");
  if (!userId) {
    console.error("Usage: pnpm make-episode --user <userId>");
    process.exit(2);
  }
  const { db } = workerContext();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) throw new Error(`No user ${userId}`);
  const requestId = await requestEpisodeNow({ db, userId, timezone: user.timezone, now: new Date(), dailyLimit: 100 });
  const started = Date.now();
  const result = await makeEpisode(episodeDeps(), requestId);
  console.log(JSON.stringify({ ...result, seconds: Math.round((Date.now() - started) / 1000) }, null, 2));
  await db.$client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

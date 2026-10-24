import { buildScript } from "@unread/core/pipeline";
import { loadPlanContext } from "@unread/core/plans";
import { spokenDate } from "@unread/core/util/dates";
import { workerContext } from "../context";
import { parseArgs } from "./args";

/**
 * `pnpm brief --user <id>`: run pipeline steps 1–6 and print the script JSON
 * (prd §13 U2). Doesn't mark anything used and doesn't voice anything.
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const userId = args.get("user");
  if (!userId) {
    console.error("Usage: pnpm brief --user <userId> [--chars 9000]");
    process.exit(2);
  }
  const ctx = workerContext();
  const now = new Date();
  const { user, plan, budget } = await loadPlanContext({ db: ctx.db, userId, now });
  const maxChars = Number(args.get("chars") ?? budget.maxChars);
  const result = await buildScript({
    db: ctx.db,
    model: ctx.model(),
    embedder: ctx.embedder,
    userId,
    maxChars,
    dateLabel: spokenDate(now, user.timezone),
    now,
  });
  const { clusters: _clusters, ...printable } = result;
  console.log(JSON.stringify({ planSource: plan.source, voice: plan.voiceProvider, maxChars, ...printable }, null, 2));
  await ctx.db.$client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

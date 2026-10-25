import { claimNextRequest, dispatchDueRequests, makeEpisode, recoverOrphanedRequests } from "@unread/core/episodes";
import { workerContext } from "./context";
import { episodeDeps } from "./deps";
import { runMaintenance } from "./maintenance";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * No Temporal (cut line, prd §13): dispatch due users every minute and work
 * through pending requests one at a time, with the same step functions.
 */
export async function runPoller(options: { once?: boolean } = {}): Promise<void> {
  const { db } = workerContext();
  let lastMaintenance = 0;
  let stopping = false;
  process.on("SIGTERM", () => {
    stopping = true;
  });
  console.log("Polling for episode requests (no TEMPORAL_ADDRESS)");
  // We're the only runner, so anything still "running" was cut off by a crash or redeploy.
  await recoverOrphanedRequests({ db, now: new Date() })
    .then((r) => console.log(JSON.stringify({ event: "recovered", ...r })))
    .catch((e) => console.error("recovery failed", e));
  while (!stopping) {
    await dispatchDueRequests({ db, now: new Date() }).catch((e) => console.error("dispatch failed", e));
    try {
      for (let requestId = await claimNextRequest(db); requestId && !stopping; requestId = await claimNextRequest(db)) {
        const started = Date.now();
        try {
          const result = await makeEpisode(episodeDeps(), requestId);
          console.log(JSON.stringify({ event: "episode", requestId, ...result, ms: Date.now() - started }));
        } catch (error) {
          // Failed before an episode existed (e.g. the DB dropped). Leave it "running": the
          // next start-up re-queues it, or maintenance fails it after two hours.
          console.error(JSON.stringify({ event: "episode_error", requestId, error: String(error) }));
        }
      }
    } catch (error) {
      console.error("claim failed", error);
    }
    if (Date.now() - lastMaintenance > 3_600_000) {
      lastMaintenance = Date.now();
      await runMaintenance()
        .then((r) => console.log(JSON.stringify({ event: "maintenance", ...r })))
        .catch((e) => console.error("maintenance failed", e));
    }
    if (options.once) return;
    await sleep(30_000);
  }
}

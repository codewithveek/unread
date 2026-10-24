import { workerContext } from "./context";
import { runPoller } from "./poller";

/** Render background worker entry point. */
async function main() {
  const { config } = workerContext();
  if (config.env.TEMPORAL_ADDRESS) {
    const { runTemporalWorker } = await import("./temporal/worker");
    await runTemporalWorker();
  } else {
    await runPoller();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

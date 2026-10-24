import { runPoller } from "../poller";

/** `pnpm dispatch`: one poller pass (for a Render cron job instead of a long-running worker). */
runPoller({ once: true })
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

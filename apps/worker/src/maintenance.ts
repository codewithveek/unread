import { failStaleRequests } from "@unread/core/episodes/requests";
import { purgeRawEmails } from "@unread/core/inbound";
import { workerContext } from "./context";

/** Hourly housekeeping: raw email retention (prd §10), trial lifecycle (promo module) and stuck episode requests. */
export async function runMaintenance(): Promise<Record<string, number>> {
  const ctx = workerContext();
  const purged = await purgeRawEmails({ db: ctx.db, storage: ctx.storage });
  const { runTrialLifecycle } = await import("@unread/core/promo");
  const trials = await runTrialLifecycle({ db: ctx.db, config: ctx.config, now: new Date() });
  const stale = await failStaleRequests({ db: ctx.db, now: new Date() });
  return { purged, stale, ...trials };
}

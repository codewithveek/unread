import { Context } from "@temporalio/activity";
import {
  dispatchDueRequests,
  failEpisode,
  pendingRequestIds,
  prepareScript,
  publishEpisode,
  renderEpisodeCover,
  startEpisode,
  voiceEpisode,
} from "@unread/core/episodes";
import { episodeDeps } from "../deps";
import { runMaintenance } from "../maintenance";

/**
 * Each activity is idempotent (keyed by episode + step outputs in storage),
 * so Temporal retries are safe (prd §6).
 */
export const activities = {
  async startEpisode(requestId: string) {
    return startEpisode(episodeDeps(), requestId);
  },
  async prepareScript(episodeId: string) {
    return prepareScript(episodeDeps(), episodeId);
  },
  async voiceEpisode(episodeId: string) {
    const ctx = Context.current();
    await voiceEpisode(episodeDeps(), episodeId, (detail) => ctx.heartbeat(detail));
  },
  async renderEpisodeCover(episodeId: string) {
    await renderEpisodeCover(episodeDeps(), episodeId);
  },
  async publishEpisode(episodeId: string) {
    await publishEpisode(episodeDeps(), episodeId);
  },
  async failEpisode(episodeId: string, message: string) {
    await failEpisode(episodeDeps(), episodeId, new Error(message));
  },
  /** New scheduled requests plus any pending ones nobody started (e.g. Temporal was briefly down). */
  async dispatch(): Promise<string[]> {
    const deps = episodeDeps();
    const created = await dispatchDueRequests({ db: deps.db, now: new Date() });
    const pending = await pendingRequestIds(deps.db);
    return [...new Set([...created, ...pending])];
  },
  async maintenance() {
    return runMaintenance();
  },
};

export type Activities = typeof activities;

import type { Database } from "@unread/db";
import type { Embedder } from "../embeddings";
import type { ModelClient } from "../model";
import { type CheckReport, checkScript } from "./check";
import { embedAndCluster } from "./cluster";
import { collectCandidates } from "./collect";
import { planEpisode } from "./plan";
import { writeScript } from "./script";
import { loadSkipRates } from "./signals";
import type { Cluster, EpisodePlan, EpisodeScript } from "./types";

export interface BuildScriptResult {
  status: "ok" | "not_enough_content";
  script: EpisodeScript | null;
  plan: EpisodePlan | null;
  clusters: Cluster[];
  check: Omit<CheckReport, "script"> | null;
  stats: { candidates: number; heard: number; clusters: number; merged: number; timingsMs: Record<string, number> };
}

/** Minimum new items to bother making an episode (prd §6). */
export const MIN_NEW_ITEMS = 2;

/** Steps 1–6 of the pipeline as plain functions (prd §13 U2). */
export async function buildScript(options: {
  db: Database;
  model: ModelClient;
  embedder: Embedder;
  userId: string;
  maxChars: number;
  dateLabel: string;
  now: Date;
  newsMode?: "always" | "fill";
}): Promise<BuildScriptResult> {
  const timingsMs: Record<string, number> = {};
  const time = async <T>(step: string, fn: () => Promise<T>): Promise<T> => {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      timingsMs[step] = Date.now() - start;
    }
  };
  const { db, model, embedder, userId, now } = options;

  const candidates = await time("collect", () => collectCandidates({ db, userId, now, newsMode: options.newsMode }));
  const empty = (heard = 0): BuildScriptResult => ({
    status: "not_enough_content",
    script: null,
    plan: null,
    clusters: [],
    check: null,
    stats: { candidates: candidates.length, heard, clusters: 0, merged: 0, timingsMs },
  });
  if (candidates.length < MIN_NEW_ITEMS) return empty();

  const { clusters, heardItemIds } = await time("cluster", () =>
    embedAndCluster({ db, embedder, model, userId, candidates }),
  );
  if (clusters.length === 0) return empty(heardItemIds.length);

  const skipRates = await loadSkipRates(db, userId);
  const plan = await time("plan", () => planEpisode({ model, clusters, maxChars: options.maxChars, skipRates, now }));
  const draft = await time("script", () => writeScript({ model, plan, clusters, dateLabel: options.dateLabel }));

  const sourceText = new Map(clusters.flatMap((c) => c.items.map((i) => [i.id, `${i.title}\n${i.text}`] as const)));
  const report = await time("check", () => checkScript({ model, script: draft, sourceText, maxChars: options.maxChars }));
  const { script, ...check } = report;
  if (script.chapters.length === 0) return empty(heardItemIds.length);

  return {
    status: "ok",
    script,
    plan,
    clusters,
    check,
    stats: {
      candidates: candidates.length,
      heard: heardItemIds.length,
      clusters: clusters.length,
      merged: clusters.filter((c) => c.items.length > 1).length,
      timingsMs,
    },
  };
}

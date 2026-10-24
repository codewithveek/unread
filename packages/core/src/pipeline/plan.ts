import { z } from "zod";
import { generateStructured, type ModelClient } from "../model";
import type { Cluster, EpisodePlan, Priority } from "./types";

export const INTRO_OUTRO_CHARS = 450;
export const MIN_CHAPTER_CHARS = 450;
export const MAX_CHAPTER_CHARS = 1_800;

const TIER: Record<Priority, number> = { always: 0, normal: 1, if_room: 2 };

/** Listening signal per source label: share of chapters skipped (0..1). */
export type SkipRates = Map<string, number>;

const rankSchema = z.object({ order: z.array(z.string()).min(1) });

function sourceChars(cluster: Cluster): number {
  return cluster.items.reduce((sum, i) => sum + Math.min(i.text.length, 4000), 0);
}

function desiredChars(cluster: Cluster): number {
  const base = Math.round(sourceChars(cluster) * 0.28) + (cluster.items.length - 1) * 180;
  return Math.max(MIN_CHAPTER_CHARS, Math.min(MAX_CHAPTER_CHARS, base));
}

/** Gemma orders the stories by how much this listener will care; code keeps priority tiers. */
async function gemmaOrder(model: ModelClient, clusters: Cluster[], skipRates: SkipRates, now: Date): Promise<string[]> {
  const keyed = clusters.map((c, i) => ({ k: `K${i + 1}`, c }));
  const lines = keyed.map(({ k, c }) => {
    const primary = c.items[0];
    const hours = primary?.publishedAt ? Math.round((now.getTime() - primary.publishedAt.getTime()) / 3_600_000) : null;
    const skip = Math.max(...c.items.map((i) => skipRates.get(i.sourceLabel) ?? 0));
    return [
      `${k}: ${primary?.title ?? ""}`,
      `   sources: ${c.items.map((i) => i.sourceLabel).join(", ")}; priority: ${c.priority}`,
      `   age: ${hours ?? "?"}h; listener skips this source ${Math.round(skip * 100)}% of the time`,
      `   ${primary?.text.replace(/\s+/g, " ").slice(0, 280) ?? ""}`,
    ].join("\n");
  });
  const result = await generateStructured({
    client: model,
    system:
      "You are the editor of Unread, a short personal podcast made from the listener's own newsletters. Rank stories for one episode: substance and novelty first, stories covered by several sources are usually more important, fresher beats older, and sources the listener often skips rank lower. Ignore pure promotions.",
    prompt: `${lines.join("\n\n")}\n\nReturn {"order": [every key, best first]}.`,
    schema: rankSchema,
    validate: (v) => (v.order.every((k) => keyed.some((x) => x.k === k)) ? null : "Use only the given keys"),
    temperature: 0.2,
    maxTokens: 600,
  });
  const map = new Map(keyed.map(({ k, c }) => [k, c.key]));
  const ordered = result.order.map((k) => map.get(k)).filter((k): k is string => Boolean(k));
  // Anything Gemma left out goes at the end, in input order.
  return [...new Set([...ordered, ...clusters.map((c) => c.key)])];
}

function fallbackOrder(clusters: Cluster[], skipRates: SkipRates): string[] {
  return [...clusters]
    .sort((a, b) => {
      const size = b.items.length - a.items.length;
      if (size !== 0) return size;
      const skip = (skipRates.get(a.items[0]?.sourceLabel ?? "") ?? 0) - (skipRates.get(b.items[0]?.sourceLabel ?? "") ?? 0);
      if (skip !== 0) return skip;
      return (b.items[0]?.publishedAt?.getTime() ?? 0) - (a.items[0]?.publishedAt?.getTime() ?? 0);
    })
    .map((c) => c.key);
}

/**
 * Step 4: rank (sender priority → listening signals → freshness, prd §6) and
 * fit the character budget. "Always" senders and saved links come first;
 * "only if room" senders and news fill what's left.
 */
export async function planEpisode(options: {
  model: ModelClient | null;
  clusters: Cluster[];
  maxChars: number;
  skipRates?: SkipRates;
  now: Date;
}): Promise<EpisodePlan> {
  const { model, clusters, maxChars, now } = options;
  const skipRates = options.skipRates ?? new Map();
  let order: string[];
  try {
    order = model ? await gemmaOrder(model, clusters, skipRates, now) : fallbackOrder(clusters, skipRates);
  } catch {
    order = fallbackOrder(clusters, skipRates);
  }
  const rank = new Map(order.map((k, i) => [k, i]));
  const sorted = [...clusters].sort(
    (a, b) => TIER[a.priority] - TIER[b.priority] || (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0),
  );

  let remaining = maxChars - INTRO_OUTRO_CHARS;
  const chapters: EpisodePlan["chapters"] = [];
  for (const cluster of sorted) {
    if (remaining < MIN_CHAPTER_CHARS) break;
    const target = Math.min(desiredChars(cluster), remaining);
    chapters.push({ clusterKey: cluster.key, targetChars: target });
    remaining -= target;
  }
  // Keep the listener's priority order but present related tiers naturally: as planned.
  return { chapters, maxChars };
}

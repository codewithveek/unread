import { type Database, schema } from "@unread/db";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { cosine, type Embedder } from "../embeddings";
import { generateStructured, type ModelClient } from "../model";
import type { Candidate, Cluster, Priority } from "./types";

/** Calibrated on EmbeddingGemma: same story across outlets ≈ 0.9+, unrelated ≈ 0.3. */
export const SAME_STORY = 0.83;
export const BORDERLINE = 0.72;
export const HEARD = 0.85;

const PRIORITY_RANK: Record<Priority, number> = { always: 0, normal: 1, if_room: 2 };

class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      const p = this.parent[i] ?? i;
      this.parent[i] = this.parent[p] ?? p;
      i = this.parent[i] ?? i;
    }
    return i;
  }
  union(a: number, b: number) {
    this.parent[this.find(a)] = this.find(b);
  }
}

const confirmSchema = z.object({ same: z.array(z.number().int()) });

/** Ask Gemma about pairs embeddings can't decide (prd §6 step 3). */
async function confirmPairs(model: ModelClient, candidates: Candidate[], pairs: [number, number][]): Promise<Set<number>> {
  const describe = (c: Candidate) => `${c.title} — ${c.text.replace(/\s+/g, " ").slice(0, 280)}`;
  const list = pairs
    .map(([a, b], i) => `Pair ${i}:\n  A: ${describe(candidates[a] as Candidate)}\n  B: ${describe(candidates[b] as Candidate)}`)
    .join("\n");
  const result = await generateStructured({
    client: model,
    system:
      "You decide whether two newsletter snippets report the SAME news story (same event, announcement or finding), not just the same topic.",
    prompt: `${list}\n\nReturn {"same": [pair numbers that are the same story]}.`,
    schema: confirmSchema,
    temperature: 0,
    maxTokens: 400,
  });
  return new Set(result.same);
}

export interface ClusterResult {
  clusters: Cluster[];
  /** Items dropped because a similar story was already in an earlier episode. */
  heardItemIds: string[];
}

/**
 * Step 3: embed, drop stories already heard, and merge the same story across
 * newsletters and links into one cluster (P3).
 */
export async function embedAndCluster(options: {
  db: Database;
  embedder: Embedder;
  model: ModelClient | null;
  userId: string;
  candidates: Candidate[];
}): Promise<ClusterResult> {
  const { db, embedder, model, userId } = options;
  const candidates = options.candidates.map((c) => ({ ...c }));

  const missing = candidates.filter((c) => !c.embedding);
  if (missing.length > 0) {
    const vectors = await embedder.embed(missing.map((c) => ({ title: c.title, text: c.text })));
    await Promise.all(
      missing.map(async (c, i) => {
        c.embedding = vectors[i] ?? null;
        if (c.embedding) {
          await db
            .update(schema.items)
            .set({ embedding: c.embedding })
            .where(sql`${schema.items.id} = ${c.id}`);
        }
      }),
    );
  }

  // Already heard: nearest earlier story for this user (pgvector, cosine).
  const heardItemIds: string[] = [];
  const fresh: Candidate[] = [];
  for (const c of candidates) {
    if (!c.embedding) {
      fresh.push(c);
      continue;
    }
    const vector = `[${c.embedding.join(",")}]`;
    const [nearest] = await db.execute<{ similarity: number }>(sql`
      select 1 - (i.embedding <=> ${vector}::vector) as similarity
      from ${schema.heardItems} h
      join ${schema.items} i on i.id = h.item_id
      where h.user_id = ${userId} and i.embedding is not null and i.id <> ${c.id}
      order by i.embedding <=> ${vector}::vector
      limit 1`);
    if (nearest && Number(nearest.similarity) >= HEARD) heardItemIds.push(c.id);
    else fresh.push(c);
  }
  if (heardItemIds.length > 0) {
    await db.update(schema.items).set({ status: "skipped" }).where(inArray(schema.items.id, heardItemIds));
  }

  const uf = new UnionFind(fresh.length);
  const borderline: [number, number][] = [];
  for (let a = 0; a < fresh.length; a++) {
    for (let b = a + 1; b < fresh.length; b++) {
      const ea = fresh[a]?.embedding;
      const eb = fresh[b]?.embedding;
      if (!ea || !eb) continue;
      // Two items from the same issue are different sections, never the same story.
      const sameIssue = fresh[a]?.newsletterId && fresh[a]?.newsletterId === fresh[b]?.newsletterId && fresh[a]?.publishedAt?.getTime() === fresh[b]?.publishedAt?.getTime();
      if (sameIssue) continue;
      const sim = cosine(ea, eb);
      if (sim >= SAME_STORY) uf.union(a, b);
      else if (sim >= BORDERLINE) borderline.push([a, b]);
    }
  }
  if (model && borderline.length > 0) {
    const pairs = borderline.slice(0, 30);
    try {
      const same = await confirmPairs(model, fresh, pairs);
      for (const [i, [a, b]] of pairs.entries()) if (same.has(i)) uf.union(a, b);
    } catch {
      // Embeddings alone are a safe default: unconfirmed pairs stay separate.
    }
  }

  const groups = new Map<number, Candidate[]>();
  fresh.forEach((c, i) => {
    const root = uf.find(i);
    groups.set(root, [...(groups.get(root) ?? []), c]);
  });

  const clusters = Array.from(groups.values()).map((items) => {
    // Primary: highest priority, then richest text.
    const sorted = [...items].sort(
      (x, y) => PRIORITY_RANK[x.priority] - PRIORITY_RANK[y.priority] || Number(x.limited) - Number(y.limited) || y.text.length - x.text.length,
    );
    const primary = sorted[0] as Candidate;
    return { key: primary.id, items: sorted, priority: primary.priority };
  });
  return { clusters, heardItemIds };
}

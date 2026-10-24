import { type Database, schema } from "@unread/db";
import { and, eq, gt, inArray } from "drizzle-orm";
import { type FetchedLink, fetchArticle } from "../links";
import { normalizeForHash, sha256Hex } from "../util/hash";
import { type NewsResult, searchGoogleNews } from "./serpapi";

export * from "./serpapi";

export const NEWS_WINDOW_HOURS = 36;

export interface FetchNewsOptions {
  db: Database;
  userId: string;
  apiKey: string;
  country: string;
  language: string;
  topics: string[];
  now: Date;
  perTopic?: number;
  search?: typeof searchGoogleNews;
  fetcher?: (url: string) => Promise<FetchedLink>;
}

/**
 * Opt-in news (prd §4.3): per topic, results from the last 24–36 h in the
 * user's edition; the top few are fetched and extracted so the script has real
 * text, not just headlines. Already-seen URLs are skipped.
 */
export async function fetchNewsItems(options: FetchNewsOptions): Promise<string[]> {
  const { db, userId, now, perTopic = 3 } = options;
  const search = options.search ?? searchGoogleNews;
  const fetcher = options.fetcher ?? fetchArticle;
  const since = new Date(now.getTime() - NEWS_WINDOW_HOURS * 3_600_000);

  const picked: (NewsResult & { topic: string })[] = [];
  for (const topic of options.topics.slice(0, 8)) {
    let results: NewsResult[] = [];
    try {
      results = await search({ apiKey: options.apiKey, query: topic, country: options.country, language: options.language });
    } catch (error) {
      console.error("news search failed", topic, error);
      continue;
    }
    const fresh = results.filter((r) => r.publishedAt && r.publishedAt >= since && r.publishedAt <= new Date(now.getTime() + 3_600_000));
    picked.push(...fresh.slice(0, perTopic).map((r) => ({ ...r, topic })));
  }
  if (picked.length === 0) return [];

  const urls = [...new Set(picked.map((p) => p.url))];
  const seen = await db
    .select({ url: schema.items.url })
    .from(schema.items)
    .where(and(eq(schema.items.userId, userId), inArray(schema.items.url, urls), gt(schema.items.createdAt, new Date(now.getTime() - 14 * 86_400_000))));
  const seenUrls = new Set(seen.map((s) => s.url));
  const todo = picked.filter((p, i) => !seenUrls.has(p.url) && picked.findIndex((q) => q.url === p.url) === i);

  const ids: string[] = [];
  for (const result of todo) {
    const article = await fetcher(result.url);
    const text = article.text || result.snippet || "";
    const [row] = await db
      .insert(schema.items)
      .values({
        userId,
        sourceKind: "news",
        url: article.url,
        title: article.limited ? result.title : article.title || result.title,
        text: text || null,
        textHash: text ? sha256Hex(normalizeForHash(text)) : null,
        limited: article.limited,
        topicLabel: result.topic,
        publishedAt: result.publishedAt,
        links: [{ text: result.outlet ?? new URL(result.url).hostname, url: result.url }],
      })
      .returning({ id: schema.items.id });
    if (row) ids.push(row.id);
  }
  return ids;
}

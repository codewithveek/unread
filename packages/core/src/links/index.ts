import { type Database, schema } from "@unread/db";
import { and, eq, inArray } from "drizzle-orm";
import { normalizeForHash, sha256Hex } from "../util/hash";
import { extractArticle } from "./extract";
import { safeFetch } from "./ssrf";

export * from "./extract";
export * from "./ssrf";

export interface FetchedLink {
  url: string;
  title: string;
  text: string;
  limited: boolean;
  publishedAt: Date | null;
  siteName: string | null;
}

export async function fetchArticle(url: string): Promise<FetchedLink> {
  try {
    const result = await safeFetch(url);
    if (result.status >= 400 || !/html|xml/i.test(result.contentType)) {
      return { url, title: new URL(url).hostname, text: "", limited: true, publishedAt: null, siteName: null };
    }
    return { url: result.url, ...extractArticle(result.body, result.url) };
  } catch {
    return { url, title: new URL(url).hostname, text: "", limited: true, publishedAt: null, siteName: null };
  }
}

/** Fill in queued link items: fetch, extract, mark limited when paywalled or blocked. */
export async function extractLinkItems(options: {
  db: Database;
  itemIds: string[];
  fetcher?: (url: string) => Promise<FetchedLink>;
}): Promise<void> {
  const { db, itemIds, fetcher = fetchArticle } = options;
  if (itemIds.length === 0) return;
  const rows = await db
    .select()
    .from(schema.items)
    .where(and(inArray(schema.items.id, itemIds), eq(schema.items.sourceKind, "link")));
  await Promise.all(
    rows.map(async (item) => {
      if (!item.url) return;
      const article = await fetcher(item.url);
      await db
        .update(schema.items)
        .set({
          url: article.url,
          title: article.title,
          text: article.text || null,
          textHash: article.text ? sha256Hex(normalizeForHash(article.text)) : null,
          limited: article.limited,
          publishedAt: article.publishedAt,
        })
        .where(eq(schema.items.id, item.id));
    }),
  );
}

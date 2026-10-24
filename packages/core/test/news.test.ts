import { schema } from "@unread/db";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { type EpisodeDeps, maybeFetchNews } from "../src/episodes";
import { fetchNewsItems, type NewsResult } from "../src/news";
import { createTestUser, randomAlias, tempStorage, testDatabaseUrl, testDb } from "./helpers";

describe.skipIf(!testDatabaseUrl)("opt-in news", () => {
  const db = testDb();
  const now = new Date("2026-10-24T12:00:00Z");
  afterAll(async () => {
    await db.$client.end();
  });
  const results: NewsResult[] = [
    { title: "Fresh AI story", url: "https://news.example/ai-1", outlet: "Example", publishedAt: new Date("2026-10-24T08:00:00Z"), snippet: "Snippet" },
    { title: "Old AI story", url: "https://news.example/ai-old", outlet: "Example", publishedAt: new Date("2026-10-20T08:00:00Z"), snippet: null },
  ];
  const calls: { query: string; country: string; language: string }[] = [];
  const search = async (o: { query: string; country: string; language: string }) => (calls.push(o), results);
  const fetcher = async (url: string) => ({ url, title: "Fresh AI story", text: "Full article text. ".repeat(60), limited: false, publishedAt: null, siteName: null });

  it("keeps only the last 36 hours, uses the edition, and skips URLs already seen", async () => {
    const user = await createTestUser(db, { alias: randomAlias(), email: "n@example.com" });
    const ids = await fetchNewsItems({ db, userId: user.id, apiKey: "k", country: "NG", language: "en", topics: ["AI"], now, search, fetcher });
    expect(ids).toHaveLength(1);
    expect(calls.at(-1)).toMatchObject({ query: "AI", country: "NG", language: "en" });
    const [item] = await db.select().from(schema.items).where(eq(schema.items.id, ids[0] ?? ""));
    expect(item).toMatchObject({ sourceKind: "news", topicLabel: "AI", limited: false });
    expect(await fetchNewsItems({ db, userId: user.id, apiKey: "k", country: "NG", language: "en", topics: ["AI"], now, search, fetcher })).toEqual([]);
  });

  it("respects opt-in and the fill mode", async () => {
    const config = loadConfig({ ...process.env, DATABASE_URL: testDatabaseUrl, SERPAPI_API_KEY: "" });
    const deps = { config, db, storage: tempStorage() } as unknown as EpisodeDeps;
    const user = await createTestUser(db, { alias: randomAlias(), email: "o@example.com" });
    // Opted out (default): nothing, even with a key.
    expect(await maybeFetchNews({ ...deps, config: { ...config, env: { ...config.env, SERPAPI_API_KEY: "k" } } }, { userId: user.id, maxChars: 9000, now })).toBe(0);
    await db.update(schema.users).set({ newsOptIn: true, newsMode: "fill" }).where(eq(schema.users.id, user.id));
    await db.insert(schema.userTopics).values({ userId: user.id, label: "AI", query: "AI" });
    // Queued newsletters fill the budget → no news in "fill" mode.
    await db.insert(schema.items).values(
      Array.from({ length: 12 }, (_, i) => ({ userId: user.id, sourceKind: "newsletter" as const, title: `Story ${i}`, text: "word ".repeat(1200) })),
    );
    const withKey = { ...deps, config: { ...config, env: { ...config.env, SERPAPI_API_KEY: "k" } } };
    expect(await maybeFetchNews(withKey, { userId: user.id, maxChars: 9000, now })).toBe(0);
    const news = await db.select().from(schema.items).where(and(eq(schema.items.userId, user.id), eq(schema.items.sourceKind, "news")));
    expect(news).toHaveLength(0);
  });
});

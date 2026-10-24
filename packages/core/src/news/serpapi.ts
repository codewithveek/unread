import { z } from "zod";

const resultSchema = z.object({
  title: z.string(),
  link: z.string().url().optional(),
  source: z.object({ name: z.string().optional() }).optional(),
  iso_date: z.string().optional(),
  snippet: z.string().optional(),
  stories: z
    .array(z.object({ title: z.string(), link: z.string().url().optional(), source: z.object({ name: z.string().optional() }).optional(), iso_date: z.string().optional() }))
    .optional(),
});

const responseSchema = z.object({
  news_results: z.array(z.unknown()).default([]),
  error: z.string().optional(),
});

export interface NewsResult {
  title: string;
  url: string;
  outlet: string | null;
  publishedAt: Date | null;
  snippet: string | null;
}

/** SerpApi Google News (engine=google_news, q, gl, hl; verified in ADR 0009). */
export async function searchGoogleNews(options: {
  apiKey: string;
  query: string;
  country: string;
  language: string;
  fetchImpl?: typeof fetch;
}): Promise<NewsResult[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_news");
  url.searchParams.set("q", options.query);
  url.searchParams.set("gl", options.country.toLowerCase());
  url.searchParams.set("hl", options.language.toLowerCase());
  url.searchParams.set("api_key", options.apiKey);
  const response = await (options.fetchImpl ?? fetch)(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`SerpApi ${response.status}`);
  const data = responseSchema.parse(await response.json());
  if (data.error) throw new Error(`SerpApi: ${data.error}`);
  const out: NewsResult[] = [];
  for (const raw of data.news_results) {
    const parsed = resultSchema.safeParse(raw);
    if (!parsed.success) continue;
    // Story clusters nest their articles; take the lead article.
    const r = parsed.data.link ? parsed.data : { ...parsed.data, ...(parsed.data.stories?.[0] ?? {}) };
    if (!r.link) continue;
    const published = r.iso_date ? new Date(r.iso_date) : null;
    out.push({
      title: r.title,
      url: r.link,
      outlet: r.source?.name ?? null,
      publishedAt: published && !Number.isNaN(published.getTime()) ? published : null,
      snippet: parsed.data.snippet ?? null,
    });
  }
  return out;
}

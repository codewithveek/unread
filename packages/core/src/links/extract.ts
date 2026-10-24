import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export interface ExtractedArticle {
  title: string;
  text: string;
  siteName: string | null;
  publishedAt: Date | null;
  /** Paywalled, blocked or too short: only the title and a snippet are usable. */
  limited: boolean;
}

const PAYWALL = /subscribe to (continue|read)|already a subscriber|this (article|story) is for (subscribers|members)|sign in to (continue|read)|create a free account to (continue|read)/i;
const MIN_FULL_TEXT = 600;

function meta(document: Document, ...names: string[]): string | null {
  for (const name of names) {
    const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    const content = el?.getAttribute("content")?.trim();
    if (content) return content;
  }
  return null;
}

/** Readable text from an article page (prd §4.2), with a "limited" fallback. */
export function extractArticle(html: string, url: string): ExtractedArticle {
  const { document } = parseHTML(html);
  const doc = document as unknown as Document;
  const metaTitle = meta(doc, "og:title", "twitter:title") ?? doc.querySelector("title")?.textContent?.trim() ?? url;
  const description = meta(doc, "og:description", "description", "twitter:description") ?? "";
  const siteName = meta(doc, "og:site_name");
  const published = meta(doc, "article:published_time", "og:published_time", "date");
  const publishedAt = published && !Number.isNaN(Date.parse(published)) ? new Date(published) : null;

  let article: ReturnType<Readability["parse"]> = null;
  try {
    article = new Readability(doc, { charThreshold: 300 }).parse();
  } catch {
    article = null;
  }
  const text = (article?.textContent ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");

  const limited = text.length < MIN_FULL_TEXT || PAYWALL.test(text.slice(0, 2000) + html.slice(0, 20000));
  return {
    title: (article?.title || metaTitle).slice(0, 300),
    text: limited ? [description, text.slice(0, 400)].filter(Boolean).join("\n\n") : text.slice(0, 40_000),
    siteName: article?.siteName ?? siteName,
    publishedAt,
    limited,
  };
}

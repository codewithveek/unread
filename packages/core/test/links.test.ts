import { describe, expect, it } from "vitest";
import { BlockedUrlError, extractArticle, isBlockedAddress, safeFetch } from "../src/links";

describe("SSRF guard", () => {
  it("blocks private, loopback, link-local and mapped addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
    for (const ip of ["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("refuses bad URLs before any request", async () => {
    await expect(safeFetch("http://169.254.169.254/latest/meta-data")).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(safeFetch("file:///etc/passwd")).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(safeFetch("http://localhost:3000/")).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(safeFetch("https://user:pw@example.com/")).rejects.toBeInstanceOf(BlockedUrlError);
  });
});

describe("article extraction", () => {
  const paragraph = "Sleep researchers followed 2,000 adults for ten years and found consistent bedtimes mattered more than total hours. ".repeat(8);

  it("extracts readable text and metadata", () => {
    const html = `<html><head><title>Sleep | Example</title><meta property="og:site_name" content="Example Mag"><meta property="article:published_time" content="2026-10-20T08:00:00Z"></head>
      <body><nav>Home About</nav><article><h1>A long read on sleep</h1><p>${paragraph}</p><p>${paragraph}</p></article><footer>© Example</footer></body></html>`;
    const article = extractArticle(html, "https://example.org/sleep");
    expect(article.limited).toBe(false);
    expect(article.text).toContain("consistent bedtimes");
    expect(article.siteName).toBe("Example Mag");
    expect(article.publishedAt?.toISOString()).toBe("2026-10-20T08:00:00.000Z");
  });

  it("marks paywalled pages as limited and keeps only a snippet", () => {
    const html = `<html><head><meta property="og:title" content="Big scoop"><meta name="description" content="The teaser."></head>
      <body><article><p>First paragraph of the scoop.</p><p>Subscribe to continue reading.</p></article></body></html>`;
    const article = extractArticle(html, "https://news.example/scoop");
    expect(article.limited).toBe(true);
    expect(article.title).toBe("Big scoop");
    expect(article.text).toContain("The teaser.");
  });
});

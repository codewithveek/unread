import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";

export interface Link {
  text: string;
  url: string;
}

export interface Block {
  type: "heading" | "paragraph" | "list-item" | "rule";
  text: string;
  links: Link[];
  /** Share of the text inside <b>/<strong>; a bold-only short line reads as a heading. */
  boldRatio: number;
}

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "article",
  "header",
  "footer",
  "table",
  "tbody",
  "thead",
  "tr",
  "td",
  "th",
  "ul",
  "ol",
  "blockquote",
  "pre",
  "center",
  "main",
  "aside",
  "figure",
  "figcaption",
]);
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const DROP_TAGS = "script, style, head, noscript, svg, img, picture, video, audio, iframe, form, button, map";

const TRACKING_PARAMS = /^(utm_|mc_|_hs|hsa_|mkt_tok|ck_subscriber_id|oly_|vero_|ref$|sc_)/i;

/** Remove tracking parameters but keep the link working. */
export function cleanUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    for (const key of Array.from(url.searchParams.keys())) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    url.hash = url.hash.startsWith("#utm") ? "" : url.hash;
    return url.toString();
  } catch {
    return null;
  }
}

const UTILITY_LINK = /unsubscribe|preferences|opt[-_ ]?out|manage[-_ ]?subscription|view[-_ ]?(in[-_ ]?)?browser|list-manage\.com\/(profile|unsubscribe)|\/email\/(open|pixel)|mailto:/i;

function isHidden(el: Element): boolean {
  const style = (el.attribs?.style ?? "").replace(/\s+/g, "").toLowerCase();
  return (
    "hidden" in (el.attribs ?? {}) ||
    el.attribs?.["aria-hidden"] === "true" ||
    style.includes("display:none") ||
    style.includes("visibility:hidden") ||
    style.includes("max-height:0") ||
    /font-size:0(px)?(;|$)/.test(style)
  );
}

interface Buffer {
  text: string;
  boldChars: number;
  links: Link[];
  type: Block["type"];
}

/** Flatten newsletter HTML (table soup included) into readable blocks with their links. */
export function htmlToBlocks(html: string): Block[] {
  const $ = cheerio.load(html);
  $(DROP_TAGS).remove();
  // Gmail and Outlook put the "Forwarded message" header in these.
  $(".gmail_attr, #divRplyFwdMsg, #appendonsend").remove();

  const blocks: Block[] = [];
  let buf: Buffer = { text: "", boldChars: 0, links: [], type: "paragraph" };

  const flush = () => {
    const text = buf.text.replace(/[ \t ​-‍﻿͏]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
    if (text) {
      blocks.push({ type: buf.type, text, links: buf.links, boldRatio: buf.boldChars / Math.max(1, buf.text.trim().length) });
    }
    buf = { text: "", boldChars: 0, links: [], type: "paragraph" };
  };

  const walk = (node: AnyNode, bold: boolean, link: string | null) => {
    if (node.type === "text") {
      const data = (node as unknown as { data: string }).data;
      buf.text += data;
      if (bold) buf.boldChars += data.trim().length;
      return;
    }
    if (node.type !== "tag") return;
    const el = node as Element;
    if (isHidden(el)) return;
    const tag = el.name.toLowerCase();

    if (tag === "br") {
      flush();
      return;
    }
    if (tag === "hr") {
      flush();
      blocks.push({ type: "rule", text: "", links: [], boldRatio: 0 });
      return;
    }
    const isHeading = HEADING_TAGS.has(tag);
    const isBlock = isHeading || BLOCK_TAGS.has(tag) || tag === "li";
    if (isBlock) flush();
    if (isHeading) buf.type = "heading";
    if (tag === "li") buf.type = "list-item";

    let href = link;
    if (tag === "a" && el.attribs?.href) {
      const url = cleanUrl(el.attribs.href);
      href = url && !UTILITY_LINK.test(el.attribs.href) ? url : null;
    }
    const startLength = buf.text.length;
    const isBold = bold || tag === "b" || tag === "strong";
    for (const child of el.children) walk(child, isBold, href);
    if (tag === "a" && href && href !== link) {
      const text = buf.text.slice(startLength).replace(/\s+/g, " ").trim();
      if (text) buf.links.push({ text, url: href });
    }
    if (isBlock) flush();
  };

  const root = $("body").get(0) ?? $.root().get(0);
  if (root) for (const child of (root as Element).children) walk(child, false, null);
  flush();
  return blocks;
}

const URL_IN_TEXT = /https?:\/\/[^\s<>()"']+[^\s<>()"'.,;:!?]/g;

/** Plain-text emails: paragraphs split on blank lines; markdown and ALL CAPS lines become headings. */
export function textToBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const [i, line] of lines.entries()) {
      if (/^[-=_*]{3,}$/.test(line)) {
        blocks.push({ type: "rule", text: "", links: [], boldRatio: 0 });
        continue;
      }
      const links = Array.from(line.matchAll(URL_IN_TEXT), (m) => cleanUrl(m[0]))
        .filter((u): u is string => Boolean(u) && !UTILITY_LINK.test(u ?? ""))
        .map((url) => ({ text: url, url }));
      const md = line.match(/^#{1,4}\s+(.*)$/) ?? line.match(/^\*\*(.+)\*\*$/);
      const caps = line.length < 70 && /[A-Z]{3}/.test(line) && line === line.toUpperCase() && /\s/.test(line);
      if (md?.[1] || caps) {
        blocks.push({ type: "heading", text: (md?.[1] ?? line).trim(), links, boldRatio: 1 });
      } else if (/^[-*•]\s+/.test(line)) {
        blocks.push({ type: "list-item", text: line.replace(/^[-*•]\s+/, ""), links, boldRatio: 0 });
      } else if (i > 0 && blocks.at(-1)?.type === "paragraph" && !/^[-*•]/.test(lines[i - 1] ?? "")) {
        const prev = blocks.at(-1);
        if (prev) {
          prev.text += ` ${line}`;
          prev.links.push(...links);
        }
      } else {
        blocks.push({ type: "paragraph", text: line, links, boldRatio: 0 });
      }
    }
  }
  return blocks;
}

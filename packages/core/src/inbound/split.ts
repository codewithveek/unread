import type { Block, Link } from "./blocks";

export interface SplitItem {
  title: string;
  text: string;
  links: Link[];
}

const FORWARD_MARKER = /^(-{2,}\s*forwarded message\s*-{2,}|begin forwarded message:?|-{2,}\s*original message\s*-{2,})/i;
const FORWARD_HEADER_LINE = /^(from|sent|date|to|cc|subject|reply-to):\s/i;
const FOOTER =
  /\b(unsubscribe|manage (your )?(email )?(preferences|subscription)|update (your )?preferences|you('re| are) receiving this|you received this (email|message)|no longer (want|wish) to receive|opt[- ]out|mailing address|our address is|sent to [\w.+-]+@|privacy policy|terms of service)\b|©|\bcopyright\b/i;
const TOP_UTILITY = /^(view (this email |it )?(in|on) (your |a )?(browser|web)|view online|read online|having trouble viewing|open in browser)/i;
const SPONSOR = /\b(sponsor(ed|s)?( by)?|presented by|together with|in partnership with|brought to you by|advertis(e|ement|ing)|partner content|a word from our sponsor|paid (post|promotion))\b/i;
const SHARE_FLUFF = /^(share|forward)\b.{0,60}\b(friends?|colleagues?)\b|^(refer|invite) (a )?friends?|^follow us|^like what you (see|read)\??$/i;

/** Drop the "Forwarded message / From: / Subject:" header a manual forward adds. */
function stripForwardHeaders(blocks: Block[]): Block[] {
  const markerIndex = blocks.findIndex((b) => FORWARD_MARKER.test(b.text));
  if (markerIndex === -1) return blocks;
  let end = markerIndex + 1;
  while (end < blocks.length && end - markerIndex <= 8 && FORWARD_HEADER_LINE.test(blocks[end]?.text ?? "")) end++;
  return blocks.slice(end);
}

function stripFooterAndUtility(blocks: Block[]): Block[] {
  const kept: Block[] = [];
  const footerZone = Math.floor(blocks.length * 0.65);
  for (const [i, block] of blocks.entries()) {
    if (block.type === "rule") {
      kept.push(block);
      continue;
    }
    if (TOP_UTILITY.test(block.text) || SHARE_FLUFF.test(block.text)) continue;
    if (FOOTER.test(block.text)) {
      // Footer text near the end means everything after it is footer too.
      if (i >= footerZone) break;
      if (block.text.length < 200) continue;
    }
    kept.push(block);
  }
  return kept;
}

function isHeading(block: Block): boolean {
  if (block.type === "heading") return block.text.length <= 160;
  return (
    block.type === "paragraph" &&
    block.boldRatio > 0.9 &&
    block.text.length <= 110 &&
    !/[.!?]["”']?$/.test(block.text)
  );
}

interface Section {
  heading: string | null;
  blocks: Block[];
}

function toSections(blocks: Block[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { heading: null, blocks: [] };
  const push = () => {
    if (current.heading || current.blocks.length > 0) sections.push(current);
  };
  for (const block of blocks) {
    if (block.type === "rule") {
      push();
      current = { heading: null, blocks: [] };
    } else if (isHeading(block)) {
      push();
      current = { heading: block.text, blocks: [] };
    } else {
      current.blocks.push(block);
    }
  }
  push();
  return sections;
}

function sectionText(section: Section): string {
  return section.blocks.map((b) => (b.type === "list-item" ? `- ${b.text}` : b.text)).join("\n\n");
}

function isSponsored(section: Section): boolean {
  const head = `${section.heading ?? ""} ${section.blocks[0]?.text.slice(0, 160) ?? ""}`;
  return SPONSOR.test(head);
}

function firstSentence(text: string, max = 100): string {
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return sentence.length <= max ? sentence : `${sentence.slice(0, max - 1).trimEnd()}…`;
}

function dedupeLinks(links: Link[]): Link[] {
  const seen = new Set<string>();
  return links.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true))).slice(0, 12);
}

export interface SplitOptions {
  /** Sections shorter than this merge into the previous one. */
  minChars?: number;
  /** Long issues with no headings are chunked to about this size. */
  chunkChars?: number;
}

/**
 * Cleaned blocks → one item per story/section (prd §6 step 2). Footers,
 * sponsor sections, share prompts and forward headers are removed.
 */
export function splitIntoItems(rawBlocks: Block[], options: SplitOptions = {}): SplitItem[] {
  const minChars = options.minChars ?? 160;
  const chunkChars = options.chunkChars ?? 1800;
  const blocks = stripFooterAndUtility(stripForwardHeaders(rawBlocks));
  let sections = toSections(blocks).filter((s) => !isSponsored(s));

  // No structure at all: chunk long text at paragraph boundaries.
  if (sections.length === 1 && !sections[0]?.heading) {
    const only = sections[0];
    if (only && sectionText(only).length > chunkChars * 1.5) {
      const chunks: Section[] = [];
      let current: Section = { heading: null, blocks: [] };
      let size = 0;
      for (const block of only.blocks) {
        if (size > chunkChars) {
          chunks.push(current);
          current = { heading: null, blocks: [] };
          size = 0;
        }
        current.blocks.push(block);
        size += block.text.length;
      }
      if (current.blocks.length) chunks.push(current);
      sections = chunks;
    }
  }

  // Merge short, heading-less sections (greetings, captions) into a neighbour.
  const merged: Section[] = [];
  for (const section of sections) {
    const text = sectionText(section);
    const prev = merged.at(-1);
    if (!section.heading && text.length < minChars && prev) {
      prev.blocks.push(...section.blocks);
    } else {
      merged.push({ heading: section.heading, blocks: [...section.blocks] });
    }
  }

  return merged
    .map((section) => {
      const text = sectionText(section);
      return {
        title: (section.heading ?? firstSentence(text)).replace(/\s+/g, " ").trim(),
        text,
        links: dedupeLinks(section.blocks.flatMap((b) => b.links)),
      };
    })
    .filter((item) => item.text.length >= minChars * 0.75);
}

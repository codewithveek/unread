import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

/** Resolved lazily: this module is only ever used by the worker. */
function fontFiles(): string[] {
  return [
    fileURLToPath(new URL("../../assets/fonts/Geist-Bold.ttf", import.meta.url)),
    fileURLToPath(new URL("../../assets/fonts/GeistMono-Regular.ttf", import.meta.url)),
  ];
}

const GROUND = "#0E0F12";
const SURFACE = "#1F2128";
const TEXT = "#F2F3F5";
const MUTED = "#A3A8B3";
const ACCENT = "#5B9BFF";

/** mulberry32 seeded from a string: the same seed always draws the same cover. */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c);
}

export interface CoverInput {
  /** user id + date + top newsletters (prd §6 step 8). */
  seed: string;
  day: string;
  /** "OCT · SAT" */
  caption: string;
  /** Up to three newsletter names shown under the bars. */
  sources: string[];
}

/** Square cover in a 1000-unit viewBox; rendered at any size. */
export function coverSvg(input: CoverInput): string {
  const random = seeded(input.seed);
  const bars = Array.from({ length: 16 }, (_, i) => {
    const accent = i < 10;
    const height = 120 + Math.round(random() * (accent ? 330 : 220));
    const opacity = accent ? [1, 0.55, 1, 0.35][i % 4] : 0.14;
    return `<rect x="${70 + i * 54}" y="${720 - height}" width="30" height="${height}" rx="15" fill="${accent ? ACCENT : TEXT}" opacity="${opacity}"/>`;
  }).join("");
  const sources = input.sources
    .slice(0, 3)
    .map((s, i) => `<text x="70" y="${820 + i * 44}" font-family="Geist Mono" font-size="30" fill="${MUTED}">${escapeXml(s.toUpperCase().slice(0, 34))}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <rect width="1000" height="1000" fill="${GROUND}"/>
  <rect x="40" y="40" width="920" height="920" rx="56" fill="${SURFACE}"/>
  <circle cx="92" cy="122" r="16" fill="${ACCENT}"/>
  <text x="124" y="136" font-family="Geist" font-weight="700" font-size="44" fill="${TEXT}" letter-spacing="-1">Unread</text>
  <text x="930" y="200" text-anchor="end" font-family="Geist" font-weight="700" font-size="170" fill="${TEXT}" letter-spacing="-6">${escapeXml(input.day)}</text>
  <text x="930" y="252" text-anchor="end" font-family="Geist Mono" font-size="34" fill="${MUTED}">${escapeXml(input.caption)}</text>
  ${bars}
  ${sources}
</svg>`;
}

export function renderCoverPng(svg: string, size: number): Uint8Array {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: { fontFiles: fontFiles(), loadSystemFonts: false, defaultFontFamily: "Geist" },
  });
  return new Uint8Array(resvg.render().asPng());
}

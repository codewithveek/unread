import { cleanUrl } from "./blocks";
import type { ParsedEmail } from "./parse";

const URL_PATTERN = /https?:\/\/[^\s<>()"']+[^\s<>()"'.,;:!?]/g;
const SIGNATURE = /^(--\s*$|sent from my|get outlook for|sent via)/im;

/**
 * "Email a bare link" (prd §4.2): a short message that is basically one to
 * three URLs. Returns the URLs, or null if this looks like a newsletter.
 */
export function detectBareLinks(email: ParsedEmail): string[] | null {
  const text = (email.text ?? "").split(SIGNATURE)[0] ?? "";
  if (email.html && text.trim().length === 0) return null;
  const urls = Array.from(text.matchAll(URL_PATTERN), (m) => cleanUrl(m[0])).filter((u): u is string => Boolean(u));
  const unique = Array.from(new Set(urls));
  if (unique.length === 0 || unique.length > 3) return null;
  const words = text.replace(URL_PATTERN, " ").split(/\s+/).filter(Boolean);
  return words.length <= 25 ? unique : null;
}

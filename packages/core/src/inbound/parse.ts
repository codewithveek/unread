import PostalMime from "postal-mime";
import { normalizeAddress } from "./address";

export interface ParsedEmail {
  messageId: string;
  subject: string;
  from: { address: string; name: string };
  date: Date | null;
  html: string | null;
  text: string | null;
  /** Lower-cased header name → every value, in order. */
  headers: Map<string, string[]>;
}

export function header(email: ParsedEmail, name: string): string | null {
  return email.headers.get(name.toLowerCase())?.[0] ?? null;
}

export async function parseEmail(raw: Uint8Array, fallbackId: string): Promise<ParsedEmail> {
  const parsed = await PostalMime.parse(raw, { attachmentEncoding: "arraybuffer" });
  const headers = new Map<string, string[]>();
  for (const h of parsed.headers) {
    const key = h.key.toLowerCase();
    headers.set(key, [...(headers.get(key) ?? []), h.value]);
  }
  const date = parsed.date ? new Date(parsed.date) : null;
  return {
    messageId: (parsed.messageId ?? "").replace(/^<|>$/g, "").trim() || fallbackId,
    subject: (parsed.subject ?? "").trim(),
    from: {
      address: normalizeAddress(parsed.from?.address ?? ""),
      name: (parsed.from?.name ?? "").trim(),
    },
    date: date && !Number.isNaN(date.getTime()) ? date : null,
    html: parsed.html ?? null,
    text: parsed.text ?? null,
    headers,
  };
}

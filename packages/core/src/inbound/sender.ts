import { addressesIn, normalizeAddress } from "./address";
import { header, type ParsedEmail } from "./parse";

export interface NewsletterIdentity {
  senderEmail: string;
  displayName: string;
  listId: string | null;
  subject: string;
}

const FORWARDED_FROM = /(?:^|\n)\s*(?:\*\*)?From:(?:\*\*)?\s*(?:"?([^"<\n]*?)"?\s*)?<?([\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+)>?/i;
const FORWARDED_SUBJECT = /(?:^|\n)\s*(?:\*\*)?Subject:(?:\*\*)?\s*(.+)/i;
const FORWARD_MARKER = /-{2,}\s*forwarded message\s*-{2,}|begin forwarded message|-{2,}\s*original message\s*-{2,}|^\s*from:.*\n\s*sent:/im;

function prettyDomain(address: string): string {
  const domain = address.split("@")[1] ?? address;
  const parts = domain.split(".");
  const core = parts.length > 2 ? (parts.at(-2) ?? domain) : (parts[0] ?? domain);
  return core.charAt(0).toUpperCase() + core.slice(1);
}

function listIdName(listId: string | null): string | null {
  if (!listId) return null;
  const quoted = listId.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim();
  return quoted && quoted.length > 1 ? quoted : null;
}

/**
 * Who wrote this issue. Auto-forwarded mail keeps the newsletter's From
 * header; a manual forward puts it in the body after a "Forwarded message" marker.
 */
export function detectNewsletter(email: ParsedEmail, forwarderAddresses: string[]): NewsletterIdentity {
  const forwarders = new Set(forwarderAddresses.map(normalizeAddress));
  const listId = header(email, "list-id");
  const body = email.text ?? "";
  const fromIsForwarder = forwarders.has(email.from.address);

  if (fromIsForwarder && FORWARD_MARKER.test(body)) {
    const markerIndex = body.search(FORWARD_MARKER);
    const after = body.slice(Math.max(0, markerIndex));
    const from = after.match(FORWARDED_FROM);
    const subject = after.match(FORWARDED_SUBJECT)?.[1]?.trim();
    if (from?.[2]) {
      const address = normalizeAddress(from[2]);
      return {
        senderEmail: address,
        displayName: from[1]?.trim() || prettyDomain(address),
        listId: null,
        subject: subject ?? email.subject.replace(/^(fwd?|fw):\s*/i, ""),
      };
    }
  }

  const address = email.from.address;
  return {
    senderEmail: address,
    displayName: (!fromIsForwarder && email.from.name) || listIdName(listId) || prettyDomain(address),
    listId,
    subject: email.subject.replace(/^(fwd?|fw):\s*/i, ""),
  };
}

/** Addresses that may have forwarded this mail: the envelope sender and Gmail's X-Forwarded-For. */
export function forwarderCandidates(email: ParsedEmail, envelopeFrom: string): string[] {
  const candidates = [normalizeAddress(envelopeFrom)];
  const forwardedFor = addressesIn(header(email, "x-forwarded-for"))[0];
  if (forwardedFor) candidates.push(forwardedFor);
  // A manual forward: header From is the user, and must match the envelope.
  if (email.from.address === candidates[0]) candidates.push(email.from.address);
  return Array.from(new Set(candidates.filter(Boolean)));
}

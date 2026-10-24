import { randomBytes } from "node:crypto";
import { ulid } from "ulid";

/** Primary keys are ULIDs: sortable by creation time, safe in URLs. */
export function newId(): string {
  return ulid();
}

/** Unguessable token for the private podcast feed URL (192 bits). */
export function newFeedToken(): string {
  return randomBytes(24).toString("base64url");
}

const ALIAS_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Local part of the user's forwarding address. Lowercase, no look-alike
 * characters, so it survives being read aloud or typed from a phone.
 */
export function newInboundAlias(length = 10): string {
  const bytes = randomBytes(length);
  let alias = "";
  for (const byte of bytes) {
    alias += ALIAS_ALPHABET[byte % ALIAS_ALPHABET.length];
  }
  return alias;
}

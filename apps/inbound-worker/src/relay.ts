import { signInbound } from "@unread/core/inbound/signature";

export interface RelayEnv {
  INBOUND_WEBHOOK_URL: string;
  INBOUND_WEBHOOK_SECRET: string;
  MAX_BYTES?: string;
}

/** The parts of ForwardableEmailMessage the relay uses (easy to fake in tests). */
export interface InboundMessage {
  from: string;
  to: string;
  raw: ReadableStream<Uint8Array>;
  rawSize: number;
  setReject(reason: string): void;
}

export const ALIAS_LOCAL_PART = /^[a-hjkmnp-z2-9]{10}(\+[^@]*)?$/i;

async function readAll(stream: ReadableStream<Uint8Array>, size: number): Promise<Uint8Array> {
  const out = new Uint8Array(size);
  let offset = 0;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value.subarray(0, Math.max(0, size - offset)), offset);
    offset += value.byteLength;
  }
  return offset === size ? out : out.subarray(0, Math.min(offset, size));
}

export interface RelayOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/**
 * Cloudflare Email Routing → Unread (ADR 0004). Rejects at SMTP time for
 * oversized mail and addresses that can't be an alias; otherwise signs the raw
 * MIME and posts it, retrying transient failures.
 */
export async function relay(message: InboundMessage, env: RelayEnv, options: RelayOptions = {}): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const maxBytes = Number(env.MAX_BYTES ?? 2_097_152);

  const local = message.to.split("@")[0] ?? "";
  if (!ALIAS_LOCAL_PART.test(local)) {
    message.setReject("Unknown address");
    return "rejected:address";
  }
  if (message.rawSize > maxBytes) {
    message.setReject("Message too large for Unread (2 MB limit)");
    return "rejected:size";
  }

  const body = await readAll(message.raw, message.rawSize);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const signature = await signInbound({
      secret: env.INBOUND_WEBHOOK_SECRET,
      timestamp: Math.floor(now() / 1000),
      envelopeFrom: message.from,
      envelopeTo: message.to,
      body,
    });
    try {
      const response = await fetchImpl(env.INBOUND_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "content-type": "message/rfc822",
          "x-unread-signature": signature,
          "x-unread-envelope-from": message.from,
          "x-unread-envelope-to": message.to,
        },
        body,
      });
      if (response.ok) return "relayed";
      if (response.status < 500 && response.status !== 429) {
        message.setReject("Unread could not accept this message");
        return `rejected:${response.status}`;
      }
    } catch {
      // network error: retry
    }
    if (attempt < 3) await sleep(500 * 2 ** attempt);
  }
  message.setReject("Temporary failure at Unread, please try again later");
  return "failed";
}

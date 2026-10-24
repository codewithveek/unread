/**
 * HMAC signing for the Email Worker → web app hop (ADR 0004). Uses Web Crypto
 * so the Cloudflare worker and Node share this file.
 *
 * Header: `X-Unread-Signature: t=<unix>,v1=<hex>` where the MAC covers
 * `${t}.${envelopeFrom}.${envelopeTo}.${sha256(body)}`.
 */

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(body: Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", body as Uint8Array<ArrayBuffer>));
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

export interface SignedEnvelope {
  envelopeFrom: string;
  envelopeTo: string;
  body: Uint8Array;
}

export interface SignOptions extends SignedEnvelope {
  secret: string;
  timestamp: number;
}

export async function signInbound({ secret, timestamp, envelopeFrom, envelopeTo, body }: SignOptions): Promise<string> {
  const digest = await sha256(body);
  const mac = await hmac(secret, `${timestamp}.${envelopeFrom.toLowerCase()}.${envelopeTo.toLowerCase()}.${digest}`);
  return `t=${timestamp},v1=${mac}`;
}

export interface VerifyOptions extends SignedEnvelope {
  secret: string;
  header: string | null;
  nowSeconds: number;
  toleranceSeconds?: number;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyInbound(options: VerifyOptions): Promise<boolean> {
  const { header, nowSeconds, toleranceSeconds = 300 } = options;
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("=", 2) as [string, string | undefined]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = (await signInbound({ ...options, timestamp: t })).split("v1=")[1] ?? "";
  return parts.some(([k, v]) => k === "v1" && v !== undefined && timingSafeEqual(v, expected));
}

import { lookup as dnsLookup } from "node:dns";
import { isIP } from "node:net";
import { Agent } from "undici";

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

/** True for loopback, private, link-local, CGNAT, multicast and reserved ranges. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const value = ipv4ToInt(address);
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mapped) return isBlockedAddress(mapped);
    return (
      lower === "::" ||
      lower === "::1" ||
      /^f[cd][0-9a-f]{2}:/.test(lower) ||
      /^fe[89ab][0-9a-f]:/.test(lower) ||
      /^ff[0-9a-f]{2}:/.test(lower) ||
      lower.startsWith("2001:db8:") ||
      lower.startsWith("64:ff9b:")
    );
  }
  return true;
}

export class BlockedUrlError extends Error {}

/** DNS lookup that refuses private addresses, checked at connect time so rebinding can't slip through. */
const safeLookup: typeof dnsLookup = ((hostname: string, options: unknown, callback: unknown) => {
  const cb = (typeof options === "function" ? options : callback) as (
    err: NodeJS.ErrnoException | null,
    address: string | { address: string; family: number }[],
    family?: number,
  ) => void;
  dnsLookup(hostname, { all: true }, (err, addresses) => {
    if (err) return cb(err, []);
    const blocked = addresses.find((a) => isBlockedAddress(a.address));
    if (blocked || addresses.length === 0) {
      return cb(new BlockedUrlError(`Refusing to connect to ${hostname}`) as NodeJS.ErrnoException, []);
    }
    const wantsAll = typeof options === "object" && options !== null && (options as { all?: boolean }).all;
    if (wantsAll) return cb(null, addresses);
    const first = addresses[0];
    return cb(null, first?.address ?? "", first?.family);
  });
}) as typeof dnsLookup;

const agent = new Agent({ connect: { lookup: safeLookup, timeout: 5_000 } });

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export interface SafeFetchResult {
  url: string;
  status: number;
  contentType: string;
  body: string;
}

function assertAllowedUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedUrlError("Only http(s) links");
  if (url.username || url.password) throw new BlockedUrlError("No credentials in links");
  if (url.port && url.port !== "80" && url.port !== "443") throw new BlockedUrlError("Unusual port");
  if (isIP(url.hostname.replace(/^\[|\]$/g, "")) && isBlockedAddress(url.hostname.replace(/^\[|\]$/g, ""))) {
    throw new BlockedUrlError("Private address");
  }
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(url.hostname)) throw new BlockedUrlError("Local host");
  return url;
}

/**
 * Fetch a user-supplied URL (prd §4.2, §10): http(s) only, no private
 * addresses (checked on every redirect and at connect), capped time and size.
 */
export async function safeFetch(raw: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const { timeoutMs = 10_000, maxBytes = 3 * 1024 * 1024, maxRedirects = 5 } = options;
  let url = assertAllowedUrl(raw);
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      // @ts-expect-error undici dispatcher is supported by Node's fetch
      dispatcher: agent,
      headers: {
        "user-agent": "UnreadBot/1.0 (+https://getunread.site)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      url = assertAllowedUrl(new URL(response.headers.get("location") ?? "", url).toString());
      await response.body?.cancel();
      continue;
    }
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size > maxBytes ? maxBytes : size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk.subarray(0, bytes.length - offset), offset);
      offset += chunk.byteLength;
      if (offset >= bytes.length) break;
    }
    return {
      url: url.toString(),
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      body: new TextDecoder().decode(bytes),
    };
  }
  throw new BlockedUrlError("Too many redirects");
}

import "server-only";
import { storage } from "@/lib/storage";
import { PRIVATE_HEADERS } from "./feed-data";

/**
 * Send a stored object: a short-lived signed URL when the store supports it
 * (S3/R2 handle Range requests for podcast apps), otherwise stream it here
 * with Range support (local storage in development).
 */
export async function serveObject(options: { request: Request; key: string; contentType: string; maxAge: number }) {
  const { request, key, contentType } = options;
  const signed = await storage().signedUrl(key, 6 * 3600);
  if (signed) {
    return new Response(null, { status: 302, headers: { ...PRIVATE_HEADERS, location: signed, "cache-control": "private, max-age=300" } });
  }
  const bytes = await storage().get(key);
  if (!bytes) return new Response("Not found", { status: 404, headers: PRIVATE_HEADERS });

  const headers: Record<string, string> = {
    ...PRIVATE_HEADERS,
    "content-type": contentType,
    "accept-ranges": "bytes",
    "cache-control": `private, max-age=${options.maxAge}`,
  };
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const size = bytes.byteLength;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2] || 0));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
    }
    const chunk = bytes.subarray(start, end + 1);
    return new Response(chunk as Uint8Array<ArrayBuffer>, {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(chunk.byteLength) },
    });
  }
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { ...headers, "content-length": String(bytes.byteLength) } });
}

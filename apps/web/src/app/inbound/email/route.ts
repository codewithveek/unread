import { processInbound, verifyInbound } from "@unread/core/inbound";
import { after } from "next/server";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { storage } from "@/lib/storage";
import { extractQueuedLinks } from "@/features/links/extract-queued-links";

export const runtime = "nodejs";

/**
 * Signed relay from the Cloudflare Email Worker (ADR 0004). Answers 2xx for
 * every decision (including rejections) so the worker doesn't retry; only a
 * bad signature or our own failure is non-2xx.
 */
export async function POST(request: Request) {
  const env = serverEnv();
  if (!env.INBOUND_WEBHOOK_SECRET) {
    return Response.json({ error: "Inbound email is not configured" }, { status: 503 });
  }
  const body = new Uint8Array(await request.arrayBuffer());
  const envelopeFrom = request.headers.get("x-unread-envelope-from") ?? "";
  const envelopeTo = request.headers.get("x-unread-envelope-to") ?? "";

  const valid = await verifyInbound({
    secret: env.INBOUND_WEBHOOK_SECRET,
    header: request.headers.get("x-unread-signature"),
    envelopeFrom,
    envelopeTo,
    body,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!valid) return Response.json({ error: "Invalid signature" }, { status: 401 });

  const outcome = await processInbound({
    db: db(),
    storage: storage(),
    raw: body,
    envelopeFrom,
    envelopeTo,
    inboundDomain: env.INBOUND_EMAIL_DOMAIN,
    trustUpstreamAuth: env.INBOUND_TRUST_UPSTREAM_AUTH,
  });

  if (outcome.status === "link") {
    const itemIds = outcome.itemIds;
    after(() => extractQueuedLinks(itemIds));
  }
  return Response.json({ status: outcome.status });
}

import { bachsEventSchema, handleBachsEvent, verifyBachsSignature } from "@unread/core/billing";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Signed Bachs webhook (prd §8.2). 400 only for a bad signature or body;
 * a 5xx lets Bachs retry if saving fails.
 */
export async function POST(request: Request) {
  const secret = serverEnv().BACHS_WEBHOOK_SECRET;
  if (!secret) return new Response("Billing isn't set up", { status: 503 });
  const rawBody = await request.text();
  const valid = verifyBachsSignature({ rawBody, secret, headers: request.headers, nowSeconds: Math.floor(Date.now() / 1000) });
  if (!valid) return new Response("Invalid signature", { status: 400 });
  const parsed = bachsEventSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) return new Response("Bad event", { status: 400 });
  const outcome = await handleBachsEvent(db(), parsed.data);
  return Response.json({ outcome });
}

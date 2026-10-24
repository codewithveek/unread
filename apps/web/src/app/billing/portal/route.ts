import { schema } from "@unread/db";
import { desc, eq } from "drizzle-orm";
import { bachsClient } from "@/features/billing/bachs";
import { currentUser } from "@/features/users/current-user";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** "Manage billing": a fresh, short-lived portal session per click (prd §8.2). */
export async function POST(request: Request) {
  const current = await currentUser();
  if (!current) return Response.redirect(new URL("/auth/login?returnTo=/settings", request.url), 303);
  const client = bachsClient();
  const [sub] = await db()
    .select({ customerId: schema.subscriptions.bachsCustomerId })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, current.user.id))
    .orderBy(desc(schema.subscriptions.updatedAt))
    .limit(1);
  if (!client || !sub) return Response.redirect(new URL("/settings#plan", request.url), 303);
  const { url } = await client.createPortalSession(sub.customerId);
  return Response.redirect(url, 303);
}

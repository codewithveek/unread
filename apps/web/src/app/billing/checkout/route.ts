import { schema } from "@unread/db";
import { desc, eq } from "drizzle-orm";
import { bachsClient, publicUrl } from "@/features/billing/bachs";
import { planContextFor } from "@/features/settings/plan-context";
import { currentUser } from "@/features/users/current-user";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/** prd §8.2: hosted checkout for Plus. The plan changes only when the webhook arrives. */
export async function POST(request: Request) {
  const current = await currentUser();
  if (!current) return Response.redirect(new URL("/auth/login?returnTo=/settings", request.url), 303);
  const env = serverEnv();
  const client = bachsClient();
  const form = await request.formData();
  const productId = form.get("plan") === "yearly" ? env.BACHS_PLUS_YEARLY_PRODUCT_ID : env.BACHS_PLUS_MONTHLY_PRODUCT_ID;
  if (!client || !productId) return new Response("Billing isn't set up yet", { status: 503 });

  const { plan } = await planContextFor(current.user.id);
  if (plan.source === "paid") return Response.redirect(new URL("/settings#plan", request.url), 303);

  const [existing] = await db()
    .select({ customerId: schema.subscriptions.bachsCustomerId })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, current.user.id))
    .orderBy(desc(schema.subscriptions.updatedAt))
    .limit(1);
  const email = current.user.email ?? current.sessionUser.email;
  if (!existing && !email) return new Response("An email address is needed for billing", { status: 400 });

  const { checkoutUrl } = await client.createCheckoutSession({
    productId,
    customer: existing ? { customerId: existing.customerId } : { email: email ?? "", name: current.sessionUser.name },
    userId: current.user.id,
    successUrl: publicUrl("/billing/return"),
    cancelUrl: publicUrl("/settings#plan"),
  });
  return Response.redirect(checkoutUrl, 303);
}

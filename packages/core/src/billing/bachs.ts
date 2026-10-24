import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** Bachs REST client (ADR 0007, verified against docs.bachs.io). Money/products live in Bachs. */
export interface BachsClient {
  createCheckoutSession(input: {
    productId: string;
    customer: { customerId: string } | { email: string; name?: string };
    userId: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<{ checkoutUrl: string; checkoutId: string }>;
  createPortalSession(customerId: string): Promise<{ url: string }>;
}

export class BachsError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const checkoutSchema = z.object({ checkout_id: z.string(), checkout_url: z.string().url() });
const portalSchema = z.object({ url: z.string().url() });

export function createBachsClient(options: { apiUrl: string; apiKey: string; fetchImpl?: typeof fetch }): BachsClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const call = async (path: string, body?: unknown) => {
    const response = await fetchImpl(`${options.apiUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { authorization: `Bearer ${options.apiKey}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new BachsError(response.status, `Bachs ${path} ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return response.json();
  };
  return {
    async createCheckoutSession(input) {
      const data = checkoutSchema.parse(
        await call("/v1/checkout-sessions", {
          product_cart: [{ product_id: input.productId, quantity: 1 }],
          customer: "customerId" in input.customer ? { customer_id: input.customer.customerId } : input.customer,
          billing_currency: "USD",
          // Bachs copies checkout metadata onto the subscription, so webhooks name our user.
          metadata: { user_id: input.userId },
          ...(input.successUrl ? { success_url: input.successUrl } : {}),
          ...(input.cancelUrl ? { cancel_url: input.cancelUrl } : {}),
        }),
      );
      return { checkoutUrl: data.checkout_url, checkoutId: data.checkout_id };
    },
    async createPortalSession(customerId) {
      return portalSchema.parse(await call(`/v1/customers/${encodeURIComponent(customerId)}/portal-sessions`));
    },
  };
}

function safeEqualHex(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Verify a delivery (X-Bachs-Signature-V2 `t=…,v1=…[,v1=…]`, falling back to
 * X-Bachs-Timestamp + X-Bachs-Signature): HMAC-SHA256 of "{t}.{raw body}",
 * any v1 may match (secret rotation), stale timestamps rejected.
 */
export function verifyBachsSignature(options: {
  rawBody: string;
  secret: string;
  headers: Headers;
  nowSeconds: number;
  toleranceSeconds?: number;
}): boolean {
  const { rawBody, secret, headers, nowSeconds, toleranceSeconds = 300 } = options;
  let timestamp: number;
  let signatures: string[];
  const v2 = headers.get("x-bachs-signature-v2");
  if (v2) {
    const parts = v2.split(",").map((p) => p.trim().split("=", 2) as [string, string | undefined]);
    timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
    signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  } else {
    timestamp = Number(headers.get("x-bachs-timestamp"));
    signatures = [headers.get("x-bachs-signature") ?? ""];
  }
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return signatures.some((s) => safeEqualHex(s, expected));
}

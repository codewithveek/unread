import "server-only";
import { type BachsClient, createBachsClient } from "@unread/core/billing";
import { serverEnv } from "@/lib/env";

export function bachsClient(): BachsClient | null {
  const env = serverEnv();
  if (!env.BACHS_API_KEY) return null;
  return createBachsClient({ apiUrl: env.BACHS_API_URL, apiKey: env.BACHS_API_KEY });
}

/** Bachs refuses localhost/private return URLs, even in sandbox. */
export function publicUrl(path: string): string | undefined {
  const base = serverEnv().APP_BASE_URL.replace(/\/$/, "");
  return /^https:\/\/(?!localhost|127\.|10\.|192\.168\.)/.test(base) ? `${base}${path}` : undefined;
}

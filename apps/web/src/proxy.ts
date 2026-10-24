import { auth0 } from "@/lib/auth0";

/**
 * Mounts /auth/* and keeps the rolling session fresh. Pages still check the
 * session themselves. Webhooks, the feed and audio are token/signature-based,
 * so they skip it.
 */
export async function proxy(request: Request) {
  return await auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|sitemap.xml|robots.txt|inbound/|feed/|audio/|billing/webhooks/|voices/).*)"],
};

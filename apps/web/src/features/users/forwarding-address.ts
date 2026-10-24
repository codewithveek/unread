import "server-only";
import { serverEnv } from "@/lib/env";

/** The user's private forwarding address, `<alias>@in.getunread.site`. */
export function forwardingAddress(inboundAlias: string): string {
  return `${inboundAlias}@${serverEnv().INBOUND_EMAIL_DOMAIN}`;
}

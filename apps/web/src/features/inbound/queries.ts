import "server-only";
import { schema } from "@unread/db";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";

export interface InboundStatus {
  newsletters: { name: string; at: string }[];
  confirmation: { code: string | null; url: string | null; at: string } | null;
  lastRejection: { reason: string; at: string } | null;
}

/** Live status for onboarding ("Got Morning Brew ✓") and the Gmail confirmation code (prd §9). */
export async function inboundStatus(userId: string): Promise<InboundStatus> {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const recent = await db()
    .select({ message: schema.inboundMessages, newsletter: schema.newsletters })
    .from(schema.inboundMessages)
    .leftJoin(schema.newsletters, eq(schema.newsletters.id, schema.inboundMessages.newsletterId))
    .where(and(eq(schema.inboundMessages.userId, userId), gt(schema.inboundMessages.receivedAt, since)))
    .orderBy(desc(schema.inboundMessages.receivedAt))
    .limit(30);
  const confirmation = recent.find((r) => r.message.kind === "forwarding_confirmation");
  const rejection = recent.find((r) => r.message.kind === "rejected");
  const names = new Map<string, string>();
  for (const r of recent) {
    if (r.newsletter && !names.has(r.newsletter.displayName)) names.set(r.newsletter.displayName, r.message.receivedAt.toISOString());
  }
  return {
    newsletters: Array.from(names, ([name, at]) => ({ name, at })).slice(0, 5),
    confirmation: confirmation
      ? { code: confirmation.message.confirmationCode, url: confirmation.message.confirmationUrl, at: confirmation.message.receivedAt.toISOString() }
      : null,
    lastRejection:
      rejection && rejection.message.rejectReason
        ? { reason: rejection.message.rejectReason, at: rejection.message.receivedAt.toISOString() }
        : null,
  };
}

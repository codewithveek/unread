import { type Database, schema } from "@unread/db";
import { and, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { storageKeys, type Storage } from "../storage";
import { normalizeForHash, sha256Hex } from "../util/hash";
import { aliasFromAddress, normalizeAddress } from "./address";
import { authVerdictFor } from "./auth";
import { htmlToBlocks, textToBlocks } from "./blocks";
import { detectForwardingConfirmation, isFromGmailForwarding } from "./confirmation";
import { detectBareLinks } from "./links";
import { parseEmail } from "./parse";
import { detectNewsletter, forwarderCandidates } from "./sender";
import { splitIntoItems } from "./split";

export interface ProcessInboundOptions {
  db: Database;
  storage: Storage;
  raw: Uint8Array;
  envelopeFrom: string;
  envelopeTo: string;
  inboundDomain: string;
  /** Accept mail with no Authentication-Results verdict (upstream already enforced SPF/DKIM). */
  trustUpstreamAuth: boolean;
  /** Raw emails bigger than this are rejected before parsing. */
  maxBytes?: number;
}

export type InboundOutcome =
  | { status: "duplicate" }
  | { status: "rejected"; reason: RejectReason; inboundId: string | null }
  | { status: "confirmation"; inboundId: string; code: string | null }
  | { status: "sender_verified"; inboundId: string; email: string }
  | { status: "issue"; inboundId: string; newsletterId: string; itemIds: string[] }
  | { status: "link"; inboundId: string; itemIds: string[] };

export type RejectReason = "too_large" | "unknown_alias" | "unverified_sender" | "auth_failed";

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

/**
 * The whole inbound path after the signed webhook (prd §4.1): find the user,
 * gate on verified sender + SPF/DKIM, store the raw mail, then classify into a
 * forwarding confirmation, a sender verification, bare links or a newsletter issue.
 * Rejected mail never reaches a model.
 */
export async function processInbound(options: ProcessInboundOptions): Promise<InboundOutcome> {
  const { db, storage, raw } = options;
  const envelopeFrom = normalizeAddress(options.envelopeFrom);
  const alias = aliasFromAddress(options.envelopeTo, options.inboundDomain);
  const fallbackId = `sha256:${sha256Hex(raw)}`;

  if (raw.byteLength > (options.maxBytes ?? DEFAULT_MAX_BYTES)) {
    return { status: "rejected", reason: "too_large", inboundId: null };
  }

  const email = await parseEmail(raw, fallbackId);
  const [user] = alias
    ? await db.select().from(schema.users).where(eq(schema.users.inboundAlias, alias)).limit(1)
    : [];

  const insertInbound = async (values: Omit<typeof schema.inboundMessages.$inferInsert, "messageId">) => {
    const [row] = await db
      .insert(schema.inboundMessages)
      .values({ messageId: email.messageId, fromEmail: envelopeFrom, subject: email.subject.slice(0, 500), ...values })
      .onConflictDoNothing()
      .returning({ id: schema.inboundMessages.id });
    return row?.id ?? null;
  };

  if (!user) {
    const inboundId = await insertInbound({ userId: null, kind: "rejected", status: "rejected", rejectReason: "unknown_alias" });
    return { status: "rejected", reason: "unknown_alias", inboundId };
  }

  const [existing] = await db
    .select({ id: schema.inboundMessages.id })
    .from(schema.inboundMessages)
    .where(and(eq(schema.inboundMessages.userId, user.id), eq(schema.inboundMessages.messageId, email.messageId)))
    .limit(1);
  if (existing) return { status: "duplicate" };

  const authOk = (address: string) => {
    const verdict = authVerdictFor(email, address);
    return verdict === "pass" || (verdict === "none" && options.trustUpstreamAuth);
  };

  // 1. Gmail forwarding confirmation: from Google, shown to the user, never processed further.
  if (isFromGmailForwarding(email)) {
    const confirmation = detectForwardingConfirmation(email);
    if (confirmation && authOk("forwarding-noreply@google.com")) {
      const inboundId = await insertInbound({
        userId: user.id,
        kind: "forwarding_confirmation",
        status: "processed",
        confirmationCode: confirmation.code,
        confirmationUrl: confirmation.url,
      });
      if (!inboundId) return { status: "duplicate" };
      return { status: "confirmation", inboundId, code: confirmation.code };
    }
  }

  const candidates = forwarderCandidates(email, envelopeFrom);
  const senders = await db
    .select()
    .from(schema.verifiedSenders)
    .where(eq(schema.verifiedSenders.userId, user.id));
  const byEmail = new Map(senders.map((s) => [s.email.toLowerCase(), s]));

  // 2. Proving ownership of an extra address: send any mail containing the code from it.
  for (const candidate of candidates) {
    const pending = byEmail.get(candidate);
    if (
      pending &&
      !pending.verifiedAt &&
      pending.verificationCode &&
      email.subject.toUpperCase().includes(pending.verificationCode.toUpperCase()) &&
      authOk(candidate)
    ) {
      await db
        .update(schema.verifiedSenders)
        .set({ verifiedAt: new Date(), verificationCode: null })
        .where(eq(schema.verifiedSenders.id, pending.id));
      const inboundId = await insertInbound({ userId: user.id, kind: "sender_verification", status: "processed" });
      if (!inboundId) return { status: "duplicate" };
      return { status: "sender_verified", inboundId, email: candidate };
    }
  }

  // 3. Only verified addresses may forward, and the mail must authenticate as them.
  const forwarder = candidates.find((c) => byEmail.get(c)?.verifiedAt);
  if (!forwarder) {
    const inboundId = await insertInbound({
      userId: user.id,
      kind: "rejected",
      status: "rejected",
      rejectReason: "unverified_sender",
    });
    return { status: "rejected", reason: "unverified_sender", inboundId };
  }
  if (!authOk(forwarder)) {
    const inboundId = await insertInbound({ userId: user.id, kind: "rejected", status: "rejected", rejectReason: "auth_failed" });
    return { status: "rejected", reason: "auth_failed", inboundId };
  }

  const links = detectBareLinks(email);
  const inboundId = await insertInbound({ userId: user.id, kind: links ? "link" : "issue", status: "received" });
  if (!inboundId) return { status: "duplicate" };

  const rawKey = storageKeys.rawEmail(user.id, inboundId);
  await storage.put(rawKey, raw, "message/rfc822");
  await db.update(schema.inboundMessages).set({ rawKey }).where(eq(schema.inboundMessages.id, inboundId));

  // 4a. A bare link (or a few): queued as link items; extraction happens next (links module).
  if (links) {
    const rows = await db
      .insert(schema.items)
      .values(
        links.map((url) => ({
          userId: user.id,
          sourceKind: "link" as const,
          inboundMessageId: inboundId,
          url,
          title: url,
        })),
      )
      .returning({ id: schema.items.id });
    await db.update(schema.inboundMessages).set({ status: "processed" }).where(eq(schema.inboundMessages.id, inboundId));
    return { status: "link", inboundId, itemIds: rows.map((r) => r.id) };
  }

  // 4b. A newsletter issue: find or create the sender, split into story items.
  const identity = detectNewsletter(email, [forwarder]);
  const receivedAt = email.date ?? new Date();
  let [newsletter] = await db
    .select()
    .from(schema.newsletters)
    .where(
      and(
        eq(schema.newsletters.userId, user.id),
        sql`lower(${schema.newsletters.senderEmail}) = ${identity.senderEmail.toLowerCase()}`,
      ),
    )
    .limit(1);
  if (!newsletter) {
    [newsletter] = await db
      .insert(schema.newsletters)
      .values({
        userId: user.id,
        senderEmail: identity.senderEmail,
        displayName: identity.displayName,
        listId: identity.listId,
        lastIssueAt: receivedAt,
      })
      .onConflictDoNothing()
      .returning();
    newsletter ??= (
      await db
        .select()
        .from(schema.newsletters)
        .where(
          and(
            eq(schema.newsletters.userId, user.id),
            sql`lower(${schema.newsletters.senderEmail}) = ${identity.senderEmail.toLowerCase()}`,
          ),
        )
        .limit(1)
    )[0];
  } else {
    await db
      .update(schema.newsletters)
      .set({ lastIssueAt: receivedAt, listId: newsletter.listId ?? identity.listId })
      .where(eq(schema.newsletters.id, newsletter.id));
  }
  if (!newsletter) throw new Error("Could not upsert newsletter");

  const blocks = email.html ? htmlToBlocks(email.html) : textToBlocks(email.text ?? "");
  const split = splitIntoItems(blocks);
  const withHashes = split.map((item) => ({ ...item, textHash: sha256Hex(normalizeForHash(item.text)) }));

  const known = withHashes.length
    ? await db
        .select({ textHash: schema.items.textHash })
        .from(schema.items)
        .where(and(eq(schema.items.userId, user.id), inArray(schema.items.textHash, withHashes.map((i) => i.textHash))))
    : [];
  const knownHashes = new Set(known.map((k) => k.textHash));
  const fresh = withHashes.filter(
    (item, index) => !knownHashes.has(item.textHash) && withHashes.findIndex((o) => o.textHash === item.textHash) === index,
  );

  const rows = fresh.length
    ? await db
        .insert(schema.items)
        .values(
          fresh.map((item) => ({
            userId: user.id,
            sourceKind: "newsletter" as const,
            newsletterId: newsletter.id,
            inboundMessageId: inboundId,
            url: item.links[0]?.url ?? null,
            title: item.title.slice(0, 300),
            text: item.text,
            textHash: item.textHash,
            links: item.links,
            publishedAt: receivedAt,
          })),
        )
        .returning({ id: schema.items.id })
    : [];

  await db
    .update(schema.inboundMessages)
    .set({ status: "processed", newsletterId: newsletter.id })
    .where(eq(schema.inboundMessages.id, inboundId));

  return { status: "issue", inboundId, newsletterId: newsletter.id, itemIds: rows.map((r) => r.id) };
}

/** Delete raw emails older than the retention window (prd §10: 30 days). */
export async function purgeRawEmails(options: { db: Database; storage: Storage; olderThanDays?: number }) {
  const { db, storage, olderThanDays = 30 } = options;
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
  const rows = await db
    .select({ id: schema.inboundMessages.id, rawKey: schema.inboundMessages.rawKey })
    .from(schema.inboundMessages)
    .where(and(isNotNull(schema.inboundMessages.rawKey), lt(schema.inboundMessages.receivedAt, cutoff)));
  for (const row of rows) {
    if (row.rawKey) await storage.delete(row.rawKey);
    await db.update(schema.inboundMessages).set({ rawKey: null }).where(eq(schema.inboundMessages.id, row.id));
  }
  // Unknown-alias rows carry no user data worth keeping.
  await db
    .delete(schema.inboundMessages)
    .where(and(isNull(schema.inboundMessages.userId), lt(schema.inboundMessages.receivedAt, cutoff)));
  return rows.length;
}


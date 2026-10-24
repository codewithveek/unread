import { schema } from "@unread/db";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { processInbound } from "../src/inbound";
import { createTestUser, fixture, randomAlias, tempStorage, testDatabaseUrl, testDb } from "./helpers";

const DOMAIN = "in.getunread.site";

describe.skipIf(!testDatabaseUrl)("processInbound", () => {
  const db = testDb();
  const storage = tempStorage();
  afterAll(async () => {
    await db.$client.end();
  });

  const run = async (name: string, alias: string, envelopeFrom = "lucky@example.com") =>
    processInbound({
      db,
      storage,
      raw: fixture(`email/${name}`),
      envelopeFrom,
      envelopeTo: `${alias}@${DOMAIN}`,
      inboundDomain: DOMAIN,
      trustUpstreamAuth: false,
    });

  it("stores a Gmail confirmation code for the app to show", async () => {
    const alias = randomAlias();
    const user = await createTestUser(db, { alias, email: "lucky@example.com" });
    const outcome = await run("gmail-confirmation.eml", alias, "forwarding-noreply@google.com");
    expect(outcome).toMatchObject({ status: "confirmation", code: "123456789" });
    const [row] = await db.select().from(schema.inboundMessages).where(eq(schema.inboundMessages.userId, user.id));
    expect(row?.confirmationUrl).toContain("mail-settings.google.com");
  });

  it("turns an auto-forwarded issue into a newsletter and story items, once", async () => {
    const alias = randomAlias();
    const user = await createTestUser(db, { alias, email: "lucky@example.com" });
    const outcome = await run("newsletter-autoforward.eml", alias);
    expect(outcome).toMatchObject({ status: "issue" });
    if (outcome.status !== "issue") throw new Error();
    expect(outcome.itemIds).toHaveLength(3);

    const [newsletter] = await db.select().from(schema.newsletters).where(eq(schema.newsletters.userId, user.id));
    expect(newsletter).toMatchObject({ displayName: "Morning Brew", senderEmail: "crew@morningbrew.com", enabled: true });

    const [inbound] = await db.select().from(schema.inboundMessages).where(eq(schema.inboundMessages.userId, user.id));
    expect(inbound?.rawKey).toBeTruthy();
    expect(await storage.get(inbound?.rawKey ?? "")).not.toBeNull();

    expect(await run("newsletter-autoforward.eml", alias)).toEqual({ status: "duplicate" });
  });

  it("handles a manual forward and credits the original newsletter", async () => {
    const alias = randomAlias();
    const user = await createTestUser(db, { alias, email: "lucky@example.com" });
    expect(await run("newsletter-manual-forward.eml", alias)).toMatchObject({ status: "issue" });
    const [newsletter] = await db.select().from(schema.newsletters).where(eq(schema.newsletters.userId, user.id));
    expect(newsletter?.displayName).toBe("The Hustle");
  });

  it("queues bare links", async () => {
    const alias = randomAlias();
    const user = await createTestUser(db, { alias, email: "lucky@example.com" });
    expect(await run("bare-link.eml", alias)).toMatchObject({ status: "link" });
    const items = await db.select().from(schema.items).where(eq(schema.items.userId, user.id));
    expect(items.map((i) => [i.sourceKind, i.url])).toEqual([["link", "https://example.org/long-read-on-sleep"]]);
  });

  it("rejects unverified senders and failed authentication without creating items", async () => {
    const alias = randomAlias();
    const user = await createTestUser(db, { alias, email: "someone-else@example.com" });
    expect(await run("newsletter-autoforward.eml", alias)).toMatchObject({ status: "rejected", reason: "unverified_sender" });

    const alias2 = randomAlias();
    await createTestUser(db, { alias: alias2, email: "lucky@example.com" });
    expect(await run("spoofed.eml", alias2)).toMatchObject({ status: "rejected", reason: "auth_failed" });

    const items = await db.select().from(schema.items).where(eq(schema.items.userId, user.id));
    expect(items).toHaveLength(0);
  });

  it("rejects mail to an unknown alias", async () => {
    expect(await run("newsletter-autoforward.eml", randomAlias())).toMatchObject({
      status: "rejected",
      reason: "unknown_alias",
    });
  });

  it("verifies an extra address when mail from it carries the code", async () => {
    const alias = randomAlias();
    const user = await createTestUser(db, { alias, email: "work@example.net" });
    await db
      .insert(schema.verifiedSenders)
      .values({ userId: user.id, email: "lucky@example.com", verificationCode: "UNREAD-7K2M" });
    const raw = new TextEncoder().encode(
      [
        "Return-Path: <lucky@example.com>",
        "Authentication-Results: mx.cloudflare.net; spf=pass smtp.mailfrom=lucky@example.com",
        "From: Lucky <lucky@example.com>",
        `To: ${alias}@${DOMAIN}`,
        "Subject: verify unread-7k2m",
        "Message-ID: <verify-1@example.com>",
        "Content-Type: text/plain",
        "",
        "hi",
      ].join("\r\n"),
    );
    const outcome = await processInbound({
      db,
      storage,
      raw,
      envelopeFrom: "lucky@example.com",
      envelopeTo: `${alias}@${DOMAIN}`,
      inboundDomain: DOMAIN,
      trustUpstreamAuth: false,
    });
    expect(outcome).toMatchObject({ status: "sender_verified", email: "lucky@example.com" });
    expect(await run("newsletter-autoforward.eml", alias)).toMatchObject({ status: "issue" });
  });
});

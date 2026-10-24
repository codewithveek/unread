import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, newFeedToken, schema } from "@unread/db";
import { createLocalStorage } from "../src/storage";

export function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(import.meta.dirname, "fixtures", name)));
}

export const testDatabaseUrl = process.env.TEST_DATABASE_URL;

export function testDb() {
  if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL not set");
  return createDb({ url: testDatabaseUrl, max: 2 });
}

export function tempStorage() {
  return createLocalStorage(mkdtempSync(join(tmpdir(), "unread-test-")));
}

export async function createTestUser(
  db: ReturnType<typeof testDb>,
  options: { alias: string; email: string; plan?: "free" | "plus" },
) {
  const [user] = await db
    .insert(schema.users)
    .values({
      auth0Sub: `test|${options.alias}|${Math.random()}`,
      email: options.email,
      feedToken: newFeedToken(),
      inboundAlias: options.alias,
      plan: options.plan ?? "free",
    })
    .returning();
  if (!user) throw new Error("no user");
  await db.insert(schema.verifiedSenders).values({ userId: user.id, email: options.email, verifiedAt: new Date() });
  return user;
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function randomAlias(): string {
  return Array.from({ length: 10 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
}

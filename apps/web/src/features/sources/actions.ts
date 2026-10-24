"use server";

import { schema } from "@unread/db";
import { rateLimit } from "@unread/core/util/rate-limit";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { ActionState } from "@/features/action-state";
import { extractQueuedLinks } from "@/features/links/extract-queued-links";
import { requireUser } from "@/features/users/current-user";
import { db } from "@/lib/db";

const urlSchema = z.url({ protocol: /^https?$/ }).max(2048);

/** Paste a link (prd §4.2): queued now, fetched after the response. */
export async function addLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const parsed = urlSchema.safeParse(String(formData.get("url") ?? "").trim());
  if (!parsed.success) return { error: "That doesn't look like a web link." };
  if (!(await rateLimit({ db: db(), key: `paste:${user.id}`, limit: 30, windowSeconds: 3600 }))) {
    return { error: "That's a lot of links for one hour. Try again later." };
  }
  const [item] = await db()
    .insert(schema.items)
    .values({ userId: user.id, sourceKind: "link", url: parsed.data, title: parsed.data })
    .returning({ id: schema.items.id });
  if (item) after(() => extractQueuedLinks([item.id]));
  revalidatePath("/sources");
  return { ok: true, message: "Added to your next episode." };
}

export async function removeItemAction(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const id = String(formData.get("itemId") ?? "");
  await db()
    .update(schema.items)
    .set({ status: "skipped" })
    .where(and(eq(schema.items.id, id), eq(schema.items.userId, user.id), eq(schema.items.status, "queued")));
  revalidatePath("/sources");
}

export async function toggleNewsletterAction(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const id = String(formData.get("newsletterId") ?? "");
  await db()
    .update(schema.newsletters)
    .set({ enabled: sql`not ${schema.newsletters.enabled}` })
    .where(and(eq(schema.newsletters.id, id), eq(schema.newsletters.userId, user.id)));
  revalidatePath("/sources");
}

const prioritySchema = z.enum(["always", "normal", "if_room"]);

export async function setPriorityAction(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const priority = prioritySchema.safeParse(formData.get("priority"));
  if (!priority.success) return;
  await db()
    .update(schema.newsletters)
    .set({ priority: priority.data })
    .where(and(eq(schema.newsletters.id, String(formData.get("newsletterId") ?? "")), eq(schema.newsletters.userId, user.id)));
  revalidatePath("/sources");
}

function verificationCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `UNREAD-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

/** Another address allowed to forward (prd §4.1). Proven by mailing the code from it. */
export async function addSenderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Enter an email address." };
  const existing = await db().select().from(schema.verifiedSenders).where(eq(schema.verifiedSenders.userId, user.id));
  if (existing.length >= 5) return { error: "You can add up to 5 addresses." };
  if (existing.some((s) => s.email.toLowerCase() === email.data)) return { error: "That address is already on your list." };
  await db().insert(schema.verifiedSenders).values({ userId: user.id, email: email.data, verificationCode: verificationCode() });
  revalidatePath("/sources");
  return { ok: true };
}

export async function removeSenderAction(formData: FormData): Promise<void> {
  const { user, sessionUser } = await requireUser();
  const id = String(formData.get("senderId") ?? "");
  const [sender] = await db()
    .select()
    .from(schema.verifiedSenders)
    .where(and(eq(schema.verifiedSenders.id, id), eq(schema.verifiedSenders.userId, user.id)));
  // The sign-in address always stays.
  if (!sender || sender.email.toLowerCase() === sessionUser.email?.toLowerCase()) return;
  await db().delete(schema.verifiedSenders).where(eq(schema.verifiedSenders.id, sender.id));
  revalidatePath("/sources");
}

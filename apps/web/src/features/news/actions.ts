"use server";

import { schema } from "@unread/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/features/action-state";
import { requireUser } from "@/features/users/current-user";
import { db } from "@/lib/db";
import { SUGGESTED_TOPICS } from "./topics";

const newsSchema = z.object({
  newsOptIn: z.enum(["on", "off"]).transform((v) => v === "on"),
  newsMode: z.enum(["always", "fill"]),
  newsCountry: z.string().regex(/^[A-Z]{2}$/),
  newsLanguage: z.string().regex(/^[a-z]{2}(-[A-Za-z]{2})?$/),
  topics: z.array(z.string().trim().min(2).max(60)).max(12),
});

/** prd §4.3: off by default; topics + edition + "always" / "fill quiet days". */
export async function saveNewsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const parsed = newsSchema.safeParse({
    newsOptIn: formData.get("newsOptIn") ?? "off",
    newsMode: formData.get("newsMode") ?? "fill",
    newsCountry: String(formData.get("newsCountry") ?? "US").toUpperCase(),
    newsLanguage: formData.get("newsLanguage") ?? "en",
    topics: formData.getAll("topics").map(String),
  });
  if (!parsed.success) return { error: "Check the news settings and try again." };
  const { topics, ...settings } = parsed.data;
  if (settings.newsOptIn && topics.length === 0) return { error: "Pick at least one topic, or turn news off." };

  await db().transaction(async (tx) => {
    await tx.update(schema.users).set(settings).where(eq(schema.users.id, user.id));
    await tx.delete(schema.userTopics).where(eq(schema.userTopics.userId, user.id));
    const unique = [...new Map(topics.map((t) => [t.toLowerCase(), t])).values()];
    if (unique.length) {
      await tx.insert(schema.userTopics).values(
        unique.map((label) => ({ userId: user.id, label, query: label, isCustom: !SUGGESTED_TOPIC_SET.has(label) })),
      );
    }
  });
  revalidatePath("/sources");
  return { ok: true, message: "News settings saved." };
}

const SUGGESTED_TOPIC_SET = new Set<string>(SUGGESTED_TOPICS);

"use server";

import { schema } from "@unread/db";
import { normalizeCode } from "@unread/core/promo";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/features/action-state";
import { db } from "@/lib/db";
import { requireAdmin } from "./guard";

const promoSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
  trialDays: z.coerce.number().int().min(1).max(90),
  trialEpisodeLimit: z.coerce.number().int().min(1).max(30),
  maxRedemptions: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(1).nullable()),
  expiresAt: z.preprocess((v) => (v === "" ? null : v), z.coerce.date().nullable()),
  note: z.string().max(200).optional(),
});

export async function createPromoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = promoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the fields" };
  const code = normalizeCode(parsed.data.code);
  const [row] = await db()
    .insert(schema.promoCodes)
    .values({ ...parsed.data, code })
    .onConflictDoNothing()
    .returning({ id: schema.promoCodes.id });
  if (!row) return { error: "That code already exists." };
  revalidatePath("/admin");
  return { ok: true, message: `Created ${code}.` };
}

export async function togglePromoAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await db()
    .update(schema.promoCodes)
    .set({ active: sql`not ${schema.promoCodes.active}` })
    .where(eq(schema.promoCodes.id, String(formData.get("id") ?? "")));
  revalidatePath("/admin");
}

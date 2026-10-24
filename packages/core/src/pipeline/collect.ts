import { type Database, schema } from "@unread/db";
import { and, desc, eq, gt, ne, or, sql } from "drizzle-orm";
import type { Candidate, Priority } from "./types";

function hostOf(url: string | null): string {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

/**
 * Step 1: queued items from enabled senders, links and news, newest first,
 * capped (prd §6). News is fetched separately (news module) before this runs.
 */
export async function collectCandidates(options: {
  db: Database;
  userId: string;
  now: Date;
  maxAgeDays?: number;
  limit?: number;
  /** "always": news gets a guaranteed segment; "fill": news only fills spare room (prd §4.3). */
  newsMode?: "always" | "fill";
}): Promise<Candidate[]> {
  const { db, userId, now, maxAgeDays = 21, limit = 60, newsMode = "fill" } = options;
  const since = new Date(now.getTime() - maxAgeDays * 86_400_000);
  const rows = await db
    .select({ item: schema.items, newsletter: schema.newsletters })
    .from(schema.items)
    .leftJoin(schema.newsletters, eq(schema.items.newsletterId, schema.newsletters.id))
    .where(
      and(
        eq(schema.items.userId, userId),
        eq(schema.items.status, "queued"),
        gt(schema.items.createdAt, since),
        or(ne(schema.items.sourceKind, "newsletter"), eq(schema.newsletters.enabled, true)),
        // Links still being fetched have neither text nor the limited flag yet.
        or(sql`${schema.items.text} is not null`, eq(schema.items.limited, true)),
      ),
    )
    .orderBy(desc(schema.items.createdAt))
    .limit(limit);

  return rows.map(({ item, newsletter }) => {
    const sourceLabel =
      item.sourceKind === "newsletter"
        ? (newsletter?.displayName ?? "A newsletter")
        : item.sourceKind === "news"
          ? `News · ${item.topicLabel ?? "Top stories"}`
          : `Your link${hostOf(item.url) ? ` · ${hostOf(item.url)}` : ""}`;
    // Links the user saved on purpose rank like "always"; news only fills.
    const priority: Priority =
      item.sourceKind === "newsletter"
        ? (newsletter?.priority ?? "normal")
        : item.sourceKind === "news"
          ? newsMode === "always"
            ? "normal"
            : "if_room"
          : "always";
    return {
      id: item.id,
      sourceKind: item.sourceKind,
      title: item.title,
      text: item.text ?? "",
      url: item.url,
      links: item.links ?? [],
      newsletterId: item.newsletterId,
      sourceLabel,
      priority,
      topicLabel: item.topicLabel,
      publishedAt: item.publishedAt ?? item.createdAt,
      limited: item.limited,
      embedding: item.embedding ?? null,
    };
  });
}

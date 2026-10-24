import "server-only";
import { schema } from "@unread/db";
import type { EpisodeTranscript } from "@unread/core/episodes/transcript";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";

/** Feed tokens are 32 url-safe chars (newFeedToken). */
const TOKEN = /^[A-Za-z0-9_-]{32}$/;

export async function userByFeedToken(token: string) {
  if (!TOKEN.test(token)) return null;
  const [user] = await db().select().from(schema.users).where(eq(schema.users.feedToken, token)).limit(1);
  return user ?? null;
}

export async function readyEpisodes(userId: string, limit = 30) {
  const rows = await db()
    .select()
    .from(schema.episodes)
    .where(and(eq(schema.episodes.userId, userId), eq(schema.episodes.status, "ready")))
    .orderBy(desc(schema.episodes.createdAt))
    .limit(limit);
  return rows.map((e) => ({ ...e, transcript: e.transcript as EpisodeTranscript }));
}

export async function readyEpisode(userId: string, episodeId: string) {
  const [row] = await db()
    .select()
    .from(schema.episodes)
    .where(and(eq(schema.episodes.id, episodeId), eq(schema.episodes.userId, userId), eq(schema.episodes.status, "ready")))
    .limit(1);
  return row ? { ...row, transcript: row.transcript as EpisodeTranscript } : null;
}

export const PRIVATE_HEADERS = {
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
} as const;

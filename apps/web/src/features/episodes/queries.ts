import "server-only";
import { schema } from "@unread/db";
import type { EpisodeTranscript } from "@unread/core/episodes/transcript";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";

export interface PlayerEpisode {
  id: string;
  title: string;
  audioUrl: string;
  coverUrl: string;
  durationS: number;
  createdAt: string;
  voiceProvider: "kokoro" | "elevenlabs" | null;
  transcript: EpisodeTranscript;
}

export function toPlayerEpisode(
  episode: typeof schema.episodes.$inferSelect,
  feedToken: string,
): PlayerEpisode {
  return {
    id: episode.id,
    title: episode.title ?? "Unread",
    audioUrl: `/audio/${feedToken}/${episode.id}.mp3`,
    coverUrl: `/feed/${feedToken}/cover/${episode.id}.png?size=1200`,
    durationS: episode.durationS ?? 0,
    createdAt: episode.createdAt.toISOString(),
    voiceProvider: episode.voiceProvider,
    transcript: episode.transcript as EpisodeTranscript,
  };
}

export interface HomeData {
  latest: PlayerEpisode | null;
  inProgress: { status: string; currentStep: string | null } | null;
  failure: string | null;
  queuedItems: number;
}

export async function loadHome(userId: string, feedToken: string): Promise<HomeData> {
  const [latest] = await db()
    .select()
    .from(schema.episodes)
    .where(and(eq(schema.episodes.userId, userId), eq(schema.episodes.status, "ready")))
    .orderBy(desc(schema.episodes.createdAt))
    .limit(1);
  const [request] = await db()
    .select({ request: schema.episodeRequests, episode: schema.episodes })
    .from(schema.episodeRequests)
    .leftJoin(schema.episodes, eq(schema.episodes.id, schema.episodeRequests.episodeId))
    .where(eq(schema.episodeRequests.userId, userId))
    .orderBy(desc(schema.episodeRequests.createdAt))
    .limit(1);
  const [queued] = await db()
    .select({ n: count() })
    .from(schema.items)
    .where(and(eq(schema.items.userId, userId), eq(schema.items.status, "queued")));

  const newerThanLatest = request && (!latest || request.request.createdAt > latest.createdAt);
  const active = request && (request.request.status === "pending" || request.request.status === "running");
  return {
    latest: latest ? toPlayerEpisode(latest, feedToken) : null,
    inProgress: newerThanLatest && active ? { status: request.episode?.status ?? "queued", currentStep: request.episode?.currentStep ?? null } : null,
    failure: newerThanLatest && request.request.status === "failed" ? (request.request.message ?? "something went wrong") : null,
    queuedItems: queued?.n ?? 0,
  };
}

export async function recentEpisodes(userId: string, feedToken: string, limit = 10): Promise<PlayerEpisode[]> {
  const rows = await db()
    .select()
    .from(schema.episodes)
    .where(and(eq(schema.episodes.userId, userId), inArray(schema.episodes.status, ["ready"])))
    .orderBy(desc(schema.episodes.createdAt))
    .limit(limit);
  return rows.map((e) => toPlayerEpisode(e, feedToken));
}

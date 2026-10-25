import "server-only";
import { schema } from "@unread/db";
import type { EpisodeTranscript } from "@unread/core/episodes/transcript";
import { and, count, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
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

export interface EpisodeProgress {
  status: string;
  currentStep: string | null;
  /** When the runner picked it up (null while still queued). */
  startedAt: string | null;
  /** Lines voiced so far, while the voice step runs. */
  voice: { done: number; total: number } | null;
}

/** The latest request ended without a new episode: it failed, or was skipped (not enough content, plan limit). */
export interface HomeNotice {
  kind: "failed" | "skipped";
  message: string;
}

export interface HomeData {
  latest: PlayerEpisode | null;
  inProgress: EpisodeProgress | null;
  notice: HomeNotice | null;
  queuedItems: number;
}

const voiceProgressSchema = z.object({ progress: z.object({ done: z.number(), total: z.number() }) });

async function voiceProgress(episodeId: string): Promise<EpisodeProgress["voice"]> {
  const [run] = await db()
    .select({ timings: schema.stepRuns.timings })
    .from(schema.stepRuns)
    .where(and(eq(schema.stepRuns.episodeId, episodeId), eq(schema.stepRuns.step, "voice"), eq(schema.stepRuns.status, "running")))
    .orderBy(desc(schema.stepRuns.attempt))
    .limit(1);
  const parsed = voiceProgressSchema.safeParse(run?.timings);
  return parsed.success ? parsed.data.progress : null;
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
  const status = newerThanLatest ? request.request.status : null;
  // A skip is news for a day; after that it's just noise above the last episode.
  const finishedAt = request?.request.finishedAt?.getTime() ?? 0;
  const freshSkip = status === "skipped" && Date.now() - finishedAt < 24 * 3_600_000;
  const inProgress: EpisodeProgress | null =
    request && active && newerThanLatest
      ? {
          status: request.episode?.status ?? "queued",
          currentStep: request.episode?.currentStep ?? null,
          startedAt: request.request.startedAt?.toISOString() ?? null,
          voice: request.episode?.currentStep === "voice" && request.episode.id ? await voiceProgress(request.episode.id) : null,
        }
      : null;
  return {
    latest: latest ? toPlayerEpisode(latest, feedToken) : null,
    inProgress,
    notice:
      request && (status === "failed" || freshSkip)
        ? { kind: status === "failed" ? "failed" : "skipped", message: request.request.message ?? (status === "failed" ? "something went wrong" : "Nothing new to make an episode from yet.") }
        : null,
    queuedItems: queued?.n ?? 0,
  };
}

/** Ready episodes, newest first; `excludeId` leaves out the one Home already shows. */
export async function recentEpisodes(options: { userId: string; feedToken: string; limit?: number; excludeId?: string }): Promise<PlayerEpisode[]> {
  const { userId, feedToken, limit = 10, excludeId } = options;
  const rows = await db()
    .select()
    .from(schema.episodes)
    .where(
      and(
        eq(schema.episodes.userId, userId),
        inArray(schema.episodes.status, ["ready"]),
        excludeId ? ne(schema.episodes.id, excludeId) : undefined,
      ),
    )
    .orderBy(desc(schema.episodes.createdAt))
    .limit(limit);
  return rows.map((e) => toPlayerEpisode(e, feedToken));
}

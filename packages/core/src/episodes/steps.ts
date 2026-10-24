import { schema } from "@unread/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { assembleEpisode, decodeToPcm } from "../audio";
import { coverSvg, renderCoverPng } from "../cover";
import { fetchNewsItems } from "../news";
import { buildScript, type EpisodeScript, MAX_CHAPTER_CHARS, MIN_CHAPTER_CHARS, scriptCharacters } from "../pipeline";
import { loadPlanContext } from "../plans";
import { getJson, putJson, storageKeys } from "../storage";
import { spokenDate } from "../util/dates";
import { DEFAULT_ELEVENLABS_VOICE } from "../voice/elevenlabs";
import { type VoiceClip, withVoiceCache } from "../voice";
import type { EpisodeDeps } from "./deps";
import { recordSteps, trackStep } from "./step-tracker";
import type { EpisodeTranscript } from "./transcript";


interface ScriptOutput {
  script: EpisodeScript;
  stats: Record<string, unknown>;
}

interface VoiceOutput {
  durationS: number;
  audioBytes: number;
  chapters: { title: string; startS: number; endS: number; lineStarts: number[] }[];
  introLineStarts: number[];
  outroLineStarts: number[];
}

export type StartResult = { status: "started"; episodeId: string } | { status: "skipped"; message: string };
export type PrepareResult = { status: "ok" } | { status: "skipped"; message: string };

const nowOf = (deps: EpisodeDeps) => deps.now?.() ?? new Date();

async function loadEpisode(deps: EpisodeDeps, episodeId: string) {
  const [row] = await deps.db
    .select({ episode: schema.episodes, user: schema.users })
    .from(schema.episodes)
    .innerJoin(schema.users, eq(schema.users.id, schema.episodes.userId))
    .where(eq(schema.episodes.id, episodeId))
    .limit(1);
  if (!row) throw new Error(`No episode ${episodeId}`);
  return row;
}

async function finishRequest(deps: EpisodeDeps, episodeId: string, status: "done" | "skipped" | "failed", message?: string) {
  await deps.db
    .update(schema.episodeRequests)
    .set({ status, message: message ?? null, finishedAt: nowOf(deps) })
    .where(eq(schema.episodeRequests.episodeId, episodeId));
}

/** Claim the request, check the plan allows an episode, and create the episode row. */
export async function startEpisode(deps: EpisodeDeps, requestId: string): Promise<StartResult> {
  const { db } = deps;
  const now = nowOf(deps);
  const [request] = await db.select().from(schema.episodeRequests).where(eq(schema.episodeRequests.id, requestId)).limit(1);
  if (!request) throw new Error(`No request ${requestId}`);
  if (request.episodeId && request.status === "running") return { status: "started", episodeId: request.episodeId };
  if (request.status === "done" || request.status === "skipped") {
    return { status: "skipped", message: request.message ?? "Already handled" };
  }

  const ctx = await loadPlanContext({ db, userId: request.userId, now });
  if (ctx.budget.blocked) {
    await db
      .update(schema.episodeRequests)
      .set({ status: "skipped", message: ctx.budget.blocked, finishedAt: now })
      .where(eq(schema.episodeRequests.id, requestId));
    return { status: "skipped", message: ctx.budget.blocked };
  }

  const [episode] = await db
    .insert(schema.episodes)
    .values({
      userId: request.userId,
      date: request.date,
      status: "planning",
      currentStep: "collect",
      voiceProvider: ctx.plan.voiceProvider,
    })
    .returning({ id: schema.episodes.id });
  if (!episode) throw new Error("Could not create episode");
  await db
    .update(schema.episodeRequests)
    .set({ status: "running", startedAt: now, episodeId: episode.id })
    .where(eq(schema.episodeRequests.id, requestId));
  return { status: "started", episodeId: episode.id };
}

/**
 * Opt-in news before collecting (prd §4.3): "always" fetches every time;
 * "fill" only when queued newsletters and links won't fill ~75% of the budget.
 */
export async function maybeFetchNews(deps: EpisodeDeps, options: { userId: string; maxChars: number; now: Date }): Promise<number> {
  const { db } = deps;
  const apiKey = deps.config.env.SERPAPI_API_KEY;
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, options.userId)).limit(1);
  if (!user?.newsOptIn || !apiKey) return 0;
  const topics = await db.select().from(schema.userTopics).where(eq(schema.userTopics.userId, user.id));
  if (topics.length === 0) return 0;
  if (user.newsMode === "fill") {
    const queued = await db
      .select({ length: sql<number>`coalesce(length(${schema.items.text}), 0)::int` })
      .from(schema.items)
      .where(and(eq(schema.items.userId, user.id), eq(schema.items.status, "queued"), sql`${schema.items.sourceKind} <> 'news'`));
    const estimate = queued.reduce((sum, q) => sum + Math.max(MIN_CHAPTER_CHARS, Math.min(MAX_CHAPTER_CHARS, q.length * 0.28)), 0);
    if (estimate >= options.maxChars * 0.75) return 0;
  }
  const ids = await fetchNewsItems({
    db,
    userId: user.id,
    apiKey,
    country: user.newsCountry ?? "US",
    language: user.newsLanguage ?? "en",
    topics: topics.map((t) => t.query),
    now: options.now,
  });
  return ids.length;
}

/** Steps 1–6. Not enough new content → no episode, no cost (prd §6). */
export async function prepareScript(deps: EpisodeDeps, episodeId: string): Promise<PrepareResult> {
  const { db, storage } = deps;
  const now = nowOf(deps);
  const { episode, user } = await loadEpisode(deps, episodeId);
  const existing = await getJson<ScriptOutput>(storage, storageKeys.stepOutput(user.id, episodeId, "script"));
  if (existing) return { status: "ok" };

  const ctx = await loadPlanContext({ db, userId: user.id, now });
  await maybeFetchNews(deps, { userId: user.id, maxChars: ctx.budget.maxChars, now });
  const result = await buildScript({
    newsMode: user.newsMode,
    db,
    model: deps.model(),
    embedder: deps.embedder,
    userId: user.id,
    maxChars: ctx.budget.maxChars,
    dateLabel: spokenDate(now, user.timezone),
    now,
  });
  await recordSteps({ db, episodeId, timingsMs: result.stats.timingsMs });

  if (result.status !== "ok" || !result.script) {
    const message = "Not enough new content yet. Forward a couple of newsletters and we'll make the next one.";
    await finishRequest(deps, episodeId, "skipped", message);
    await db.delete(schema.episodes).where(eq(schema.episodes.id, episodeId));
    return { status: "skipped", message };
  }

  const key = storageKeys.stepOutput(user.id, episodeId, "script");
  await putJson(storage, key, { script: result.script, stats: { ...result.stats, check: result.check } } satisfies ScriptOutput);
  await db
    .update(schema.episodes)
    .set({
      status: "voicing",
      currentStep: "voice",
      title: result.script.title,
      characters: scriptCharacters(result.script),
      voiceProvider: episode.voiceProvider ?? ctx.plan.voiceProvider,
    })
    .where(eq(schema.episodes.id, episodeId));
  return { status: "ok" };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index] as T, index);
      }
    }),
  );
  return results;
}

async function loadSfx(deps: EpisodeDeps) {
  const rows = await deps.db
    .select()
    .from(schema.audioAssets)
    .where(inArray(schema.audioAssets.key, ["sfx-intro", "sfx-transition", "sfx-outro"]));
  const decode = async (key: string) => {
    const row = rows.find((r) => r.key === key);
    const bytes = row ? await deps.storage.get(row.storageKey) : null;
    return bytes ? decodeToPcm(deps.config.env.FFMPEG_PATH, bytes) : undefined;
  };
  return { intro: await decode("sfx-intro"), transition: await decode("sfx-transition"), outro: await decode("sfx-outro") };
}

/** Step 7: voice every line (cached), add SFX, normalise, upload the MP3. */
export async function voiceEpisode(deps: EpisodeDeps, episodeId: string, heartbeat?: (detail: unknown) => void): Promise<void> {
  const { db, storage } = deps;
  const { episode, user } = await loadEpisode(deps, episodeId);
  const voiceKey = storageKeys.stepOutput(user.id, episodeId, "voice");
  if (await getJson<VoiceOutput>(storage, voiceKey)) return;
  const output = await getJson<ScriptOutput>(storage, storageKeys.stepOutput(user.id, episodeId, "script"));
  if (!output) throw new Error("Script missing; run prepareScript first");
  const { script } = output;

  await trackStep({
    db,
    episodeId,
    step: "voice",
    outputRef: voiceKey,
    run: async () => {
      const providerId = episode.voiceProvider ?? "kokoro";
      // Studio quality is a Plus option; trials use Flash (prd §8.3 caps trial cost).
      const ctx = await loadPlanContext({ db, userId: user.id, now: nowOf(deps) });
      const quality = providerId === "elevenlabs" && ctx.plan.source === "paid" ? user.voiceQuality : "flash";
      const provider = withVoiceCache(deps.voiceFor(providerId, { quality }), storage);
      const voiceId = providerId === "kokoro" ? user.kokoroVoiceId : (user.elevenlabsVoiceId ?? DEFAULT_ELEVENLABS_VOICE);

      const texts = [
        ...script.intro.map((l) => l.text),
        ...script.chapters.flatMap((c) => [`${c.title}.`, ...c.lines.map((l) => l.text)]),
        ...script.outro.map((l) => l.text),
      ];
      let done = 0;
      const clips = await mapLimit(texts, provider.concurrency, async (text, i): Promise<VoiceClip> => {
        const clip = await provider.synthesize({ text, voiceId, previousText: texts[i - 1], nextText: texts[i + 1] });
        heartbeat?.({ done: ++done, total: texts.length });
        return clip;
      });

      let cursor = 0;
      const take = (n: number) => clips.slice(cursor, (cursor += n)).map((c) => c.samples);
      const intro = take(script.intro.length);
      const chapters = script.chapters.map((c) => ({ title: c.title, clips: take(c.lines.length + 1) }));
      const outro = take(script.outro.length);

      const assembled = await assembleEpisode({
        ffmpegPath: deps.config.env.FFMPEG_PATH,
        intro,
        chapters,
        outro,
        sfx: await loadSfx(deps),
        title: script.title,
      });
      const audioKey = storageKeys.episodeAudio(user.id, episodeId);
      await storage.put(audioKey, assembled.mp3, "audio/mpeg");
      await putJson(storage, voiceKey, {
        durationS: assembled.durationS,
        audioBytes: assembled.mp3.byteLength,
        // Line starts include the spoken chapter title as line 0; drop it for the transcript.
        chapters: assembled.chapters.map((c) => ({ ...c, lineStarts: c.lineStarts.slice(1) })),
        introLineStarts: assembled.introLineStarts,
        outroLineStarts: assembled.outroLineStarts,
      } satisfies VoiceOutput);
      await db
        .update(schema.episodes)
        .set({
          audioKey,
          audioBytes: assembled.mp3.byteLength,
          durationS: assembled.durationS,
          voiceModel: provider.model,
          costCents: Math.round(((episode.characters ?? 0) / 1000) * provider.centsPer1kChars),
        })
        .where(eq(schema.episodes.id, episodeId));
    },
  });
}

function coverDateParts(date: string): { day: string; caption: string } {
  const d = new Date(`${date}T12:00:00Z`);
  const month = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }).toUpperCase();
  const weekday = d.toLocaleString("en-GB", { weekday: "short", timeZone: "UTC" }).toUpperCase();
  return { day: String(d.getUTCDate()), caption: `${month} · ${weekday}` };
}

/** Step 8: seeded cover at 3000 px (feed) and 1200 px (app). */
export async function renderEpisodeCover(deps: EpisodeDeps, episodeId: string): Promise<void> {
  const { db, storage } = deps;
  const { episode, user } = await loadEpisode(deps, episodeId);
  if (episode.coverKey) return;
  const output = await getJson<ScriptOutput>(storage, storageKeys.stepOutput(user.id, episodeId, "script"));
  const sources = [
    ...new Set(output?.script.chapters.flatMap((c) => c.sources.map((s) => s.label.replace(/^Your link.*/, "Your links"))) ?? []),
  ];
  await trackStep({
    db,
    episodeId,
    step: "cover",
    run: async () => {
      const svg = coverSvg({ seed: `${user.id}:${episode.date}:${sources.slice(0, 3).join("|")}`, ...coverDateParts(episode.date), sources });
      for (const size of [3000, 1200]) {
        await storage.put(storageKeys.episodeCover(user.id, episodeId, size), renderCoverPng(svg, size), "image/png");
      }
      await db
        .update(schema.episodes)
        .set({ coverKey: storageKeys.episodeCover(user.id, episodeId, 3000) })
        .where(eq(schema.episodes.id, episodeId));
    },
  });
}

/**
 * Step 9: chapters + sources, heard items, mark items used, usage and trial
 * counters, all in one transaction, then the episode is ready.
 */
export async function publishEpisode(deps: EpisodeDeps, episodeId: string): Promise<void> {
  const { db, storage } = deps;
  const now = nowOf(deps);
  const { episode, user } = await loadEpisode(deps, episodeId);
  if (episode.status === "ready") return;
  const scriptOut = await getJson<ScriptOutput>(storage, storageKeys.stepOutput(user.id, episodeId, "script"));
  const voiceOut = await getJson<VoiceOutput>(storage, storageKeys.stepOutput(user.id, episodeId, "voice"));
  if (!scriptOut || !voiceOut) throw new Error("Script or audio missing");
  const { script } = scriptOut;
  const ctx = await loadPlanContext({ db, userId: user.id, now });

  const transcript: EpisodeTranscript = {
    intro: script.intro.map((l, i) => ({ text: l.text, sourceIds: [], startS: voiceOut.introLineStarts[i] ?? 0 })),
    chapters: script.chapters.map((c, ci) => {
      const timing = voiceOut.chapters[ci];
      return {
        title: c.title,
        origin: c.origin,
        startS: timing?.startS ?? 0,
        endS: timing?.endS ?? 0,
        sources: c.sources,
        lines: c.lines.map((l, li) => ({ text: l.text, sourceIds: l.sourceIds, startS: timing?.lineStarts[li] ?? timing?.startS ?? 0 })),
      };
    }),
    outro: script.outro.map((l, i) => ({ text: l.text, sourceIds: [], startS: voiceOut.outroLineStarts[i] ?? 0 })),
  };

  await trackStep({
    db,
    episodeId,
    step: "publish",
    run: () =>
      db.transaction(async (tx) => {
        for (const [position, chapter] of transcript.chapters.entries()) {
          const [row] = await tx
            .insert(schema.chapters)
            .values({
              episodeId,
              position,
              title: chapter.title,
              startS: chapter.startS,
              endS: chapter.endS,
              summary: chapter.lines[0]?.text ?? null,
              script: chapter.lines,
            })
            .onConflictDoNothing()
            .returning({ id: schema.chapters.id });
          if (!row) continue;
          await tx
            .insert(schema.chapterSources)
            .values(chapter.sources.map((s) => ({ chapterId: row.id, itemId: s.itemId, role: s.role })))
            .onConflictDoNothing();
          await tx
            .insert(schema.heardItems)
            .values(chapter.sources.map((s) => ({ userId: user.id, itemId: s.itemId, clusterKey: script.chapters[position]?.clusterKey ?? s.itemId, episodeId })))
            .onConflictDoNothing();
        }
        const usedIds = transcript.chapters.flatMap((c) => c.sources.map((s) => s.itemId));
        if (usedIds.length) await tx.update(schema.items).set({ status: "used" }).where(inArray(schema.items.id, usedIds));

        const elevenChars = episode.voiceProvider === "elevenlabs" ? (episode.characters ?? 0) : 0;
        await tx
          .insert(schema.usageMonthly)
          .values({ userId: user.id, month: ctx.usage.month, charactersUsed: elevenChars, episodesMade: 1 })
          .onConflictDoUpdate({
            target: [schema.usageMonthly.userId, schema.usageMonthly.month],
            set: {
              charactersUsed: sql`${schema.usageMonthly.charactersUsed} + ${elevenChars}`,
              episodesMade: sql`${schema.usageMonthly.episodesMade} + 1`,
            },
          });

        // Trial: count the Studio episode; the 3rd one ends the trial (prd §8.3).
        if (ctx.plan.trial && episode.voiceProvider === "elevenlabs") {
          await tx
            .update(schema.promoRedemptions)
            .set({
              episodesUsed: sql`${schema.promoRedemptions.episodesUsed} + 1`,
              endedAt: sql`case when ${schema.promoRedemptions.episodesUsed} + 1 >= ${schema.promoRedemptions.episodeLimit} then now() else ${schema.promoRedemptions.endedAt} end`,
              endedReason: sql`case when ${schema.promoRedemptions.episodesUsed} + 1 >= ${schema.promoRedemptions.episodeLimit} then 'episodes'::trial_ended_reason else ${schema.promoRedemptions.endedReason} end`,
            })
            .where(and(eq(schema.promoRedemptions.id, ctx.plan.trial.redemptionId), sql`${schema.promoRedemptions.endedAt} is null`));
        }

        await tx
          .update(schema.episodes)
          .set({ status: "ready", currentStep: null, transcript, durationS: voiceOut.durationS, audioBytes: voiceOut.audioBytes, error: null })
          .where(eq(schema.episodes.id, episodeId));
        await tx
          .update(schema.episodeRequests)
          .set({ status: "done", finishedAt: now })
          .where(eq(schema.episodeRequests.episodeId, episodeId));
      }),
  });
}

/** Failure shown to the user (prd §12): "Today's episode couldn't be made: [reason]". Earlier episodes stay. */
export async function failEpisode(deps: EpisodeDeps, episodeId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const friendly = /ElevenLabs|VoiceNotConfigured/i.test(message)
    ? "the Studio voice isn't available right now"
    : /GEMINI|OPENROUTER|Model|Gemini|openrouter/i.test(message)
      ? "the writing model didn't respond"
      : "something went wrong on our side";
  await deps.db
    .update(schema.episodes)
    .set({ status: "failed", error: { message: friendly, detail: message.slice(0, 1000) } })
    .where(eq(schema.episodes.id, episodeId));
  await finishRequest(deps, episodeId, "failed", friendly);
}


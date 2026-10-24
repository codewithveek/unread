import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { schema } from "@unread/db";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { createEmbeddingGemma } from "../src/embeddings";
import { type EpisodeDeps, type EpisodeTranscript, makeEpisode, requestEpisodeNow } from "../src/episodes";
import { buildFeedXml, chaptersJson } from "../src/feed";
import { processInbound } from "../src/inbound";
import { createKokoroProvider, type VoiceProvider } from "../src/voice";
import { createFakeModel } from "./fake-model";
import { createTestUser, fixture, randomAlias, tempStorage, testDatabaseUrl, testDb } from "./helpers";

const run = Boolean(testDatabaseUrl && process.env.RUN_EMBEDDING_TESTS);

/** prd §13 U3 + §14: a real MP3 with chapters, cited sources, heard-once, trial limits. */
describe.skipIf(!run)("makeEpisode end to end (real EmbeddingGemma + Kokoro + ffmpeg)", () => {
  const db = testDb();
  const storage = tempStorage();
  const config = loadConfig({ ...process.env, DATABASE_URL: testDatabaseUrl });
  const kokoro = createKokoroProvider({ modelId: config.env.KOKORO_MODEL, concurrency: 2 });
  // Stand-in for ElevenLabs: silent clips, so trial accounting can be tested without the API.
  const studio: VoiceProvider = {
    id: "elevenlabs",
    model: "fake-studio",
    centsPer1kChars: 4,
    concurrency: 4,
    async synthesize({ text }) {
      return { samples: new Float32Array(Math.max(2400, text.length * 160)), sampleRate: 24_000 };
    },
  };
  const deps: EpisodeDeps = {
    config,
    db,
    storage,
    model: () => createFakeModel(),
    embedder: createEmbeddingGemma({ modelId: config.env.EMBEDDING_MODEL }),
    voiceFor: (id) => (id === "kokoro" ? kokoro : studio),
    now: () => new Date("2026-10-24T12:00:00Z"),
  };
  afterAll(async () => {
    await db.$client.end();
  });

  const forward = async (alias: string, name: string) =>
    processInbound({
      db,
      storage,
      raw: fixture(`email/${name}`),
      envelopeFrom: "lucky@example.com",
      envelopeTo: `${alias}@in.getunread.site`,
      inboundDomain: "in.getunread.site",
      trustUpstreamAuth: false,
    });

  it("makes a Kokoro episode with chapters and sources, and never repeats a heard story", async () => {
    const alias = randomAlias();
    const user = await createTestUser(db, { alias, email: "lucky@example.com" });
    for (const name of ["newsletter-autoforward.eml", "newsletter-manual-forward.eml", "newsletter-tldr.eml"]) await forward(alias, name);

    const requestId = await requestEpisodeNow({ db, userId: user.id, timezone: "UTC", now: new Date(), dailyLimit: 5 });
    const result = await makeEpisode(deps, requestId);
    expect(result.status, JSON.stringify(result)).toBe("ready");
    if (result.status !== "ready") return;

    const [episode] = await db.select().from(schema.episodes).where(eq(schema.episodes.id, result.episodeId));
    expect(episode).toMatchObject({ status: "ready", voiceProvider: "kokoro", costCents: 0 });
    const audio = await storage.get(episode?.audioKey ?? "");
    expect(audio?.byteLength).toBe(episode?.audioBytes);
    expect(await storage.get(episode?.coverKey ?? "")).not.toBeNull();

    // ffprobe agrees with the stored duration (±1 s).
    const mp3Path = join(mkdtempSync(join(tmpdir(), "unread-mp3-")), "episode.mp3");
    writeFileSync(mp3Path, audio ?? new Uint8Array());
    const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3Path]);
    expect(Math.abs(Number(probe.stdout.toString()) - (episode?.durationS ?? 0))).toBeLessThan(1);

    const transcript = episode?.transcript as EpisodeTranscript;
    expect(transcript.chapters.length).toBeGreaterThanOrEqual(3);
    const merged = transcript.chapters.find((c) => c.sources.length >= 3);
    expect(merged?.origin).toMatch(/also in/);
    for (const c of transcript.chapters) {
      expect(c.endS).toBeGreaterThan(c.startS);
      expect(c.lines.every((l, i) => i === 0 || l.startS > (c.lines[i - 1]?.startS ?? 0))).toBe(true);
    }

    const chapterRows = await db.select().from(schema.chapters).where(eq(schema.chapters.episodeId, result.episodeId));
    expect(chapterRows).toHaveLength(transcript.chapters.length);
    const [usage] = await db.select().from(schema.usageMonthly).where(eq(schema.usageMonthly.userId, user.id));
    expect(usage).toMatchObject({ episodesMade: 1, charactersUsed: 0 });

    const xml = buildFeedXml({
      baseUrl: "https://getunread.site",
      feedToken: user.feedToken,
      ownerLabel: "Unread",
      episodes: [{ id: result.episodeId, title: episode?.title ?? "", createdAt: new Date(), durationS: episode?.durationS ?? 0, audioBytes: episode?.audioBytes ?? 0, transcript }],
    });
    expect(xml).toContain(`<enclosure url="https://getunread.site/audio/${user.feedToken}/${result.episodeId}.mp3" length="${audio?.byteLength}"`);
    expect(xml).toContain("<itunes:block>yes</itunes:block>");
    expect(xml).toContain("openai.com/blog/new-model");
    expect(xml).not.toContain("lucky@example.com");
    expect(JSON.parse(chaptersJson(transcript)).chapters.length).toBe(transcript.chapters.length + 1);

    // Next day: the OpenAI story again from a new newsletter is dropped as already heard.
    await forward(alias, "newsletter-repeat.eml");
    const second = await makeEpisode({ ...deps, now: () => new Date("2026-10-25T12:00:00Z") }, await requestEpisodeNow({ db, userId: user.id, timezone: "UTC", now: new Date(), dailyLimit: 5 }));
    if (second.status === "ready") {
      const [ep2] = await db.select().from(schema.episodes).where(eq(schema.episodes.id, second.episodeId));
      const titles = (ep2?.transcript as EpisodeTranscript).chapters.map((c) => c.title).join(" | ");
      expect(titles).not.toMatch(/OpenAI/);
      expect(titles).toMatch(/Satellite/);
    } else {
      // One fresh item alone is below the 2-item minimum: also correct, never padded.
      expect(second.status).toBe("skipped");
    }
    const repeat = await db
      .select()
      .from(schema.items)
      .where(and(eq(schema.items.userId, user.id), eq(schema.items.title, "OpenAI's reasoning model gets cheaper")));
    expect(repeat[0]?.status).toBe("skipped");
  }, 600_000);

  it("a promo trial uses the Studio voice, counts episodes, ends after the limit and keeps unused items", async () => {
    const alias = randomAlias();
    const user = await createTestUser(db, { alias, email: "lucky@example.com" });
    const [code] = await db.insert(schema.promoCodes).values({ code: `TEST-${alias}`, trialDays: 14, trialEpisodeLimit: 1 }).returning();
    await db.insert(schema.promoRedemptions).values({
      codeId: code?.id ?? "",
      userId: user.id,
      trialEndsAt: new Date("2026-11-07T00:00:00Z"),
      episodeLimit: 1,
    });
    for (const name of ["newsletter-autoforward.eml", "newsletter-manual-forward.eml", "newsletter-tldr.eml"]) await forward(alias, name);
    await db.update(schema.users).set({ episodeMinutes: 5 }).where(eq(schema.users.id, user.id));

    const result = await makeEpisode(deps, await requestEpisodeNow({ db, userId: user.id, timezone: "UTC", now: new Date(), dailyLimit: 5 }));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const [episode] = await db.select().from(schema.episodes).where(eq(schema.episodes.id, result.episodeId));
    expect(episode).toMatchObject({ voiceProvider: "elevenlabs", voiceModel: "fake-studio" });
    expect(episode?.costCents).toBeGreaterThan(0);

    const [redemption] = await db.select().from(schema.promoRedemptions).where(eq(schema.promoRedemptions.userId, user.id));
    expect(redemption).toMatchObject({ episodesUsed: 1, endedReason: "episodes" });
    // Items the trial episode didn't use stay queued for the next (Free) episode.
    const transcript = episode?.transcript as EpisodeTranscript;
    const used = new Set(transcript.chapters.flatMap((c) => c.sources.map((x) => x.itemId)));
    const items = await db.select().from(schema.items).where(eq(schema.items.userId, user.id));
    for (const item of items) expect(item.status).toBe(used.has(item.id) ? "used" : "queued");
    const [usage] = await db.select().from(schema.usageMonthly).where(eq(schema.usageMonthly.userId, user.id));
    expect(usage?.charactersUsed).toBe(episode?.characters);
  }, 600_000);
});

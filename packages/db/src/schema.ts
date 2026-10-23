import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  vector,
  date,
} from "drizzle-orm/pg-core";
import { newId } from "./ids";

/** EmbeddingGemma's full output size. See docs/decisions/0003-database-and-ids.md. */
export const EMBEDDING_DIMENSIONS = 768;

export const EPISODE_MINUTES = [5, 15, 30] as const;
export type EpisodeMinutes = (typeof EPISODE_MINUTES)[number];

export const savedItemKind = pgEnum("saved_item_kind", ["link", "email", "rss"]);
export const savedItemStatus = pgEnum("saved_item_status", ["queued", "used", "skipped"]);
export const episodeStatus = pgEnum("episode_status", ["planning", "voicing", "ready", "failed"]);
export const chapterSourceRole = pgEnum("chapter_source_role", ["primary", "also"]);
export const pipelineStep = pgEnum("pipeline_step", [
  "collect",
  "extract",
  "dedupe",
  "plan",
  "script",
  "check",
  "voice",
  "cover",
  "publish",
]);
export const stepRunStatus = pgEnum("step_run_status", ["running", "succeeded", "failed"]);

const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => newId());

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  "users",
  {
    id: id(),
    auth0Sub: text().notNull(),
    email: text(),
    /** ISO 3166-1 alpha-2, sets the news edition only (P4). */
    country: text().notNull().default("US"),
    /** BCP 47 language for news and script. */
    language: text().notNull().default("en"),
    /** IANA timezone, e.g. Africa/Lagos. */
    timezone: text().notNull().default("UTC"),
    /** Local wall-clock time, `HH:mm`. */
    deliveryTime: text().notNull().default("07:00"),
    episodeMinutes: integer().notNull().default(15),
    voiceId: text().notNull().default("af_heart"),
    feedToken: text().notNull(),
    inboundAlias: text().notNull(),
    onboardedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("users_auth0_sub_key").on(t.auth0Sub),
    uniqueIndex("users_feed_token_key").on(t.feedToken),
    uniqueIndex("users_inbound_alias_key").on(t.inboundAlias),
    check("users_episode_minutes_check", sql`${t.episodeMinutes} in (5, 15, 30)`),
    check("users_delivery_time_check", sql`${t.deliveryTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  ],
);

export const userTopics = pgTable(
  "user_topics",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text().notNull(),
    query: text().notNull(),
    isCustom: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("user_topics_user_query_key").on(t.userId, sql`lower(${t.query})`)],
);

export const rssFeeds = pgTable(
  "rss_feeds",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text().notNull(),
    title: text(),
    lastFetchedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("rss_feeds_user_url_key").on(t.userId, t.url)],
);

export const savedItems = pgTable(
  "saved_items",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: savedItemKind().notNull(),
    url: text(),
    title: text(),
    /** Pointer to the raw payload (stored email body, RSS guid). */
    rawRef: text(),
    status: savedItemStatus().notNull().default("queued"),
    createdAt: createdAt(),
  },
  (t) => [index("saved_items_user_status_idx").on(t.userId, t.status)],
);

export const articles = pgTable(
  "articles",
  {
    id: id(),
    url: text().notNull(),
    canonicalUrl: text(),
    title: text().notNull(),
    outlet: text(),
    publishedAt: timestamp({ withTimezone: true }),
    textExcerpt: text(),
    textHash: text(),
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("articles_url_key").on(t.url),
    index("articles_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const episodes = pgTable(
  "episodes",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The user's local date the episode is for. */
    date: date({ mode: "string" }).notNull(),
    status: episodeStatus().notNull().default("planning"),
    title: text(),
    durationS: real(),
    audioKey: text(),
    coverKey: text(),
    transcript: jsonb(),
    error: jsonb(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("episodes_user_date_key").on(t.userId, t.date)],
);

export const chapters = pgTable(
  "chapters",
  {
    id: id(),
    episodeId: text()
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    title: text().notNull(),
    startS: real().notNull(),
    endS: real().notNull(),
    summary: text(),
    script: jsonb(),
  },
  (t) => [uniqueIndex("chapters_episode_position_key").on(t.episodeId, t.position)],
);

export const chapterSources = pgTable(
  "chapter_sources",
  {
    chapterId: text()
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    articleId: text()
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    role: chapterSourceRole().notNull().default("primary"),
  },
  (t) => [primaryKey({ columns: [t.chapterId, t.articleId] })],
);

export const heardArticles = pgTable(
  "heard_articles",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    articleId: text()
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    episodeId: text()
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.articleId] })],
);

export const stepRuns = pgTable(
  "step_runs",
  {
    id: id(),
    episodeId: text()
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    step: pipelineStep().notNull(),
    status: stepRunStatus().notNull().default("running"),
    attempt: integer().notNull().default(1),
    outputRef: text(),
    /** `{ startedAt, finishedAt, ms, ... }` per run. */
    timings: jsonb(),
  },
  (t) => [uniqueIndex("step_runs_episode_step_attempt_key").on(t.episodeId, t.step, t.attempt)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Episode = typeof episodes.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type PipelineStep = (typeof pipelineStep.enumValues)[number];

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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
} from "drizzle-orm/pg-core";
import { newId } from "./ids";

/** EmbeddingGemma's full output size. See docs/decisions/0003-database-and-ids.md. */
export const EMBEDDING_DIMENSIONS = 768;

/** Episode lengths across plans (prd §8): Free up to 10, Plus 5/10/20. */
export const EPISODE_MINUTES = [5, 10, 20] as const;
export type EpisodeMinutes = (typeof EPISODE_MINUTES)[number];

export const plan = pgEnum("plan", ["free", "plus"]);
export const cadence = pgEnum("cadence", ["daily", "weekly"]);
export const newsMode = pgEnum("news_mode", ["always", "fill"]);
export const newsletterPriority = pgEnum("newsletter_priority", ["always", "normal", "if_room"]);
export const inboundKind = pgEnum("inbound_kind", ["issue", "link", "forwarding_confirmation", "rejected"]);
export const inboundStatus = pgEnum("inbound_status", ["received", "processed", "rejected", "failed"]);
export const itemSourceKind = pgEnum("item_source_kind", ["newsletter", "link", "news", "rss"]);
export const itemStatus = pgEnum("item_status", ["queued", "used", "skipped"]);
export const episodeStatus = pgEnum("episode_status", ["planning", "voicing", "ready", "failed"]);
export const chapterSourceRole = pgEnum("chapter_source_role", ["primary", "also"]);
export const listeningEvent = pgEnum("listening_event", ["play", "skip", "complete", "seek"]);
export const listeningClient = pgEnum("listening_client", ["web", "feed"]);
export const pipelineStep = pgEnum("pipeline_step", [
  "collect",
  "extract",
  "cluster",
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
    plan: plan().notNull().default("free"),
    /** IANA timezone, e.g. Africa/Lagos. */
    timezone: text().notNull().default("UTC"),
    /** Local wall-clock time, `HH:mm`. */
    deliveryTime: text().notNull().default("07:00"),
    /** Free is weekly; Plus is daily, only when there's new content (prd §6). */
    cadence: cadence().notNull().default("weekly"),
    /** 0 = Sunday … 6 = Saturday; used when cadence is weekly. */
    weeklyDay: integer().notNull().default(1),
    episodeMinutes: integer().notNull().default(10),
    /** ElevenLabs voice id; null until picked in onboarding. */
    voiceId: text(),
    newsOptIn: boolean().notNull().default(false),
    newsMode: newsMode().notNull().default("fill"),
    /** ISO 3166-1 alpha-2 news edition; set only when news is opted in (P5). */
    newsCountry: text(),
    /** BCP 47 language for the news edition. */
    newsLanguage: text(),
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
    check("users_episode_minutes_check", sql`${t.episodeMinutes} in (5, 10, 20)`),
    check("users_weekly_day_check", sql`${t.weeklyDay} between 0 and 6`),
    check("users_delivery_time_check", sql`${t.deliveryTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  ],
);

/** Addresses allowed to forward mail to the user's inbound alias (prd §4.1). */
export const verifiedSenders = pgTable(
  "verified_senders",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text().notNull(),
    /** Null until the address is confirmed; the sign-in email is verified by Auth0. */
    verifiedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("verified_senders_user_email_key").on(t.userId, sql`lower(${t.email})`)],
);

export const newsletters = pgTable(
  "newsletters",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    senderEmail: text().notNull(),
    displayName: text().notNull(),
    listId: text(),
    enabled: boolean().notNull().default(true),
    priority: newsletterPriority().notNull().default("normal"),
    lastIssueAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("newsletters_user_sender_key").on(t.userId, sql`lower(${t.senderEmail})`)],
);

export const inboundMessages = pgTable(
  "inbound_messages",
  {
    id: id(),
    /** Null when the alias matched no user (logged, then dropped). */
    userId: text().references(() => users.id, { onDelete: "cascade" }),
    newsletterId: text().references(() => newsletters.id, { onDelete: "set null" }),
    /** RFC 5322 Message-ID; makes webhook retries idempotent. */
    messageId: text().notNull(),
    fromEmail: text(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    subject: text(),
    /** Object-storage key of the raw email; deleted after 30 days (prd §10). */
    rawKey: text(),
    status: inboundStatus().notNull().default("received"),
    kind: inboundKind().notNull(),
    /** Gmail/Outlook forwarding confirmation, shown prominently in the app. */
    confirmationCode: text(),
    confirmationUrl: text(),
    rejectReason: text(),
  },
  (t) => [
    uniqueIndex("inbound_messages_message_id_key").on(t.messageId),
    index("inbound_messages_user_received_idx").on(t.userId, t.receivedAt),
  ],
);

/** One story or section: a newsletter item, an article link, a news result or an RSS entry. */
export const items = pgTable(
  "items",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceKind: itemSourceKind().notNull(),
    newsletterId: text().references(() => newsletters.id, { onDelete: "set null" }),
    inboundMessageId: text().references(() => inboundMessages.id, { onDelete: "set null" }),
    url: text(),
    title: text().notNull(),
    text: text(),
    textHash: text(),
    /** Paywalled or blocked page: only title + snippet were available. */
    limited: boolean().notNull().default(false),
    publishedAt: timestamp({ withTimezone: true }),
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }),
    status: itemStatus().notNull().default("queued"),
    createdAt: createdAt(),
  },
  (t) => [
    index("items_user_status_idx").on(t.userId, t.status),
    index("items_user_text_hash_idx").on(t.userId, t.textHash),
    index("items_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
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
    /** Characters sent to ElevenLabs; the main cost driver (prd §8). */
    characters: integer(),
    voiceModel: text(),
    costCents: integer(),
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
    itemId: text()
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    role: chapterSourceRole().notNull().default("primary"),
  },
  (t) => [primaryKey({ columns: [t.chapterId, t.itemId] })],
);

/** Powers "hear each story once" (P3). */
export const heardItems = pgTable(
  "heard_items",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: text()
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    /** Stable key for the story cluster, so a later outlet's take on it is skipped too. */
    clusterKey: text().notNull(),
    episodeId: text()
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.itemId] }),
    index("heard_items_user_cluster_idx").on(t.userId, t.clusterKey),
  ],
);

/**
 * Timescale hypertable on `occurred_at` (see migration 0002). No foreign keys
 * or single-column primary key, since hypertables partition on time; account
 * deletion removes these rows explicitly by `user_id`.
 */
export const listeningEvents = pgTable(
  "listening_events",
  {
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    userId: text().notNull(),
    episodeId: text().notNull(),
    chapterId: text(),
    event: listeningEvent().notNull(),
    positionS: real(),
    client: listeningClient().notNull(),
  },
  (t) => [index("listening_events_user_time_idx").on(t.userId, t.occurredAt)],
);

export const usageMonthly = pgTable(
  "usage_monthly",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** First day of the month, in UTC. */
    month: date({ mode: "string" }).notNull(),
    charactersUsed: integer().notNull().default(0),
    episodesMade: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.month] })],
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
export type Plan = (typeof plan.enumValues)[number];
export type Cadence = (typeof cadence.enumValues)[number];
export type PipelineStep = (typeof pipelineStep.enumValues)[number];

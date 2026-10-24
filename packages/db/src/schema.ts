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
export const inboundKind = pgEnum("inbound_kind", [
  "issue",
  "link",
  "forwarding_confirmation",
  "sender_verification",
  "rejected",
]);
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
export const voiceProvider = pgEnum("voice_provider", ["kokoro", "elevenlabs"]);
export const voiceQuality = pgEnum("voice_quality", ["flash", "studio"]);
export const trialEndedReason = pgEnum("trial_ended_reason", ["episodes", "expired", "upgraded"]);
/** Our own subscription states; Bachs statuses are mapped onto these in the webhook handler. */
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "expired",
]);

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
    /** Paid plan, written only by Bachs webhooks. Features use the effective plan (paid OR promo trial). */
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
    /**
     * One voice per provider, so a promo trial ending (ElevenLabs → Kokoro)
     * loses nothing (prd §8.3). Effective plan picks which one is used.
     */
    kokoroVoiceId: text().notNull().default("af_heart"),
    /** ElevenLabs voice id; null until picked (Plus or trial). */
    elevenlabsVoiceId: text(),
    /** Plus: Flash (default) or "Studio voices" (prd §8). */
    voiceQuality: voiceQuality().notNull().default("flash"),
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
    /** Code the user sends from this address (in the subject) to prove they own it. */
    verificationCode: text(),
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
    /** RFC 5322 Message-ID; unique per user, so webhook retries and double forwards are no-ops. */
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
    uniqueIndex("inbound_messages_user_message_id_key").on(t.userId, t.messageId),
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
    /** Links found in the story, kept for citations: `[{ text, url }]`. */
    links: jsonb().$type<{ text: string; url: string }[]>(),
    /** For news items: the topic label, shown as "News · <label>". */
    topicLabel: text(),
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
    voiceProvider: voiceProvider(),
    voiceModel: text(),
    costCents: integer(),
    audioKey: text(),
    /** MP3 size, required by the feed's <enclosure length>. */
    audioBytes: integer(),
    coverKey: text(),
    /** Set while being made, so Home can show step progress. */
    currentStep: pipelineStep(),
    transcript: jsonb(),
    error: jsonb(),
    createdAt: createdAt(),
  },
  // Not unique: "Make one now" can add a second episode on a day; scheduled runs are deduped by episode_requests.
  (t) => [index("episodes_user_date_idx").on(t.userId, t.date)],
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

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bachsCustomerId: text().notNull(),
    bachsSubscriptionId: text().notNull(),
    productId: text().notNull(),
    status: subscriptionStatus().notNull(),
    currentPeriodEnd: timestamp({ withTimezone: true }),
    cancelAtPeriodEnd: boolean().notNull().default(false),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("subscriptions_bachs_subscription_key").on(t.bachsSubscriptionId),
    index("subscriptions_user_idx").on(t.userId),
  ],
);

/** Every Bachs webhook, keyed by its event id; makes replays no-ops (prd §8.2). */
export const billingEvents = pgTable("billing_events", {
  id: text().primaryKey(),
  type: text().notNull(),
  payload: jsonb().notNull(),
  receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp({ withTimezone: true }),
});

export const promoCodes = pgTable(
  "promo_codes",
  {
    id: id(),
    code: text().notNull(),
    trialDays: integer().notNull(),
    /** ElevenLabs episodes included in the trial (prd §8.3). */
    trialEpisodeLimit: integer().notNull().default(3),
    maxRedemptions: integer(),
    redeemedCount: integer().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }),
    active: boolean().notNull().default(true),
    note: text(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("promo_codes_code_key").on(sql`lower(${t.code})`),
    check("promo_codes_trial_days_check", sql`${t.trialDays} > 0`),
    check(
      "promo_codes_redemptions_check",
      sql`${t.maxRedemptions} is null or ${t.redeemedCount} <= ${t.maxRedemptions}`,
    ),
  ],
);

export const promoRedemptions = pgTable(
  "promo_redemptions",
  {
    id: id(),
    codeId: text()
      .notNull()
      .references(() => promoCodes.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    redeemedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    trialEndsAt: timestamp({ withTimezone: true }).notNull(),
    /** Copied from the code at redemption, so later edits to the code don't change a running trial. */
    episodeLimit: integer().notNull().default(3),
    /** Incremented atomically when a trial episode publishes. */
    episodesUsed: integer().notNull().default(0),
    endedAt: timestamp({ withTimezone: true }),
    endedReason: trialEndedReason(),
    /** Reminder emails already sent: "3-days" | "ended". */
    remindersSent: jsonb().$type<string[]>().notNull().default([]),
  },
  (t) => [
    uniqueIndex("promo_redemptions_code_user_key").on(t.codeId, t.userId),
    index("promo_redemptions_user_trial_idx").on(t.userId, t.trialEndsAt),
  ],
);

export const episodeRequestStatus = pgEnum("episode_request_status", ["pending", "running", "done", "skipped", "failed"]);
export const episodeRequestReason = pgEnum("episode_request_reason", ["scheduled", "manual"]);

/**
 * One row per "make an episode" intent (schedule or "Make one now"). Temporal
 * workflows are keyed by this id; without Temporal the worker polls this table.
 */
export const episodeRequests = pgTable(
  "episode_requests",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The user's local date the episode is for. */
    date: date({ mode: "string" }).notNull(),
    reason: episodeRequestReason().notNull(),
    status: episodeRequestStatus().notNull().default("pending"),
    episodeId: text().references(() => episodes.id, { onDelete: "set null" }),
    /** Why it was skipped or failed, shown to the user. */
    message: text(),
    createdAt: createdAt(),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("episode_requests_status_idx").on(t.status, t.createdAt),
    uniqueIndex("episode_requests_scheduled_key")
      .on(t.userId, t.date)
      .where(sql`${t.reason} = 'scheduled'`),
  ],
);

/** Fixed-window rate limits (paste, make-now, promo, inbound), shared across instances. */
export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    key: text().notNull(),
    windowStart: timestamp({ withTimezone: true }).notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/** Generated-once audio assets: SFX set and Studio-voice previews (prd §8.1). */
export const audioAssets = pgTable("audio_assets", {
  key: text().primaryKey(),
  storageKey: text().notNull(),
  durationS: real(),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Episode = typeof episodes.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type Plan = (typeof plan.enumValues)[number];
export type VoiceProvider = (typeof voiceProvider.enumValues)[number];
export type Item = typeof items.$inferSelect;
export type EpisodeRequest = typeof episodeRequests.$inferSelect;
export type Newsletter = typeof newsletters.$inferSelect;
export type PromoRedemption = typeof promoRedemptions.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Cadence = (typeof cadence.enumValues)[number];
export type PipelineStep = (typeof pipelineStep.enumValues)[number];

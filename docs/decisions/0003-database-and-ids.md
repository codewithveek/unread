# 0003 · Database, schema and ids

**Status:** Accepted (U0, 2026-10-23; revised for PRD v2 on 2026-10-24)

## Decision
- **Postgres on Tiger Data (Tiger Cloud)**, with two extensions:
  - **pgvector** for clustering stories across newsletters and for "already heard". Migration `0000_enable-pgvector.sql` runs `CREATE EXTENSION IF NOT EXISTS vector`.
  - **TimescaleDB** for `listening_events`. Migration `0002_listening-events-hypertable.sql` calls `create_hypertable('listening_events', by_range('occurred_at', INTERVAL '7 days'), if_not_exists => TRUE)`, but only when the extension is available, so local Postgres without it keeps an ordinary table.
  - Connect with the service URL and `sslmode=require`.
- **Drizzle ORM 0.45 + drizzle-kit 0.31**, using the `postgres` (postgres-js) driver and `casing: "snake_case"`. Migrations are checked in under `packages/db/migrations` and applied with `pnpm db:migrate`.
- **ULIDs as `text` primary keys.** Join tables (`chapter_sources`, `heard_items`, `usage_monthly`) use composite keys.
- **Embeddings are `vector(768)`** on `items`: EmbeddingGemma's full output size, with a cosine HNSW index. It is trained Matryoshka-style, so it can be truncated to 512/256/128 later (a migration plus a re-embed).

## Tables (PRD v2 §7)
`users` (plan, cadence, weekly day, news opt-in/mode/edition, feed token, inbound alias), `verified_senders`, `newsletters`, `inbound_messages`, `items`, `user_topics`, `episodes` (characters, voice model, cost), `chapters`, `chapter_sources` → `items`, `heard_items` (with `cluster_key`), `listening_events` (hypertable), `usage_monthly`, `step_runs`.

## Additions to the PRD
- `users.onboarded_at/created_at/updated_at`; `newsletters.last_issue_at` (for "last issue" in the Sources list).
- `inbound_messages`: `from_email`, `reject_reason`, and `confirmation_code`/`confirmation_url`, so the Gmail forwarding code can be shown in the app. `message_id` is unique, which makes webhook retries idempotent. `user_id` can be null for mail to an unknown alias (logged, then dropped).
- `items`: `inbound_message_id`, `limited` (paywalled link), `published_at`.
- `step_runs` with a unique `(episode_id, step, attempt)`, so activities can be idempotent.

## Constraints and defaults
- One episode per user per local date; `episode_minutes ∈ {5,10,20}`; `weekly_day` 0–6; `delivery_time` matches `HH:mm`.
- New users start on `free`, `weekly` (Monday), 10 minutes, news off, no voice picked yet.
- Case-insensitive unique keys on topics, verified senders and newsletter senders.
- Deleting a user cascades to every table with a foreign key. `listening_events` has no foreign keys (it's a hypertable), so account deletion removes its rows explicitly. Objects in storage are deleted separately.

## Pool mode
`createDb({ url, prepare: false })` is available if we connect through a transaction-mode pooler.

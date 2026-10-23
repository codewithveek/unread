# 0003 · Database, schema and ids

**Status:** Accepted (U0, 2026-10-23)

## Decision
- **Postgres on Tiger Data (Tiger Cloud)**, with the `vector` extension (pgvector), which Tiger Cloud supports. The first migration (`0000_enable-pgvector.sql`) runs `CREATE EXTENSION IF NOT EXISTS vector`. Use the service URL with `sslmode=require`.
- **Drizzle ORM 0.45 + drizzle-kit 0.31**, using the `postgres` (postgres-js) driver and `casing: "snake_case"` (camelCase in TypeScript, snake_case in SQL). Migrations are generated SQL, checked in under `packages/db/migrations`, and applied with `pnpm db:migrate`.
- **ULIDs as `text` primary keys**: sortable by creation time and safe in URLs. Join tables (`chapter_sources`, `heard_articles`) use composite keys.
- **Embeddings are `vector(768)`**: EmbeddingGemma's full output size. It is trained Matryoshka-style, so it can be truncated to 512/256/128 later; doing that means a migration and a re-embed. Cosine HNSW index on `articles.embedding`.
- **Constraints the app relies on**: one episode per user per local date (`episodes_user_date_key`), `episode_minutes ∈ {5,15,30}`, `delivery_time` matching `HH:mm`, unique topics per user (case-insensitive), unique article URL.
- **Deleting a user cascades** to all their rows (PRD §9). Objects in storage are deleted separately once storage exists (U2).

## Additions to the PRD's table list
- `users.onboarded_at`, `created_at`, `updated_at`; `created_at` on most tables.
- `step_runs.id` and a unique `(episode_id, step, attempt)`, so activities can be idempotent.
- `pipeline_step` and `step_run_status` enums.

## Pool mode
`createDb({ url, prepare: false })` is available if we connect through a transaction-mode pooler.

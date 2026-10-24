# Decisions

Short ADRs for choices the PRD leaves open. One file per decision, numbered in order.

| # | Decision | Status |
|---|---|---|
| [0001](0001-monorepo-and-web-stack.md) | pnpm monorepo, Next.js 16, Tailwind v4 + shadcn/ui | Accepted |
| [0002](0002-auth0-sign-in.md) | Auth0 v4 SDK via `proxy.ts`, session checked in pages | Accepted |
| [0003](0003-database-and-ids.md) | Postgres on Tiger Data (pgvector + hypertable), Drizzle, ULIDs | Accepted |
| [0004](0004-inbound-email-cloudflare.md) | Inbound email via Cloudflare Email Routing + Email Worker | Accepted |
| [0005](0005-model-and-embeddings.md) | Gemma 4 31B (Gemini API → OpenRouter), EmbeddingGemma on CPU | Accepted |
| [0006](0006-voices.md) | Kokoro for Free, ElevenLabs for Plus (pending key), ffmpeg assembly | Accepted |
| [0007](0007-payments-and-promos.md) | Bachs subscriptions via webhooks; promo-code Plus trials | Accepted |
| [0008](0008-workflow-and-hosting.md) | Temporal workflow + schedules, polling fallback, Render | Accepted |
| [0009](0009-news-links-storage-mail.md) | SerpApi news, SSRF-safe Readability, R2 storage, Resend | Accepted |

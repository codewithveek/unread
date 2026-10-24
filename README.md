# Unread

Forward your newsletters to Unread and get one short, deduplicated podcast episode with the parts that matter, in a voice you choose, delivered to the podcast app you already use.

- Product spec: [docs/prd-unread.md](docs/prd-unread.md) · Design: [docs/design/](docs/design/README.md) · Decisions: [docs/decisions/](docs/decisions/README.md) · Deploy: [docs/deploy.md](docs/deploy.md)

## How it works

```
newsletter ─► Cloudflare Email Routing ─► Email Worker ─signed─► /inbound/email
              (SPF/DKIM)                  (apps/inbound-worker)     verified sender? clean, split into stories
                                                                    │
Temporal schedule / "Make one now" ─► make-episode workflow (apps/worker)
   collect → EmbeddingGemma + pgvector clustering → Gemma plan → Gemma script → fact check
   → Kokoro (Free) / ElevenLabs (Plus) → ffmpeg −16 LUFS → seeded cover → publish
                                                                    │
private RSS feed (/feed/<token>.xml) + web player (Next.js, apps/web)
```

## Repo

| Path | What |
|---|---|
| `apps/web` | Next.js 16: onboarding, Home, Now playing, Sources, Settings, admin; inbound, feed, audio, billing routes |
| `apps/worker` | Temporal worker (or poller), CLIs: `brief`, `make-episode`, `dispatch`, `promo`, `warm-models` |
| `apps/inbound-worker` | Cloudflare Email Worker relaying signed raw MIME |
| `packages/core` | Inbound parsing, pipeline, model client, voices, audio, cover, feed, plans, promos, billing, news, links |
| `packages/db` | Drizzle schema + migrations (Postgres on Tiger Data, pgvector, Timescale) |

## Status

| Milestone | State |
|---|---|
| U0 Repo, Next.js, schema, Auth0, tokens | Done |
| U1 Inbound email (Cloudflare), verified senders, cleaning, Gmail code | Done (needs Cloudflare deploy) |
| U2 Cluster, plan, script, check + `pnpm brief` | Done (needs a Gemma key for real runs) |
| U3 Voice, cover, publish, feed | Done (Kokoro + ElevenLabs); run `pnpm generate-assets` once for SFX |
| U4 UI, responsive, global player | Done |
| U5 Links, news, plans, promos, Bachs, Temporal, deploy config | Done in code; needs provider accounts + deploy |
| U6 Submission | Yours |

## Run locally

Node 22, pnpm 10, Postgres 16 with pgvector, ffmpeg.

```sh
pnpm install
cp .env.example apps/web/.env.local          # fill in what you have
PG_URL=… pnpm db:migrate
pnpm dev                                     # web on :3000
PG_URL=… pnpm worker                   # episodes (polls without Temporal)
PG_URL=… pnpm brief --user <id>        # script JSON only (needs GEMINI_API_KEY or OPENROUTER_API_KEY)
PG_URL=… pnpm make-episode --user <id> # full episode in-process
```

## Tests

```sh
pnpm typecheck && pnpm lint && pnpm test
# integration (Postgres): TEST_DATABASE_URL=postgres://…/unread_test pnpm test
# + real EmbeddingGemma/Kokoro/ffmpeg: RUN_EMBEDDING_TESTS=1
# + Temporal time-skipping: RUN_TEMPORAL_TESTS=1
```

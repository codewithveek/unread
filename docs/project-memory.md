# Unread · project memory (handoff)

Living state of the project for new sessions. Update it when milestones, decisions or blockers change. Last updated 2026-10-24.

## What it is
Forward newsletters to `<alias>@in.getunread.site` → one short, deduplicated, cited podcast episode → private RSS feed + web player. DEV Hacktoberfest 2026 Week 3 entry; deadline **Mon Oct 26, 07:59 WAT**. Owner: Lucky Victory (@CodewithVeek), repo `codewithveek/unread`, working branch `claude/gifted-albattani-gk5mjz`. Spec: `docs/prd-unread.md` (v2 + Kokoro/Bachs/promo/trial-limit updates). The canvas phone designs in `docs/design/` are the UI source of truth.

## Status (build order, PRD §13)
| | State |
|---|---|
| U0 repo, Next.js, schema, Auth0, tokens | Done. Auth0 tenant not created yet (login untested against a real tenant). |
| U1 inbound email | Done in code + tests. Cloudflare Email Routing/Worker not deployed. |
| U2 cluster → plan → script → check, `pnpm brief` | Done. **Never run against real Gemma** (no `GEMINI_API_KEY`/`OPENROUTER_API_KEY` yet); tests use a scripted fake model. |
| U3 voice, cover, publish, feed | Done. Kokoro verified end to end; ElevenLabs code done; key verified and the CLI test request succeeded (user approved, 2026-10-24); SFX not generated yet (`pnpm generate-assets`, ask first: it spends credits). |
| U4 UI | Done; screenshots in `docs/screenshots/u4`. |
| U5 links, news, plans, promos, Bachs, Temporal, deploy config | Done in code; no provider accounts/deploy yet. |
| U6 submission (video, write-up) | User's. |

## Architecture in one breath
`apps/inbound-worker` (Cloudflare Email Worker) HMAC-signs raw MIME → `POST /inbound/email` (`apps/web`) → `processInbound` (`packages/core/inbound`): alias → user, verified-sender + SPF/DKIM gate, Gmail forwarding-confirmation code, sender verification by code, bare links, or newsletter → cleaned + split into `items`. Episodes: `episode_requests` row (scheduled by dispatcher or "Make one now") → Temporal `makeEpisodeWorkflow` (or the poller fallback) → steps in `packages/core/episodes/steps.ts`: start → prepareScript (news fetch if opted in, collect, EmbeddingGemma + pgvector clustering with Gemma confirming borderline pairs, heard-items filter, Gemma ranking within priority tiers, per-chapter Gemma JSON scripts, deterministic fact check + one repair) → voiceEpisode (Kokoro/ElevenLabs per line, cached, ffmpeg −16 LUFS, line timings) → renderEpisodeCover (seeded SVG → resvg PNG) → publishEpisode (chapters, sources, heard_items, items used, usage, trial counter — one transaction). Feed `/feed/<token>.xml`, chapters JSON, covers and audio are served by token.

## Key decisions (details in `docs/decisions/`)
- 0001 pnpm monorepo, Next 16 (proxy.ts), TS 6.0 pinned, Tailwind v4 + shadcn tokens.
- 0002 Auth0 v4; `requireUser()` in pages; user row created lazily; sign-in email becomes a verified sender.
- 0003 Postgres on Tiger Data: pgvector `vector(768)`, `listening_events` hypertable (conditional migration), ULIDs, migrations 0000–0008.
- 0004 Cloudflare Email Routing → Email Worker → signed relay (`X-Unread-Signature`).
- 0005 Gemma `gemma-4-31b-it` via Gemini **native** API (OpenAI-compatible endpoint optional), OpenRouter fallback; EmbeddingGemma ONNX on CPU (transformers.js **3.8.1**, pinned to match kokoro-js).
- 0006 Kokoro (Free, 4 voices; `am_michael`/`bf_emma` are placeholders pending listening tests) / ElevenLabs (Plus: Standard `eleven_flash_v2_5`, Studio `eleven_v4` for paid Plus only; trials use Standard).
- 0007 Bachs: checkout, portal, V2-signed webhooks, idempotent by event id, plan changes only from webhooks; promo codes with atomic redemption, verified email, trial episode limit (default 3).
- 0008 Temporal schedules (dispatch every 10 min, maintenance hourly) or poller; Render web (Node) + worker (Docker, ffmpeg, baked models).
- 0009 SerpApi news (36 h window), SSRF-safe Readability, S3/R2 storage, Resend mail.

## Environment facts (this cloud sandbox)
- **Outbound is HTTPS-only via a proxy.** Raw-TCP databases are unreachable: Tiger Data (`PG_URL`, port 31116) times out even after the user switched the environment to full network access (the running container kept the old policy; retest in a fresh session). If still blocked, migrate from Render (`preDeployCommand: pnpm db:migrate`) or the user's machine. Don't mock around it.
- `PG_URL` = Tiger Data (preferred by `loadConfig` and drizzle config). `DATABASE_URL` in this env points at an unrelated TiDB Cloud host; it's only a fallback.
- `ELEVENLABS_API_KEY` is set as an env secret (key ends a478). ElevenLabs CLI rules: never print/cat env files, never put the key in code, don't make speech to "try it" until the user says yes (`npx -y @elevenlabs/cli@latest onboard test --env-path .env.local` is the test command).
- Also present but **not to be used without asking**: `CLOUDFLARE_API_TOKEN`, AWS keys, `RESEND_API_KEY`.
- Local Postgres 16 is installed; it stops when the container recycles: `service postgresql start`. pgvector came from `apt-get install postgresql-16-pgvector`. Databases `unread` (dev) and `unread_test` (tests), user/password `unread`. Run commands with `PG_URL= DATABASE_URL=postgres://unread:unread@localhost:5432/unread …` locally (empty `PG_URL` so it doesn't win).
- drizzle-kit `generate` prompts for renames and needs a TTY: `(sleep 4; printf '\r') | script -qec "npx drizzle-kit generate --name x" /dev/null`.
- Docker works (`dockerd` may need starting). Building the worker image here needs the proxy CA copied in (test-only variant); the committed Dockerfile is for Render.
- Models cache in `$TMPDIR/unread-models` (Kokoro ~0.77× real time on CPU; EmbeddingGemma loads in ~5 s).

## How to verify things
- Fast: `pnpm typecheck && pnpm lint && pnpm test`.
- Integration: `TEST_DATABASE_URL=postgres://unread:unread@localhost:5432/unread_test RUN_EMBEDDING_TESTS=1 RUN_TEMPORAL_TESTS=1 pnpm test` (real EmbeddingGemma, Kokoro, ffmpeg, Temporal time-skipping).
- UI without Auth0: mint a session cookie with `generateSessionCookie` from `@auth0/nextjs-auth0/testing` using the `AUTH0_SECRET` in `apps/web/.env.local`, set it as `__session`, and drive Playwright (`/opt/node22/lib/node_modules/playwright`). The dev DB has a smoke user `auth0|u0-smoke` with one seeded Kokoro episode.
- Web routes typecheck can show stale `RouteImpl` errors for new routes until `next build` regenerates `.next/types`.

## Open items / next steps
1. User to broaden Network access → then inspect Tiger DB (confirm empty), `PG_URL=… pnpm db:migrate`, check the hypertable got created.
2. Gemma key (`GEMINI_API_KEY` and/or `OPENROUTER_API_KEY`) → run `pnpm brief --user <id>` on real newsletters; tune prompts if the check drops many lines; try `GEMINI_API_STYLE=openai`.
3. `pnpm generate-assets` for the SFX (ask before spending credits).
4. Accounts + deploy (docs/deploy.md): Auth0 app, Cloudflare Email Routing + `wrangler deploy`, R2 bucket, Render blueprint, Temporal Cloud (optional), Bachs sandbox products + webhook, SerpApi, Resend domain.
5. Measure Kokoro speed on the Render instance; tune `KOKORO_CONCURRENCY`.
6. Landing page `/` is minimal (hero, two CTAs, privacy link); a fuller marketing page is not built.
7. PRD inconsistencies resolved by assumption: Free voices 4 (§8) not 3 (§9); Free cap = 4 episodes/month; `/inbound/email` writes `items` (not `saved_items`).

## Working with this user
- Wants autonomous end-to-end building ("build everything start to finish"), short progress updates, and honest status (what's verified vs not).
- Commit and push to the working branch after each milestone; no PRs unless asked.
- Ask before outward-facing actions (deploys, emails, spending provider credits).

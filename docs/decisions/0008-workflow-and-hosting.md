# 0008 · Temporal workflow, polling fallback, Render hosting

**Status:** Accepted (2026-10-24)

## Episode workflow
- **One request row per intent** (`episode_requests`: scheduled or manual). A unique index makes scheduled runs idempotent per user per local date.
- **Temporal (TypeScript SDK 1.24):**
  - `makeEpisodeWorkflow(requestId)` runs these activities: start → prepare script (steps 1–6) → voice (heartbeats, 30-minute timeout) → cover → publish, with fail on error. Each activity is idempotent because step outputs are stored in object storage and checked before redoing work.
  - Two Temporal Schedules are created on worker start: `unread-dispatch` every 10 minutes (due users plus orphaned pending requests, as child workflows with ID `episode-request-<id>` and `REJECT_DUPLICATE`), and `unread-maintenance` hourly (purge raw mail older than 30 days, trial lifecycle).
  - Tested with `TestWorkflowEnvironment.createTimeSkipping()`: correct step order, the voice step retried after a transient failure, and no publish when the request is skipped.
  - "Make one now" starts the workflow straight from the web app. If Temporal is unreachable, the dispatcher picks the request up.
  - Connection: `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, and `TEMPORAL_API_KEY` (TLS + API key for Temporal Cloud).
- **Without Temporal** (the PRD cut line): the same worker runs a poller that dispatches every minute, claims pending requests with `FOR UPDATE SKIP LOCKED`, and runs the same step functions. `pnpm dispatch` does one pass, for a Render cron job.
- **Schedule rules:** a run is due from 30 minutes before the user's delivery time, in their timezone; weekly users only on their chosen day. An episode is made only with 2 or more new items (or news); otherwise the request is skipped at no cost.

## Hosting (`render.yaml`)
- **unread-web:** native Node 22 runtime, `pnpm --filter @unread/web build/start`, `preDeployCommand: pnpm db:migrate`, custom domain `getunread.site`.
- **unread-worker:** a Docker background worker (`apps/worker/Dockerfile`: Debian with ffmpeg, plus the ONNX models baked in by `warm-models`). Use Standard or above (Kokoro is CPU-bound; EmbeddingGemma needs about 1 GB of RAM).
- **Inbound email:** a Cloudflare Email Worker (ADR 0004), deployed with wrangler.
- **Database:** Tiger Cloud (ADR 0003). **Object storage:** S3-compatible, preferably Cloudflare R2 (ADR 0009).

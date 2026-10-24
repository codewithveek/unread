# Deploying Unread

Everything except secrets is in the repo: `render.yaml` (web + worker), `apps/worker/Dockerfile`, `apps/inbound-worker/wrangler.jsonc`.

## 1. Database: Tiger Cloud
1. Create a service (Postgres + TimescaleDB). Copy the connection string and add `?sslmode=require`.
2. `DATABASE_URL=… pnpm db:migrate`. Migration 0000 enables pgvector; 0002 turns `listening_events` into a hypertable.

## 2. Object storage: Cloudflare R2
Create a bucket (private) and an API token with read/write on it. Set `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_REGION=auto`, and the keys.

## 3. Auth0
Regular Web Application, callback `https://getunread.site/auth/callback`, logout `https://getunread.site`, Google + email connections. Details in ADR 0002.

## 4. Render
1. New → Blueprint → this repo. It creates `unread-web` (Node) and `unread-worker` (Docker).
2. Fill the `sync: false` secrets (env group `unread-shared` + web-only keys).
3. Custom domain: add `getunread.site` to `unread-web`, then point DNS at Render (A/ALIAS for the apex as Render shows).
4. Without Temporal, leave `TEMPORAL_ADDRESS` empty: the worker polls. Or use a Render cron job running `pnpm --filter @unread/worker dispatch` every 10 minutes and skip the long-running worker.

## 5. Temporal (optional, recommended)
Temporal Cloud namespace + API key → `TEMPORAL_ADDRESS` (e.g. `<ns>.<acct>.tmprl.cloud:7233`), `TEMPORAL_NAMESPACE`, `TEMPORAL_API_KEY`. The worker creates the `unread-dispatch` (10 min) and `unread-maintenance` (hourly) schedules on start.

## 6. Inbound email: Cloudflare
1. `getunread.site` on Cloudflare DNS → Email → Email Routing on `in.getunread.site` (adds MX + SPF).
2. `cd apps/inbound-worker && npx wrangler secret put INBOUND_WEBHOOK_URL` (`https://getunread.site/inbound/email`) and `npx wrangler secret put INBOUND_WEBHOOK_SECRET` (same as the web app), then `npx wrangler deploy`.
3. Email Routing → Routing rules → Catch-all → Send to a Worker → `unread-inbound`.
4. Forward a newsletter from your sign-in address to your alias; it shows up under Sources within a minute.

## 7. Bachs (sandbox first)
1. Create two recurring products (Plus monthly/yearly) → `BACHS_PLUS_*_PRODUCT_ID`.
2. Developer Portal → Webhooks → `https://getunread.site/billing/webhooks/bachs` with `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed` → `BACHS_WEBHOOK_SECRET`.
3. Locally: `bachs listen --forward-to localhost:3000/billing/webhooks/bachs --events customer.subscription.created,customer.subscription.updated,customer.subscription.deleted`.

## 8. Providers
- `GEMINI_API_KEY` (Google AI Studio) and/or `OPENROUTER_API_KEY`.
- `SERPAPI_API_KEY` for opt-in news.
- `ELEVENLABS_API_KEY` for Plus/trials and the SFX set.
- `RESEND_API_KEY` + a verified sending domain for trial emails.

## Checks after deploy
- `/privacy` responds (health check). Sign in → onboarding → forward one newsletter → it appears in Sources.
- `pnpm promo create --code LAUNCH --days 14 --episodes 3 --max 100` (with production `DATABASE_URL`).
- Make one now → an episode appears; add the feed to Pocket Casts.

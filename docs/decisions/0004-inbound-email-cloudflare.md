# 0004 · Inbound email: Cloudflare Email Routing

**Status:** Accepted (2026-10-24). Implemented in U1.

## Context
Forwarding newsletters is the main feature (PRD v2 §4.1). Every user has `<alias>@in.getunread.site`. We need to receive that mail, verify where it came from, and turn it into `inbound_messages` and `items` within 60 seconds.

## Decision
**Cloudflare Email Routing** on `in.getunread.site`, with a catch-all rule that sends every address to an **Email Worker** (`apps/inbound-worker`). The worker hands the raw message to the web app.

```
sender ─► Cloudflare MX (in.getunread.site)
            │ Email Routing: SPF or DKIM must pass; DMARC policy enforced
            ▼
        Email Worker  email(message, env, ctx)
            │ size cap → read message.raw → HMAC-sign
            ▼
        POST https://getunread.site/inbound/email   (apps/web route handler)
            verify signature + timestamp → find user by alias → verified-sender check
            → parse MIME (postal-mime) → classify (issue / link / forwarding confirmation)
            → store raw (30 days) → inbound_messages + items
```

- **Worker API** (Cloudflare docs): `message.from`/`message.to` are the envelope addresses, `message.headers` is a `Headers` object, `message.raw` is a `ReadableStream` of the MIME source, plus `message.rawSize` and `message.setReject(reason)`.
- **Authentication:** since July 2025, Email Routing only accepts mail that passes SPF or carries a valid DKIM signature, and applies the sender's DMARC policy. On top of that, we pass the `Authentication-Results` header through and also check it in the app. The exact header format is confirmed on the first real message in U1.
- **Rejecting early:** the worker calls `setReject` for messages over the size cap (2 MB) and for local parts that aren't valid aliases, so nothing is posted to the app. Unknown aliases that do look valid still reach the app, where they are logged and dropped.
- **Webhook security:** header `X-Unread-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, t + "." + body)>`, with a 5-minute window. The secret `INBOUND_WEBHOOK_SECRET` is shared between the worker and the web app.
- **Idempotency:** `inbound_messages.message_id` is unique, so worker retries are no-ops.

## Why Cloudflare
- No per-message cost, and the Worker runs at the edge before anything reaches our app.
- Authentication is enforced upstream; we keep full control of the MIME parsing.
- `getunread.site` DNS can live on Cloudflare, so MX setup is a few clicks.

## Alternatives considered
- **Postmark Inbound:** parses MIME to JSON and sends SPF/DKIM results, but it's a paid plan and one more vendor holding newsletter text.

## Setup
1. Add `getunread.site` to Cloudflare. Enable Email Routing on the `in` subdomain (MX + SPF records are added automatically).
2. Deploy `apps/inbound-worker` with `wrangler deploy`, using secrets `INBOUND_WEBHOOK_SECRET` and `INBOUND_WEBHOOK_URL`.
3. Email Routing → Routing rules → Catch-all → *Send to a Worker* → `unread-inbound`.

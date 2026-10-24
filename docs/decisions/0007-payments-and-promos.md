# 0007 · Payments with Bachs, Plus trials with promo codes

**Status:** Accepted (2026-10-24). Verified against docs.bachs.io (llms.txt, the SaaS subscriptions guide, the webhooks guide, the portal guide).

## Bachs
- **API:** `Authorization: Bearer sk_sandbox_…`. Sandbox is `https://sandbox-api.bachs.io`, live is `https://api.bachs.io` (switching is just swapping the key and URL). Money is decimal strings, IDs are prefixed.
- **Products:** one recurring product per Plus price, created in the dashboard or with `POST /v1/products` and `billing_cycle: {interval: "month"|"year"}`. Their IDs go in `BACHS_PLUS_MONTHLY_PRODUCT_ID` / `BACHS_PLUS_YEARLY_PRODUCT_ID`.
- **Checkout:** `POST /billing/checkout` calls `POST /v1/checkout-sessions` with `product_cart`, `customer` (`{email}` the first time, `{customer_id}` after that), `metadata.user_id` and the success/cancel URLs, then redirects (303) to `checkout_url`. Bachs copies the metadata onto the subscription, so every subscription webhook names our user. Bachs refuses localhost return URLs, so they're left out in local development.
- **Plan changes come only from webhooks** (`POST /billing/webhooks/bachs`):
  - Verify `X-Bachs-Signature-V2` (`t=…,v1=…`: HMAC-SHA256 of `{t}.{raw body}`, any `v1` may match during secret rotation, 300 s tolerance). Fall back to `X-Bachs-Timestamp` + `X-Bachs-Signature`.
  - Store the event id in `billing_events`, so a replay is a no-op. Skip events older than the stored subscription state, since delivery order isn't guaranteed.
  - Save the full subscription and set `users.plan`.
  - Handled events: `customer.subscription.created`, `.updated` and `.deleted`. Statuses map as `trialing`/`active`/`past_due` → access, `canceled` → access until `current_period_end`, anything else → none.
  - A bad signature gets a 400; a failure to save gets a 5xx, so Bachs retries.
- **`/billing/return`** never grants access. It waits for the webhook ("Activating your plan…").
- **Manage billing:** `POST /v1/customers/{id}/portal-sessions`, a fresh session per click, then a 303 redirect.
- Cancelling at period end keeps Plus until `current_period_end`; deletion drops the user to Free.

## Promo codes (our own feature)
- A code grants Plus for N days with no card, capped at `trial_episode_limit` ElevenLabs episodes (default 3), each at most 10 minutes. The cap is copied onto the redemption.
- **Rules:** Auth0 `email_verified` is required; one live trial per user; not while already on paid Plus; 5 tries an hour per user. Redemption is atomic: the code row is locked `FOR UPDATE`, and a check constraint keeps `redeemed_count ≤ max_redemptions`. The test fires 8 concurrent redemptions at a code limited to 3; exactly 3 succeed.
- **Trial accounting:** publishing a Studio episode increments `episodes_used` in the publish transaction. The last allowed episode ends the trial (`ended_reason = episodes`). Stories the trial episodes didn't use stay queued for the next Free episode.
- **Lifecycle** (hourly): end trials that hit their date (`expired`), end trials when the user upgrades (`upgraded`), and email 3 days before and on the day (via Resend), once each.
- **Effective plan:** `effectivePlan()` in `packages/core/src/plans` is the only place that decides: paid Plus, else a live trial, else Free.
- **Admin:** `/admin` (for `ADMIN_EMAILS` with a verified email) and `pnpm promo create|list`.

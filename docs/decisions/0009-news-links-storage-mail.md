# 0009 · News, links, storage and mail

**Status:** Accepted (2026-10-24)

## News: SerpApi Google News (opt-in)
- `GET https://serpapi.com/search.json?engine=google_news&q=<topic>&gl=<country>&hl=<language>&api_key=…` (parameters checked against serpapi.com/google-news-api). Results come from `news_results[]` (`title`, `link`, `source.name`, `iso_date`); story clusters nest articles under `stories[]`.
- Only results from the last 36 hours are kept, the top 3 per topic, with URLs seen in the last 14 days skipped. Each article is fetched and extracted, so Gemma summarises real text; paywalled pages are marked `limited`.
- **"Always include a segment":** news gets normal priority. **"Only fill quiet days":** news is fetched only when queued stories won't fill about 75% of the budget, and it ranks "only if room". With news off, nothing is fetched.

## Links: fetch + Readability, SSRF-safe
- `safeFetch`: http(s) only, ports 80/443, no credentials in URLs, no localhost or `.local`/`.internal` names. DNS is checked **at connect time** through an undici `Agent` lookup, so DNS rebinding can't reach private, loopback, link-local, CGNAT, multicast or IPv4-mapped addresses. Every redirect is re-checked (at most 5), with a 10 s timeout and a 3 MB cap.
- `@mozilla/readability` over `linkedom`. Pages under 600 characters, or with paywall wording, are "limited": title plus a snippet, and the script is told to stick to it.
- Bare links emailed to the forwarding address go through the same path.

## Storage: S3-compatible (Cloudflare R2 recommended), local files in development
- Keys sit under `users/<id>/…` (raw mail, episodes, step outputs), so account deletion is one prefix delete. Shared `cache/voice/…` and `assets/…` are not per-user.
- Audio and covers are served through `/audio/<feedToken>/<id>.mp3` and `/feed/<feedToken>/cover/<id>.png`. These redirect to a 6-hour signed URL (S3/R2 handle Range requests for podcast apps), or stream with Range support from local storage. Rotating the feed token revokes everything at once.

## Mail: Resend
- Trial reminders use Resend's REST API (`RESEND_API_KEY`, `MAIL_FROM`). Without a key, mail is logged instead of sent.

# PRD: Unread, your newsletters as a podcast (v2)

| | |
|---|---|
| **One line** | Forward your newsletters to Unread and get one short, deduplicated podcast episode with the parts that matter, in a voice you choose |
| **Main selling point** | **Newsletter → summarised podcast** via email forwarding. Also: article links → episode, and opt-in news on chosen topics |
| **Status** | A real product. First public release doubles as the DEV Hacktoberfest 2026 Week 3 entry (deadline **Mon Oct 26, 07:59 WAT**) |
| **Domain** | `getunread.site` |
| **UI reference** | "Unread app screens" canvas + `design/` files; desktop rules in §9 |

> **Claude Code:** build in the order of §13; stop at the cut line if time runs out. Verify every third-party API (Gemini API/Gemma, ElevenLabs, SerpApi, inbound email provider, Auth0, Temporal, Render, Tiger Data) against current docs and record choices in `docs/decisions/`. Code standards from `CLAUDE.md` apply.

## Changes from v1
- Voice: **ElevenLabs only** (Kokoro removed). Premium users pick from the ElevenLabs voice library. Sound effects generated once and reused.
- Model: **Gemma served by Google** (Gemini API, OpenAI-compatible endpoint); OpenRouter as fallback. No local-model mode in the product.
- **Email forwarding is P0** and the centre of onboarding. News (SerpApi) is **opt-in**.
- Plans (Free / Plus) and cost controls added, because voice is the main cost.

## 1. Problem and users

- People subscribe to many newsletters and read few. Inboxes fill with issues that overlap heavily (the same launch covered by five newsletters).
- Listening is a daily habit: 45% of Americans aged 12+ listen to a podcast weekly (Edison, Infinite Dial 2026).
- Existing options need effort or don't curate: text-to-speech readers read everything aloud; NotebookLM works one notebook at a time; Huxe is closed and broad.

**Users:** professionals, founders and students with 5–30 newsletter subscriptions, plus saved links.

**Promise:** "Your newsletters, minus the overlap, in 10 minutes of audio."

## 2. Principles

- **P1 · Zero effort after setup.** Forward once (or set an auto-forward rule); episodes arrive.
- **P2 · Honest summaries.** Every chapter cites its newsletter or article and links to it. No number, quote or claim absent from the source. Our own words, never full reproduction.
- **P3 · Hear each story once.** Overlapping coverage is merged into one chapter that credits every source.
- **P4 · Gemma does the thinking.** Curation, deduplication judgments, summarising and scripting run on Gemma (open weights), so the product can move to self-hosted Gemma without a rewrite.
- **P5 · User-focused.** No location assumptions; news is opt-in and uses the user's chosen edition.
- **P6 · Cost-aware by design.** Voice characters are the main cost; every design choice respects the per-plan budget (§8).

## 3. Scope

### In (v1)
- Sign-in (Auth0), onboarding centred on forwarding setup.
- Sources: **forwarded newsletters (P0)**, pasted article links (P0), opt-in news topics via SerpApi (P0), RSS (P1).
- Episode pipeline (§6) with chapters, transcript, sources, cover.
- ElevenLabs voices; premium voice picker (Plus).
- Private podcast feed + web player; responsive phone → desktop.
- Plans: Free and Plus (billing can be stubbed for the hackathon; limits enforced in code).

### Out (v1)
- Voice cloning, native apps, browser extension, sharing, multiple episodes a day, team accounts. Gmail import via Auth0 Token Vault is P1 stretch.

## 4. Sources

### 4.1 Newsletter forwarding (P0, the main feature)
- Each user gets a private address: `<alias>@in.getunread.site` (alias random, rotatable).
- **Two ways to use it**, both shown in onboarding with step-by-step guides (Gmail, Outlook, Apple Mail):
  1. Forward an issue by hand.
  2. **Auto-forward rule** (recommended): a filter that forwards newsletters automatically.
- **Gmail forwarding confirmation:** Gmail sends a confirmation code to the forwarding address before auto-forwarding works. Unread must detect that email and show the code (and confirm link) to the user in the app, prominently. Same for Outlook if applicable.
- **Accept only** mail from the user's verified email address(es) (they can add more); also verify SPF/DKIM pass via the provider's verdict. Others are dropped and logged.
- **Cleaning:** HTML → text; strip footers, unsubscribe blocks, tracking pixels, ads and sponsor sections where identifiable; keep links. Detect the newsletter name (sender name / List-Id) for citations.
- **Sender list:** the app lists every newsletter seen, with a toggle per sender ("include in episodes") and a priority (always first / normal / only if room).
- Inbound provider chosen in an ADR (e.g. Postmark Inbound or Cloudflare Email Routing → webhook). Webhook signature verified.

### 4.2 Article links (P0)
- Paste in the app, or email a bare link to the forwarding address.
- Fetch + Readability extraction; SSRF protection; paywalled pages fall back to title + snippet and are labelled "limited".

### 4.3 News topics (P0, opt-in)
- Onboarding, after forwarding setup: **"Want us to catch you up on the news too?"** Off by default; choosing yes shows topic chips + search + news edition (detected country, editable).
- Two modes, user's choice: **"Always include a news segment"** or **"Only fill quiet days"** (when newsletters don't fill the episode).
- SerpApi Google News per topic with `gl`/`hl` from the edition; last 24–36 h.
- First-run tip: if the user has no newsletters yet, offer news to make the first episode immediately.

### 4.4 RSS (P1)

## 5. Architecture

```
apps/web (Next.js App Router: UI + route handlers)
  ├─ Auth0 session · Drizzle · plan limits
  ├─ /inbound/email   (signed webhook → saved_items, confirmation-code detection)
  └─ /feed/:token.xml (private podcast feed)
        │
Postgres on Tiger Data (pgvector + a hypertable for listening events)
        │
apps/worker (Temporal worker on Render)
  collect → extract/clean → embed + cluster → plan → script → check → voice → cover → publish
        │                                  │                │
   SerpApi (opt-in)          Gemma via Gemini API      ElevenLabs TTS
                             (OpenRouter fallback)     (+ cached SFX)
Object storage (S3-compatible) for MP3 and covers · Render: web service + background worker
```

### Model client
- `ModelClient` over OpenAI-compatible APIs: primary **Gemini API serving Gemma** (record the exact Gemma model id in an ADR), fallback **OpenRouter** Gemma. Retries with backoff on 429/5xx; per-call timeout; Zod-validated structured output with a 3-attempt repair loop.
- Embeddings: **EmbeddingGemma** if served by the same provider; otherwise run it in the worker (transformers.js/ONNX) — decide in an ADR after checking Render CPU performance.

## 6. Episode pipeline (Temporal workflow `make-episode`)

| # | Activity | Rules |
|---|---|---|
| 1 | `collectCandidates` | Unused newsletter issues and links since the last episode, enabled senders only; plus news if opted in and the mode applies |
| 2 | `extractAndClean` | Newsletters split into **items** (one story/section each, with its links); links extracted; cached by content hash |
| 3 | `embedAndCluster` | Embed each item; cluster the same story across newsletters/articles (pgvector similarity + Gemma confirmation for borderline pairs); drop stories in `heard_items` |
| 4 | `planEpisode` | Gemma ranks clusters: sender priority → user's listening signals (§7) → freshness. Fits the **character budget** for the user's plan and length (§8) |
| 5 | `writeScript` | JSON per chapter: `{ title, lines: [{ text, sourceIds[] }] }`, intro naming the newsletters covered, outro. Merged stories say "covered by The X and The Y" |
| 6 | `checkScript` | Every line cites ≥1 source; numbers and quotes must appear in the cited source text; lines ≤ 30 words; total characters ≤ budget. Failing lines regenerated once, then dropped |
| 7 | `synthesizeVoice` | ElevenLabs TTS per chapter (model per plan, §8), with request stitching for continuity if supported (verify); cache by text + voice + model hash; ffmpeg concat with cached SFX (intro sting, chapter transitions); loudness −16 LUFS; chapter times from clip durations |
| 8 | `renderCover` | Seeded SVG (user + date + top newsletters) → 3000×3000 and 1200×1200 PNG |
| 9 | `publishEpisode` | Upload; write episode, chapters, sources, `heard_items`; mark items used; record characters and cost |

**When episodes are made:** at the user's delivery time, **only if there is new content** (≥ 2 new items, or the news fallback applies). No content → no episode, no cost. Free plan: weekly (user picks the day).

**"Make one now"** button: rate-limited by plan.

## 7. Data (Drizzle on Tiger Data, ULIDs)

| Table | Key columns |
|---|---|
| `users` | id, auth0_sub, email, plan (`free`/`plus`), timezone, delivery_time, cadence (`daily`/`weekly`), weekly_day, episode_minutes, voice_id, news_opt_in, news_mode (`always`/`fill`), news_country, news_language, feed_token, inbound_alias |
| `verified_senders` | user_id, email, verified_at (addresses allowed to forward) |
| `newsletters` | id, user_id, sender_email, display_name, list_id, enabled, priority |
| `inbound_messages` | id, user_id, newsletter_id, message_id (unique), received_at, subject, raw_key, status, kind (`issue`/`link`/`forwarding-confirmation`/`rejected`) |
| `items` | id, user_id, source_kind (`newsletter`/`link`/`news`/`rss`), newsletter_id, url, title, text, text_hash, embedding vector, created_at, status |
| `user_topics` | id, user_id, label, query, is_custom |
| `episodes` | id, user_id, date, status, title, duration_s, characters, voice_model, cost_cents, audio_key, cover_key, transcript jsonb, error jsonb |
| `chapters` / `chapter_sources` | as v1, sources pointing to `items` |
| `heard_items` | user_id, item_id, cluster_key, episode_id |
| `listening_events` | **Timescale hypertable** on `occurred_at`: user_id, episode_id, chapter_id, event (`play`/`skip`/`complete`/`seek`), position_s, client (`web`/`feed`) |
| `usage_monthly` | user_id, month, characters_used, episodes_made |

**Tiger Data use:** Postgres for everything; **pgvector** for story clustering across newsletters and "already heard"; a **hypertable** for listening events, with a continuous aggregate (per user × newsletter/topic: skip rate, completion rate) that feeds `planEpisode` ranking. P2: hybrid keyword + vector search over past episodes.

## 8. Voice, plans and cost

ElevenLabs API list prices (verify before launch): Flash/Turbo ≈ $0.04 per 1K characters; Multilingual v2 / v3 ≈ $0.08 per 1K; sound effects ≈ $0.12 per generated minute. ~900 characters ≈ 1 minute of speech.

| | Free | Plus (price TBD, e.g. $8–10/mo) |
|---|---|---|
| Cadence | Weekly digest | Daily (only when there's new content) |
| Length | Up to 10 min | 5 / 10 / 20 min |
| Voice model | Flash | Flash default; Multilingual v2/v3 "Studio voices" option |
| Voices | 3 curated voices | Full ElevenLabs voice library picker |
| Monthly character cap | ~40K | ~350K (enforced; the episode shortens to fit, never fails silently) |
| News opt-in | Yes | Yes |

- Caps are enforced in `planEpisode` (budget) and checked again before `synthesizeVoice`.
- SFX: a fixed set (intro sting, chapter transition, outro) generated once with the ElevenLabs sound effects API, stored as assets and reused for every episode.
- Voice library: fetched from the ElevenLabs voices API, cached; preview clips played in the picker. **No voice cloning in v1.**
- Every episode records characters and estimated cost; an admin page shows daily totals.

## 9. UI (web, responsive)

Tokens and the four phone screens as in the canvas (near-black ground, one accent, Geist / Geist Mono). Changes for v2:

1. **Onboarding (rework):**
   - Step 1: "Forward your newsletters here": the address with Copy, a tab per mail app (Gmail / Outlook / Apple Mail) with 3-step auto-forward guides, and a live status ("Waiting for your first newsletter…" → "Got Morning Brew ✓"). Shows the Gmail confirmation code as soon as it arrives.
   - Step 2: "Want us to catch you up on the news too?" (opt-in; topics + edition; mode always/fill).
   - Step 3: length, delivery time, voice (Free: 3 voices; Plus: library) → "Make my first episode".
2. **Home:** unchanged layout; chapter origin labels show the newsletter name ("Morning Brew · also in The Hustle") or "News · AI" / "Your link".
3. **Now playing:** unchanged; the source card lists all merged sources.
4. **Sources (rework):** forwarding address + guides; **Newsletters** list (name, last issue, enabled toggle, priority); links; news settings; private feed URL.
5. **Settings:** plan and usage meter (characters this month), voice picker (Plus), cadence, delivery time, rotate feed and forwarding addresses, delete account.

### Responsive rules
| Width | Layout |
|---|---|
| < 768 px | Canvas layouts, bottom tab bar (Today, Sources, Settings), full-screen player |
| 768–1023 px | Single column, max 640 px centred, bottom tab bar |
| ≥ 1024 px | Left sidebar nav; Home in two columns (episode + chapters / transcript + sources panel); persistent bottom player bar; content max 1200 px |

Global player component with Media Session metadata and desktop shortcuts (space, ←/→ 15 s, shift+←/→ chapter). Accessibility as v1 (real controls, labels, contrast ≥ 4.5:1, targets ≥ 44 px).

## 10. Security and privacy

- Auth0 sign-in; session checked in route handlers. Plan limits enforced server-side.
- Inbound: webhook signatures, verified-sender allow-list, SPF/DKIM verdicts, size limits, attachments ignored, HTML sanitised before storage. Raw emails kept 30 days then deleted.
- Feed and audio: unguessable tokens; rotate on demand.
- SSRF protection on link fetching.
- **Privacy policy** states plainly: newsletter text is processed by Google (Gemma via Gemini API) and voice text by ElevenLabs; neither is used to train our models; delete account removes everything. Check both providers' data terms (paid tiers if needed so data isn't used for training).

## 11. Partner technology (Hackathon)

| Category | Use |
|---|---|
| **Gemma** (featured) | All curation, clustering confirmation, summarising and scripting; EmbeddingGemma if used |
| **ElevenLabs** | Every episode's voice; voice library picker; generated SFX set |
| **Render** (featured) | Web service + background worker |
| **Tiger Data** | Postgres + pgvector (story clustering, heard-items) + hypertable for listening events |
| **SerpApi** | Opt-in news per topic and edition |
| **Temporal** | Scheduled, durable episode workflow |
| **Auth0 for AI Agents** | Sign-in; Token Vault Gmail import if built |
| **Sentry Agent Tracing** | Optional: traces per step and model call |

**Why open (for the post):** Gemma's open weights are what make the core affordable and portable: today it's served by Google; at scale the same prompts and schemas run on self-hosted Gemma with no rewrite and no per-token lock-in. The voice is the paid part; the brain is open.

## 12. Non-functional

- A 10-minute episode is ready within 5 minutes of the run starting.
- Inbound email to "item ready" within 60 seconds.
- Failure: "Today's episode couldn't be made: [reason]. Try again." Previous episodes remain.
- Costs logged per episode; alert when a user nears their cap.

## 13. Build order

| # | Milestone | Acceptance | Target |
|---|---|---|---|
| U0 | Repo, Next.js, Drizzle on Tiger Data, Auth0, tokens | Sign in; empty Home on phone and desktop | Sat morning |
| U1 | **Inbound email**: provider, webhook, verified senders, cleaning, item splitting, Gmail confirmation detection | Forwarding a real newsletter creates items within 60 s; Gmail code shows in the app | Sat midday |
| U2 | Pipeline 3–6 (cluster, plan, script, check) as functions + CLI | Script JSON with merged, cited chapters from 3+ newsletters | Sat evening |
| U3 | ElevenLabs voice + SFX + cover + publish + feed | MP3 plays in a podcast app via the private feed | Sat night |
| U4 | UI: onboarding (forwarding first), Home, Now playing, Sources, Settings, responsive, global player | Canvas screens + desktop layout work end to end | Sun midday |
| U5 | Links + opt-in news (SerpApi); plans and caps; Temporal schedule; Render deploy; domain | Scheduled episode appears; free cap enforced | Sun evening |
| U6 | Submission: demo video, screenshots, Lazy Payoff numbers, write-up | Post published | Mon before 07:00 |

**Cut line, in order:** Gmail Token Vault → RSS → listening-event ranking (keep the hypertable logging) → Temporal (Render cron calling the same functions) → voice library picker (keep 3 voices) → billing UI (keep plan flag + caps). **Never cut:** forwarding, cross-newsletter dedupe, citations, the script check, the private feed.

## 14. Acceptance

- A new user copies their forwarding address, sets a Gmail auto-forward (confirmation code shown in-app), forwards 3 newsletters, and gets a cited, deduplicated episode under 10 minutes.
- A story covered by two newsletters becomes one chapter crediting both.
- With news opt-in off, no news appears; with "fill quiet days", news appears only when newsletters don't fill the budget.
- Free users are capped at their weekly episode and character limit; the episode shortens rather than failing.
- The episode plays in a podcast app with cover and chapters, and in the web player on phone (390 px) and desktop (1440 px).
- Mail from an unverified sender is rejected and never reaches a model.

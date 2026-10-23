# PRD: Unread, your unread pile as a podcast

| | |
|---|---|
| **One line** | Every morning, Unread turns the latest stories on your topics, plus the links and newsletters you saved, into one short podcast episode, delivered to the app you already use |
| **Built for** | DEV Hacktoberfest 2026, Week 3 "Slow and Steady" (rewards laziness). Deadline **Oct 25, 11:59 PM PDT = Mon Oct 26, 07:59 WAT**. New repo, created inside the window |
| **Domain** | `getunread.site` (optionally also a free `.tech` that redirects, for the .tech category) |
| **UI reference** | The "Unread app screens" design canvas: Onboarding, Home (today's episode), Now playing, Sources |
| **Owner** | Lucky Victory (@CodewithVeek) |

> **Claude Code:** build in the order of §12 and stop at the cut line if time runs out. Verify every third-party API named here (SerpApi, Gemma hosting, kokoro-js, EmbeddingGemma, Auth0, Temporal, Render, Tiger Data) against current docs before coding, and record choices in `docs/decisions/`. Code standards from `CLAUDE.md` apply (strict TS, no `any`, Zod at boundaries, kebab-case files, options objects for 3+ params, feature folders).

## 1. Problem and users

- People save far more than they read. Pocket, the biggest read-it-later app, shut down in July 2025, and its users' saved articles mostly went unread.
- Listening is a daily habit: 45% of Americans aged 12+ listen to a podcast weekly (Edison, Infinite Dial 2026). Commutes, workouts and chores are unused time.
- Existing tools need effort: NotebookLM's Audio Overviews are made one notebook at a time; text-to-speech readers read everything aloud, with no curation or summary. Huxe (a closed, cloud app) is the closest competitor.

**Users:** busy professionals and students who follow a few topics, subscribe to newsletters and save links they never read.

**Lazy payoff (for the post):** "Saved 40 things this week, read 3. Unread covered all 40 in 35 minutes of commuting, with zero effort after setup."

## 2. Principles

- **P1 · Zero effort after setup.** Episodes arrive every morning; the user never has to press "generate".
- **P2 · Honest summaries.** Every chapter cites its sources and links to them. No claim, number or quote that isn't in the source. Summaries are in our own words: never reproduce full articles.
- **P3 · Open models do the work.** Gemma writes, Kokoro speaks, EmbeddingGemma deduplicates. The same app can run fully locally (Ollama) for anyone who wants that.
- **P4 · User-focused, not location-assumed.** Topics are global; the user's country sets only the news edition. Local topics appear only when the user searches for or adds them.
- **P5 · Fit the user's habits.** Delivery is a private podcast feed for Apple Podcasts, Pocket Casts and others, plus the web player.

## 3. Scope

### In (v1)
- Sign-in (Auth0), onboarding: topics, episode length, news edition, delivery time.
- Sources: topics (news), pasted links, RSS feeds, forwarded newsletters (email-in address).
- Daily episode pipeline (§6) with chapters, transcript, sources and a generated cover.
- Private RSS feed per user.
- Web app: Home, Now playing, Topics, Sources, Settings. Responsive from phone to desktop (§8).

### Out (v1)
- Native mobile apps, browser extension, Gmail import (P1 stretch via Auth0 Token Vault), multiple episodes a day, social or sharing features, payments.

## 4. Architecture

```
apps/web (Next.js App Router, UI + API route handlers)
  │  Auth0 session · Drizzle
  ▼
Postgres on Tiger Data (+ pgvector)  ◄──────────────┐
                                                     │
apps/worker (Node, Temporal worker)                  │
  ├─ collect:    SerpApi (Google News), RSS, saves, inbound email
  ├─ extract:    fetch + Readability → clean text (respect robots, skip paywalled text)
  ├─ dedupe:     EmbeddingGemma vectors → cluster same story across outlets; drop already-heard
  ├─ plan:       Gemma picks + orders stories to fit the length budget
  ├─ script:     Gemma writes chapters as Zod-validated JSON with source ids
  ├─ check:      deterministic checks (numbers and quotes appear in sources)
  ├─ voice:      Kokoro per chapter (ElevenLabs optional) → ffmpeg concat + loudness
  ├─ cover:      seeded SVG → PNG (resvg)
  └─ publish:    episode row + audio/cover to storage + feed refresh
Temporal schedules one workflow per user per morning, at their delivery time
Hosting: Render (web service + background worker); object storage for MP3/PNG
```

**Model serving (decide in an ADR):**
- **Hosted (default):** Gemma through an OpenAI-compatible endpoint (e.g. Google AI Studio / Vertex serving Gemma, or a GPU host). Render has no GPUs, so the model is not run on Render.
- **Local:** Ollama with a small Gemma; the same `ModelClient` interface, switched by env.
- **Voice:** Kokoro (`kokoro-js`, CPU) runs in the Render worker.
- **Embeddings:** EmbeddingGemma, in the worker (transformers.js / ONNX) or via the same model endpoint; verify which works on Render's CPU.

## 5. Data model (Drizzle, Postgres on Tiger Data, ULIDs)

| Table | Key columns |
|---|---|
| `users` | id, auth0_sub, email, country, language, timezone, delivery_time (local `HH:mm`), episode_minutes (5/15/30), voice_id, feed_token (random, rotatable), inbound_alias |
| `user_topics` | id, user_id, label, query (search string), is_custom, created_at |
| `rss_feeds` | id, user_id, url, title, last_fetched_at |
| `saved_items` | id, user_id, kind (`link`/`email`/`rss`), url, title, raw_ref, status (`queued`/`used`/`skipped`), created_at |
| `articles` | id, url (unique), canonical_url, title, outlet, published_at, text_excerpt, text_hash, embedding vector, fetched_at |
| `episodes` | id, user_id, date, status (`planning`/`voicing`/`ready`/`failed`), title, duration_s, audio_key, cover_key, transcript (jsonb), error (jsonb) |
| `chapters` | id, episode_id, position, title, start_s, end_s, summary, script (jsonb) |
| `chapter_sources` | chapter_id, article_id, role (`primary`/`also`) |
| `heard_articles` | user_id, article_id, episode_id (powers "don't repeat what I heard") |
| `step_runs` | episode_id, step, status, attempt, output_ref, timings (for the run log and Sentry/Temporal views) |

## 6. Daily pipeline (Temporal workflow `make-morning-episode`)

| # | Activity | Rules |
|---|---|---|
| 1 | `collectCandidates` | Per topic: SerpApi Google News with `gl`/`hl` from the user's news edition, last 24–36 h. Plus queued saves and new RSS items. Cap ~60 candidates |
| 2 | `extractArticles` | Fetch and extract readable text (Mozilla Readability); cache by URL. Respect robots.txt. Paywalled or blocked pages keep only title + snippet and are marked `limited` |
| 3 | `dedupeAndCluster` | Embed title + excerpt; cluster near-duplicates (same story, many outlets) into one candidate with several sources; drop anything in `heard_articles` |
| 4 | `planEpisode` | Gemma ranks clusters for this user (saves first, then topic relevance and freshness) and fits a word budget: ~150 spoken words per minute × `episode_minutes`. Output: ordered list of clusters with target seconds |
| 5 | `writeScript` | Gemma writes each chapter as JSON (Zod): `{ title, lines: [{ text, sourceIds[] }] }`, an intro and an outro. Repair loop: up to 3 attempts on schema or budget failures |
| 6 | `checkScript` | Deterministic: every number and quoted phrase must appear in a cited source's text; every line cites ≥1 source; no line longer than 30 words. Failing lines are regenerated once, then dropped |
| 7 | `synthesizeVoice` | Kokoro per line (cached by hash); short pause between chapters; concat to MP3 with ffmpeg; loudness to −16 LUFS. Chapter start times come from clip durations |
| 8 | `renderCover` | Seeded SVG (seed = user id + date + top topics), 3000×3000 PNG for the feed, 1200×1200 for the app |
| 9 | `publishEpisode` | Upload audio and cover; write episode, chapters, sources, `heard_articles`; mark saves `used` |

- Idempotent activities (keyed by episode + step); retries with backoff; heartbeat during voice synthesis.
- If too few candidates (< 3), make a short episode or skip the day with a notice, never pad with filler.
- The run starts 30 minutes before the user's delivery time, in their timezone.
- "Generate now" button for the demo and first-run (rate-limited to 2 per day).

## 7. Feed and inbound email

- **Feed:** `GET /feed/:feedToken.xml`, RSS 2.0 with iTunes tags (`itunes:image`, `itunes:duration`, `itunes:block` = yes, `itunes:explicit` = false), last 30 episodes. Each item: title, chapter list and source links in the description, enclosure (MP3). Rotating the token invalidates the old URL. The feed is unguessable, never indexed, and holds no email address.
- **Podcasting 2.0 chapters** (`podcast:chapters` JSON) for apps that support them.
- **Inbound email:** a provider's inbound webhook (pick in an ADR, e.g. Postmark Inbound or Cloudflare Email Routing to a worker) → `POST /inbound/email` (signature verified) → find the user by alias → store as a `saved_item` (`kind: email`). Only accept mail sent from the user's verified address.

## 8. UI (web, responsive)

The canvas is the reference: near-black ground `#0E0F12`, surfaces `#17181D`/`#1F2128`, lines `#2A2D35`, text `#F2F3F5`, muted `#A3A8B3`, one accent (default `#5B9BFF`, the "unread dot"); Geist and Geist Mono. Build the UI with Tailwind + shadcn/ui themed to these tokens.

### Screens
1. **Onboarding:** search any topic; suggested global topics as toggle chips; episode length (5/15/30); news edition (detected country, editable); delivery time; continue → Sources → "Generate my first episode".
2. **Home (Today):** date, the episode card (cover, "12 stories from…", length, made-at time, big play button, progress), and "In this episode" chapters with origin labels (Topic · AI / Your save · newsletter). Empty state while the first episode is being made shows step progress.
3. **Now playing:** chapter title and origin, transcript that highlights the current line, source card with link, progress bar with chapter marks, speed, previous/next chapter, skip story.
4. **Sources:** private feed URL (copy, "Add to Apple Podcasts", "Pocket Casts"), paste a link, the forwarding address, RSS feeds, and "Saved for tomorrow" with remove.
5. **Topics:** add, remove, search; custom topics (any team, city or niche) show here only if the user adds them.
6. **Settings:** voice (Kokoro voices; ElevenLabs premium if configured), delivery time, length, news edition, rotate feed URL, delete account and data.

### Responsive rules (phone → desktop)
| Width | Layout |
|---|---|
| < 768 px | The canvas layouts: single column, bottom tab bar (Today, Topics, Sources), full-screen Now playing |
| 768–1023 px | Single column, max width 640 px centred; bottom tab bar |
| ≥ 1024 px | Left sidebar nav (240 px) replaces the tab bar. Home becomes two columns: episode card + chapters (left, ~520 px) and the transcript/sources panel for the selected chapter (right, fluid). Now playing is a persistent bottom player bar (cover, title, controls, progress) instead of a full screen; the transcript opens in the right panel. Content max width 1200 px |

- One component tree; layout changes by CSS breakpoints, not separate pages.
- The audio player is a single global component (persists across navigation), with Media Session API metadata (lock-screen controls) and keyboard shortcuts on desktop (space, ←/→ for 15 s, shift+←/→ for chapters).
- Accessible: real buttons and links, `aria-label` on icon buttons, focus rings, contrast ≥ 4.5:1, touch targets ≥ 44 px, captions = transcript.

## 9. Auth and security

- **Auth0** for sign-in (Universal Login: email + Google). The session is checked in route handlers, not only middleware.
- **P1 stretch:** Auth0 **Token Vault** to read newsletters from the user's Gmail with explicit consent (labels the user picks), instead of forwarding. Clear "disconnect" in Settings.
- Feed and audio URLs use unguessable tokens; audio served via signed, expiring URLs from storage (the feed's enclosure URLs are long-lived signed or proxied through `/audio/:token`).
- Rate limits on paste, "Generate now", inbound email and auth routes. SSRF protection on link fetching (block private IP ranges, cap size and time).
- Delete account removes the user's rows, audio and covers.

## 10. Partner technology (enter only what's genuinely used)

| Category | Use |
|---|---|
| **Gemma** (featured) | Planning, scripting, script repair; EmbeddingGemma for dedupe |
| **Render** (featured) | Web service + background worker hosting |
| **SerpApi** | Google News results per topic and edition |
| **Tiger Data** | Postgres + pgvector for articles, dedupe and "already heard" |
| **Temporal** | Daily scheduled, durable episode workflow |
| **Auth0 for AI Agents** | Sign-in; Token Vault for Gmail newsletters (if built) |
| **ElevenLabs** | Optional premium voice |
| **.tech domain** | Only if a `.tech` domain is claimed and redirected |
| **Sentry Agent Tracing** | Optional: traces per pipeline step and model call, screenshots in the post |

## 11. Non-functional

- An episode for 15 minutes is ready within 10 minutes of the run starting (measure; Kokoro on CPU is the bottleneck: generate chapters in parallel within RAM limits).
- Cost per episode is logged (SerpApi calls, model tokens) for the post's "why open" section.
- Failures: the user sees "Today's episode couldn't be made: [reason]. Try again." and yesterday's episode stays available.

## 12. Build order (≈ 60 hours)

| # | Milestone | Acceptance | Target |
|---|---|---|---|
| U0 | Repo, Next.js app, Drizzle schema on Tiger Data, Auth0 sign-in, design tokens | Sign in; empty Home renders on phone and desktop | Fri night |
| U1 | Pipeline steps 1–6 as plain functions + CLI `pnpm brief --user <id>` (no Temporal yet) | A real script JSON with cited sources for 3 topics | Sat midday |
| U2 | Voice + cover + publish (steps 7–9); feed endpoint | An MP3 plays in Pocket Casts via the private feed | Sat evening |
| U3 | UI: onboarding, Home, Now playing, Sources, responsive layouts, global player | The canvas screens work end to end; desktop two-column layout | Sun midday |
| U4 | Temporal daily schedule + "Generate now" + Render deploy + domain | An episode appears automatically at the set time | Sun evening |
| U5 | Submission: demo video, screenshots, Lazy Payoff timings, write-up | Post published | Mon before 07:00 |

**Cut line, in order:** Gmail via Token Vault → RSS feeds → inbound email (keep paste) → Temporal (use a Render cron job calling the same functions) → ElevenLabs. Never cut: citations, the script check, the private feed.

## 13. Acceptance (v1)

- A new user signs in, picks 3 topics, adds 2 links, taps "Generate my first episode", and within 10 minutes plays a 5–15 minute episode with chapters, a transcript and source links.
- The same episode plays in a podcast app via the private feed, with cover art and chapters.
- No chapter contains a number or quote absent from its sources (checked by the script check and spot-checked by hand on 3 episodes).
- A story already heard yesterday does not repeat today.
- A US user with default topics gets US-edition news and no location-specific topics.
- Phone (390 px) and desktop (1440 px) layouts both match the rules in §8.

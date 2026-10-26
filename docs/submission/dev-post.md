---
title: I had 124 unread newsletters. Now they read themselves to me on my commute
published: false
tags: devchallenge, hf26challenge, ai, opensource
cover_image: https://raw.githubusercontent.com/codewithveek/unread/claude/nifty-galileo-tinqrd/docs/submission/cover.jpg
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

My inbox has 124 unread newsletters. I subscribed to every one of them on purpose. Neo Kim's *System Design Newsletter* teaches me something every day, and Gregor Ojstersek's *Engineering Leadership* is the closest thing I have to a mentor. They're important. I'm just too lazy to read them.

I am not too lazy to listen, though. I have a 40-minute commute to the office and my ears are free the whole way. So I built **Unread**: It picks up your newsletters to a private address, and turns them into one short podcast episode, with every story heard once, every claim cited.

## What I Built

**[Unread](https://getunread.site)** turns the newsletters you never get to read into a short, private podcast.

1. **Forward once.** You get a private address like `k7m2q9x4ab@in.getunread.site`. Add one Gmail filter that forwards your newsletters to it. Gmail sends a confirmation code first, so Unread catches that email and shows the code in the app. After that you never touch it again.
2. **Unread does the reading.** Every issue is cleaned (footers, unsubscribe blocks, tracking pixels and sponsor sections removed) and split into separate stories.
3. **You hear each story once.** This is the part I care about most, and it's really two features:
   - **The same story from several newsletters becomes one chapter that credits all of them.** When two newsletters cover the same launch in the same week, you hear it once: *"Engineering Leadership and The System Design Newsletter both covered this."*
   - **A story you already heard is skipped.** If a newsletter brings it up again next week, Unread remembers and leaves it out.
4. **Nothing is made up.** Every line of the script must cite the newsletter it came from. Any number or quote that isn't in that source is rewritten once, and cut if it still fails. Every chapter lists its sources, with links.
5. **It plays where you already listen.** Each episode has chapters, a transcript that highlights the line being spoken, and the sources. Episodes go to a private RSS feed that works in any podcast app that accepts a feed URL (the Sources page has one-tap buttons for Apple Podcasts and Pocket Casts), and to a web player on phone and desktop.

**Who gets to be lazier?** Anyone with multiple newsletter subscriptions and a commute, a gym session or a pile of dishes. After two minutes of setup, the effort is zero. No app to open, no "read later" queue to feel guilty about, no reading the same funding round four times.

**Slow and steady, on purpose.** The Free plan makes one episode a week, voiced by an open-weight model on a CPU. A 10-minute episode takes the worker a few minutes to record, and nobody minds, because it's made on a schedule while you sleep. It only runs when there's something new: fewer than two new stories means no episode and no cost.

## Demo

**Live:** [getunread.site](https://getunread.site). Sign in, copy your forwarding address, and forward one newsletter by hand to try it.

{% embed ✏️ https://youtu.be/RVmLeH0rQ_0 %}

*The video's narrator and the episode's host are both ElevenLabs voices. The screens are rebuilt from the app's own components and strings.*

![My Gmail inbox: newsletter after newsletter, unread](https://raw.githubusercontent.com/codewithveek/unread/claude/nifty-galileo-tinqrd/docs/submission/inbox.jpg)

![Forwarding setup: the private address, and Gmail's confirmation code caught and shown in the app](https://raw.githubusercontent.com/codewithveek/unread/claude/nifty-galileo-tinqrd/docs/submission/gmail-code.jpg)

![Two newsletters, one story: Gemma 4 confirms the borderline pair](https://raw.githubusercontent.com/codewithveek/unread/claude/nifty-galileo-tinqrd/docs/submission/gemma-confirms.jpg)

![The merged chapter credits both newsletters](https://raw.githubusercontent.com/codewithveek/unread/claude/nifty-galileo-tinqrd/docs/submission/one-chapter.jpg)

![The fact check: a number that isn't in the cited source gets cut](https://raw.githubusercontent.com/codewithveek/unread/claude/nifty-galileo-tinqrd/docs/submission/fact-check.jpg)

![Now playing: the line being spoken is highlighted, and every source is one tap away](https://raw.githubusercontent.com/codewithveek/unread/claude/nifty-galileo-tinqrd/docs/submission/now-playing.jpg)

## Code

{% github codewithveek/unread %}

| Path | What's in it |
|---|---|
| `apps/web` | Next.js 16 app: onboarding, Today, Now playing, Sources, Settings; the inbound-email, feed, audio and billing routes |
| `apps/worker` | Temporal worker (or a polling fallback) that runs the episode pipeline, plus CLIs (`pnpm brief`, `pnpm make-episode`) |
| `apps/inbound-worker` | Cloudflare Email Worker that relays forwarded mail, signed |
| `packages/core` | All the logic: email parsing, clustering, planning, scripting, fact check, voices, audio, cover, RSS feed, plans, promo codes |
| `packages/db` | Drizzle schema and migrations: Postgres with pgvector and a Timescale hypertable |

The repo was started on October 23, inside the challenge window. Every third-party choice is written up as a decision record in [`docs/decisions/`](https://github.com/codewithveek/unread/tree/main/docs/decisions), and the product spec is in [`docs/prd-unread.md`](https://github.com/codewithveek/unread/blob/main/docs/prd-unread.md). Integration tests run against real EmbeddingGemma, real Kokoro, real ffmpeg and Temporal's time-skipping test server, not mocks.

## How I Built It

### The open-source AI at the centre

| Model | Licence | What it does in Unread | Where it runs |
|---|---|---|---|
| **Gemma 4 31B** (`gemma-4-31b-it`) | Gemma open weights | Every editorial decision: confirms borderline "same story?" pairs, ranks stories, writes each chapter as cited JSON, repairs lines that fail the fact check | Served by Google's Gemini API, with OpenRouter (the same open model) as the fallback |
| **EmbeddingGemma 300M** (`onnx-community/embeddinggemma-300m-ONNX`, q8) | Gemma open weights | Turns every story into a 768-dimension vector, to find the same story across newsletters and stories you've already heard | **On our own worker's CPU**, through transformers.js 3.8.1 (ONNX Runtime) |
| **Kokoro-82M** (`onnx-community/Kokoro-82M-v1.0-ONNX`, q8) | Apache-2.0 | Reads every Free episode aloud, in four curated voices | **On our own worker's CPU**, through kokoro-js |

Around them it's open source all the way down: Postgres with **pgvector** from **Tiger Data**, **Temporal**, **ffmpeg**, Mozilla's **Readability**, **resvg** for covers, and Next.js.

### The pipeline

```
newsletter ─► Cloudflare Email Worker ─signed─► /inbound/email (Next.js on Render)
                (HMAC over the raw MIME)         verified sender? SPF/DKIM pass?
                                                 clean → split into stories → items
                                                        │
Temporal schedule (or "Make one now") ─► makeEpisodeWorkflow (worker on Render)
   collect → EmbeddingGemma + pgvector → Gemma confirms borderline pairs → skip heard
   → Gemma ranks → Gemma writes cited JSON → deterministic fact check (+1 repair)
   → Kokoro (Free) / ElevenLabs (Plus) → ffmpeg, −16 LUFS → seeded cover → publish
                                                        │
             private RSS feed /feed/<token>.xml + web player with chapters and transcript
```

**1. Getting mail in safely.** Cloudflare Email Routing hands each forwarded message to a small Email Worker, which signs the raw MIME with an HMAC (`X-Unread-Signature`) and posts it to the app. The app accepts mail only from the user's verified addresses and only when SPF or DKIM passes. Everything else is dropped and logged **before any model sees it**. Gmail's forwarding-confirmation email is recognised by its subject, and its code is stored and shown in onboarding as soon as it arrives. Retries are idempotent on `Message-ID`.

**2. Cleaning and splitting.** HTML becomes text, with footers, unsubscribe blocks, tracking pixels and identifiable sponsor sections removed and links kept. Each issue is split into stories at its headings, where a short line that's all bold counts as a heading. The newsletter's name comes from the sender or `List-Id`, for citations.

**3. Same story, heard once.** EmbeddingGemma embeds every story on the worker. Measured on the dev container, the same story from two different outlets scores about **0.93** cosine similarity and unrelated stories about **0.30**, so the thresholds are:

| Cosine similarity | What happens |
|---|---|
| ≥ 0.83 | Same story: merged into one chapter |
| 0.72 to 0.83 | Borderline: **Gemma decides** (*"same event, announcement or finding, not just the same topic"*), at most 30 pairs per episode |
| ≥ 0.85 against anything you've heard | Already heard: skipped |

"Already heard" is a single pgvector query against the stories in your past episodes:

```ts
const [nearest] = await db.execute<{ similarity: number }>(sql`
  select 1 - (i.embedding <=> ${vector}::vector) as similarity
  from ${schema.heardItems} h
  join ${schema.items} i on i.id = h.item_id
  where h.user_id = ${userId} and i.embedding is not null and i.id <> ${c.id}
  order by i.embedding <=> ${vector}::vector
  limit 1`);
if (nearest && Number(nearest.similarity) >= HEARD) heardItemIds.push(c.id);
```

**4. Planning.** Gemma ranks the stories within your priority tiers ("always first", "normal", "only if room"). It factors in how often you skip each source, read from a **Timescale hypertable** of listening events over the last 60 days, then freshness. It fits the result to a character budget for your plan and episode length (about 900 characters per spoken minute).

**5. Writing, with a leash.** Gemma writes each chapter as JSON, `{ title, lines: [{ text, sourceIds }] }`, from the sources in that chapter only. Gemma on the Gemini API has no JSON mode, so the prompt states the contract. The reply is validated with Zod plus semantic checks (length budget, known source ids), and errors are fed back for up to three attempts. The intro and outro are **templates**, not model output, so the part that names your newsletters can't hallucinate: *"This is Unread for Monday, 26 October. 4 stories today, from…"*

**6. The fact check is code, not vibes.** Every line goes through a deterministic check:

```ts
export function checkLine(line: ScriptLine, allowed: Set<string>, sourceText: Map<string, string>): string[] {
  const problems: string[] = [];
  const cited = line.sourceIds.filter((id) => allowed.has(id));
  if (cited.length === 0) problems.push("cites no valid source");
  const words = line.text.trim().split(/\s+/).length;
  if (words > MAX_WORDS_PER_LINE) problems.push(`${words} words (max ${MAX_WORDS_PER_LINE})`);
  const haystack = normalizeText(cited.map((id) => sourceText.get(id) ?? "").join("\n"));
  const sourceNumbers = new Set(numbersIn(haystack));
  for (const n of numbersIn(line.text)) {
    if (!sourceNumbers.has(n)) problems.push(`number ${n} is not in the cited sources`);
  }
  for (const q of quotesIn(line.text)) {
    if (!haystack.includes(q)) problems.push(`quote "${q}" is not in the cited sources`);
  }
  return problems;
}
```

A failing line goes back to Gemma once, along with the exact problems. If it still fails, it's dropped. A shorter episode beats a wrong one.

**7. Voices.** A `VoiceProvider` interface has two implementations, chosen by the user's plan. Voice code never checks plans itself.
- **Kokoro** voices the Free plan on the worker's CPU. Measured: 8.6 s of speech in 6.6 s on one thread. A 10-minute episode is about 7.8 CPU-minutes, or about 4 minutes with two jobs in parallel.
- **ElevenLabs** voices Plus. Standard voices use `eleven_flash_v2_5`; Studio voices use `eleven_v4`, with neighbouring lines passed as context so the delivery flows.

Every line is cached by `sha256(provider | model | voice | text)`, so a retry never pays twice. ffmpeg joins the lines in one pass and normalises to −16 LUFS. Chapter and per-line start times come from exact sample counts, which is how the transcript highlights the line being spoken.

**8. Cover and feed.** Each episode gets a seeded SVG cover (your date and newsletters), rendered to PNG with resvg. The private RSS feed has iTunes and Podcasting 2.0 tags, chapter JSON per episode and `itunes:block`, behind a 192-bit token you can rotate.

**9. Durable by default.** `makeEpisodeWorkflow` runs the steps as **Temporal** activities: start → script → voice (with heartbeats) → cover → publish. Each step stores its output and checks for it before redoing work, so a retried activity never re-buys voice or re-asks Gemma. Two Temporal Schedules drive it: a dispatcher every 10 minutes (who is due, in their own timezone) and hourly maintenance (raw mail is deleted after 30 days, and trials expire). If Temporal is unavailable, the same worker falls back to a `FOR UPDATE SKIP LOCKED` poller that runs the same step functions. The workflow is tested with Temporal's time-skipping environment: steps run in order, the voice step is retried after a transient failure, and nothing is published when the request is skipped.

**10. Hosting.** Both halves run on **Render**. The web app is a Node service on `getunread.site`, which runs the migrations before each deploy. The worker is a Docker background worker with ffmpeg and the ONNX models baked into the image, so a cold start doesn't download the models first.

### Plans, without surprises

| | Free | Plus ($12/mo) |
|---|---|---|
| Voice | Kokoro (open-weight, 4 voices) | ElevenLabs Standard or Studio voices |
| Cadence | Weekly, on your chosen day | Daily, only when there's something new |
| Length | Up to 10 minutes | 5, 10 or 20 minutes |

The effective plan comes from one function: paid Plus, or an unexpired promo trial, or Free. Promo codes give a Plus trial with no card. A trial is capped at 3 ElevenLabs episodes, redemption is atomic, and it needs a verified email. Payments go through Bachs, and plans change **only** from its signed, idempotent webhooks, never from a redirect URL.

### What fought back

- **Two ONNX runtimes in one process crash.** kokoro-js ships with transformers.js 3.x, so EmbeddingGemma had to run on the same pinned `@huggingface/transformers@3.8.1`, or Node fails with `VERS_1.21.0 not found`.
- **No JSON mode for Gemma on the Gemini API.** Hence the contract-in-the-prompt, a Zod check and the three-attempt repair loop. Gemma follows a stated schema well once the error message tells it exactly what was wrong.
- **Gmail won't auto-forward until you confirm by email.** That would have been the onboarding killer: users would have to go find a code in a mailbox they can't see. So Unread catches the confirmation email and puts the code on the setup screen.

## Why Does Open Innovation Matter?

**Open models are what make a free plan possible at all.** Voice is the expensive part of a podcast. With ElevenLabs, a 10-minute episode is about 9,000 characters, roughly 36 cents at Flash prices or 72 cents for a Studio voice, every time. If every listener cost that much, Unread would have to be paid-only. Kokoro is Apache-2.0 and runs on our own worker, so a Free episode costs CPU time and nothing per character. ElevenLabs became the upgrade instead of the foundation.

**The model that reads your newsletters runs where we choose.** EmbeddingGemma reads every story you forward, and it runs on our worker's CPU. There's no per-call bill, no rate limit, and your newsletter text isn't sent to a separate embeddings service just to be compared.

**No single vendor holds the off switch.** Gemma is served by Google today, but it's open weights. That's why the fallback works: when the Gemini API returns 429s, the same model is called through OpenRouter, and the prompts and the fact check behave the same. With a closed model there's no second provider to fall back to. The model client already supports the OpenAI-compatible protocol, so pointing it at a self-hosted or fine-tuned Gemma is a small change, not a rewrite.

**Trust is checkable.** The part that protects listeners from made-up numbers is open code (`checkLine` above), not a promise in a model card. Anyone can read exactly what "every claim is cited" means.

## My Agent Session

✏️ *Embed or link your DevRelay session here.*

I built Unread with an AI coding agent, spec first: a product spec ([`docs/prd-unread.md`](https://github.com/codewithveek/unread/blob/main/docs/prd-unread.md)) with a build order and a cut line, a `CLAUDE.md` with the code standards, and a decision record for every third-party choice. The agent built milestone by milestone, U0 to U5: repo and auth, inbound email, the script pipeline, voice and feed, UI, then plans, Temporal and deploy. It checked each one against real models and real ffmpeg before moving on.

## The Lazy Payoff

- **Setup:** one Gmail filter, once. About two minutes.
- **Last week in my inbox:** 6 new issues from two newsletters between Oct 19 and Oct 23. Four came from Neo Kim, on networking and AI engineering, and two from Gregor, on using AI at work and communicating your impact. At their own read times, that's ✏️ 55 minutes of reading I was never going to do.
- **What Unread made from it:** ✏️ *one 10-minute episode, 6 chapters*, heard on the way to the office.
- **Effort after setup:** zero. The filter forwards, the schedule makes the episode, and my podcast app downloads it.
- **What it costs to make:** $0 in voice on Free (CPU time only); about 36 cents for a 10-minute episode on ElevenLabs Flash.

My inbox still says 124 unread. I'm caught up anyway.

## Prize Categories

- **Best Use of Gemma.** Gemma 4 31B makes every editorial call: borderline same-story pairs, ranking, every cited chapter script, and repairing lines that fail the fact check. EmbeddingGemma runs locally on CPU for clustering and "already heard".
- **Best Use of Render.** The web app (Node, `getunread.site`, migrations as a pre-deploy step) and the Docker background worker that runs EmbeddingGemma, Kokoro and ffmpeg.
- **Best Use of ElevenLabs.** Studio (`eleven_v4`) and Standard (`eleven_flash_v2_5`) voices for Plus, with request stitching and per-line caching. The demo video's narration and the episode host are ElevenLabs too.
- **Best Use of Tiger Data.** Postgres with pgvector (`vector(768)`, cosine HNSW index) for same-story clustering and "already heard", and a TimescaleDB hypertable of listening events whose skip rates feed the ranking.
- **Best Use of Temporal.** `makeEpisodeWorkflow` with idempotent activities, heartbeats on voice, a 10-minute dispatch Schedule and an hourly maintenance Schedule, tested with time skipping.
- **Best Use of SerpApi.** Opt-in news: pick topics and your country's edition, and Unread adds a news segment (always, or only on quiet days) from Google News results from the last 36 hours.
- **Best Use of Auth0 for AI Agents.** Sign-in, with `requireUser()` checked in every page and route handler; the sign-in email becomes the first verified sender.

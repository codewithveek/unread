# 0006 · Voices: Kokoro for Free, ElevenLabs for Plus

**Status:** Accepted (2026-10-24). The ElevenLabs provider is waiting on the API key (see "Pending").

## Decision
- **`VoiceProvider` interface** (`packages/core/src/voice`): `synthesize({ text, voiceId })` returns 24 kHz mono float PCM. The pipeline picks a provider from the user's **effective plan** (`voiceProviderFor`). Voice code never checks plans.
- **Kokoro (Free):** `kokoro-js` 1.2.1, `onnx-community/Kokoro-82M-v1.0-ONNX`, q8, CPU, Apache-2.0. There are four curated voices, `af_heart`, `af_bella`, `am_michael` and `bf_emma`; the last two are placeholders until listening tests (PRD §8). Static previews are in `apps/web/public/voices/`.
  - **Measured:** 6.6 s to generate 8.6 s of speech in this container (about 0.77× real time on one thread). A 10-minute episode is roughly 7.8 CPU-minutes. With `KOKORO_CONCURRENCY=2` on a 2-CPU instance, that's about 4 minutes, which meets "ready within 5 minutes". Measure again on the Render instance.
  - The espeak-ng phonemizer is GPL. Running it on our server isn't distribution; check the licence before ever shipping it inside an app.
- **Cache:** every line is cached by `sha256(provider | model | voice | text)` in object storage, so retries never pay twice.
- **Assembly:** ffmpeg, one pass. Lines are joined with 0.28 s pauses, chapters with 0.7 s pauses plus an optional transition SFX, an optional intro and outro sting, `loudnorm=I=-16:TP=-1.5`, MP3 at 96 kbps mono. Chapter and per-line start times come from exact sample counts, so the transcript can highlight the current line.
- **Users keep one voice per provider** (`kokoro_voice_id`, `elevenlabs_voice_id`), so a trial ending loses nothing.

## ElevenLabs (Plus, trials, previews, SFX)
Set up with the ElevenLabs CLI onboarding (`onboard init` → `check`, SDK `@elevenlabs/elevenlabs-js` 2.74; the key comes only from `ELEVENLABS_API_KEY`), written following ElevenLabs' text-to-speech and sound-effects skills.
- **Models:** Standard = `eleven_flash_v2_5` (≈ $0.04 / 1K chars). Studio = `eleven_v4` (≈ $0.08 / 1K): the skill lists v4 as the current highest-quality model, superseding the Multilingual v2/v3 named in the PRD. Studio is for paid Plus; trials use Standard to cap trial cost. Saved per user in `users.voice_quality`.
- **Synthesis:** `textToSpeech.convert(voiceId, { modelId, outputFormat: "pcm_24000", previousText, nextText })`. Request stitching passes the neighbouring lines. 16-bit PCM is decoded straight into the same 24 kHz pipeline as Kokoro.
- **Voice picker (Plus):** `voices.search` (the account's voices, including library voices added to it), cached for an hour, using ElevenLabs' own `previewUrl` clips. The default is George (`JBFqnCBsd6RMkjVDRZzb`).
- **"Upgrade to Studio voices" (Free):** `GET /voice-preview/<voiceId>` generates the same intro once per voice with the Studio model, caches it in storage (`audio_assets` `preview-<id>`), and is limited to signed-in users, known voices, and 10 new previews an hour per user.
- **SFX:** `pnpm generate-assets` creates `sfx-intro` (2.5 s), `sfx-transition` (1 s) and `sfx-outro` (2.5 s) with `textToSoundEffects.convert`, once. Assembly picks them up for every plan.

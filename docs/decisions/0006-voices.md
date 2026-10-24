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

## Pending: ElevenLabs (Plus, trials, SFX)
The user ran `npx @elevenlabs/cli onboard init`. Its rules say no ElevenLabs code until `ELEVENLABS_API_KEY` is set and `onboard check` passes. Once it does:
- `ElevenLabsVoiceProvider` (Flash by default, Multilingual v2/v3 "Studio voices"), using request stitching where the model supports it.
- A voice library picker for Plus, and a cached 10-second "Upgrade to Studio voices" preview.
- The fixed SFX set (intro sting, chapter transition, outro), generated once into `audio_assets` (`sfx-intro`, `sfx-transition`, `sfx-outro`). Assembly already picks them up when present.
Until then, Plus and trial episodes fail with a friendly message ("the Studio voice isn't available right now") and earlier episodes stay.

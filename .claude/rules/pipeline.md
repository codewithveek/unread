---
paths:
  - "packages/core/**"
  - "apps/worker/**"
---

# Pipeline and worker rules

- Episode steps (`packages/core/src/episodes/steps.ts`) must stay idempotent: each checks its stored step output (`storageKeys.stepOutput`) or episode state before redoing work, because Temporal retries activities.
- Rejected inbound mail must never reach a model. Gmail confirmations and sender verifications are handled before the verified-sender gate; everything else needs a verified forwarder + SPF/DKIM pass (or `INBOUND_TRUST_UPSTREAM_AUTH`).
- Scripts must stay honest (P2): every chapter line cites ≥ 1 of its chapter's sources; numbers/quotes must appear in cited source text; ≤ 30 words; intro/outro are templates. Don't weaken `checkLine` to make a model pass.
- Voice code never checks plans; `voiceProviderFor(id, config, { quality })` is chosen from `effectivePlan()`. ElevenLabs reads `ELEVENLABS_API_KEY` from the environment only.
- Keep `@huggingface/transformers` at the same 3.x version as kokoro-js (one ONNX runtime per process).
- In drizzle `sql` templates never interpolate `Date` values; use `lt/gt/eq`.
- New external API: verify against current docs, then write an ADR in `docs/decisions/`.

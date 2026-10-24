# 0005 · Gemma for thinking, EmbeddingGemma for clustering

**Status:** Accepted (2026-10-24)

## Model: Gemma 4 31B via the Gemini API, OpenRouter fallback
- **Model id:** `gemma-4-31b-it`. Google's "Run Gemma with the Gemini API" page lists `gemma-4-31b-it` and `gemma-4-26b-a4b-it`. OpenRouter lists `google/gemma-4-31b-it` (checked against `/api/v1/models` on 2026-10-24).
- **Endpoint:** Google documents Gemma on the **native** `generateContent` API, with system instructions supported. Its OpenAI-compatible page (`/v1beta/openai/chat/completions`) doesn't list Gemma explicitly. So `GEMINI_API_STYLE=native` is the default, and `openai` switches to the compatibility layer once it's confirmed working with a real key.
- **Fallback:** OpenRouter Chat Completions with the same model family. On 429, 5xx or a timeout, the primary gets 3 attempts with exponential backoff and jitter, then the call goes to the fallback (`withFallback`).
- **Structured output:** Gemma on the Gemini API has no documented JSON mode, so prompts state the JSON contract. `generateStructured` pulls the first JSON value out of the reply, validates it with Zod plus semantic checks (budget, known source ids), and feeds errors back to the model, for up to 3 attempts.
- **What Gemma decides (P4):** borderline same-story pairs, ranking, and every chapter script, plus the repair of lines that fail the fact check. The intro and outro are templates, so they can't hallucinate.

## Embeddings: EmbeddingGemma on the worker's CPU
- The Gemini API doesn't serve EmbeddingGemma, so it runs in the worker through **transformers.js 3.8.1** (`onnx-community/embeddinggemma-300m-ONNX`, q8), giving 768-dimension vectors.
- **Measured in the dev container:** about 4.6 s to load the model, then about 1.3 s per document in batches. Same story from different outlets scores about 0.93 cosine similarity; unrelated stories about 0.30.
- **Thresholds:** 0.83 or above is the same story. 0.72–0.83 goes to Gemma to confirm (at most 30 pairs per episode). "Already heard" means 0.85 or above against the user's `heard_items` (a pgvector cosine query).
- kokoro-js needs `@huggingface/transformers` 3.x, so it's pinned to 3.8.1 to keep a single ONNX runtime in the process; two runtimes conflict (`VERS_1.21.0 not found`). transformers.js 3.x imports `onnxruntime-common` without declaring it, so a pnpm `packageExtensions` entry declares it.

## Not done
- No local-model mode in the product (PRD v2).

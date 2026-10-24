import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Embedder } from "./index";

type Tensor = { tolist(): number[][]; dims: number[] };
type Model = (inputs: unknown) => Promise<{ sentence_embedding: Tensor }>;
type Tokenizer = (texts: string[], options: { padding: boolean; truncation: boolean; max_length: number }) => Promise<unknown>;

let loading: Promise<{ tokenizer: Tokenizer; model: Model }> | undefined;

/**
 * EmbeddingGemma (300M, ONNX q8) on CPU via transformers.js, in the worker
 * (ADR 0005). Documents use the model's retrieval prompt format.
 */
export function createEmbeddingGemma(options: { modelId: string; cacheDir?: string; batchSize?: number }): Embedder {
  const batchSize = options.batchSize ?? 16;
  const load = async () => {
    const transformers = await import("@huggingface/transformers");
    transformers.env.cacheDir = options.cacheDir ?? join(tmpdir(), "unread-models");
    const tokenizer = (await transformers.AutoTokenizer.from_pretrained(options.modelId)) as unknown as Tokenizer;
    const model = (await transformers.AutoModel.from_pretrained(options.modelId, { dtype: "q8" })) as unknown as Model;
    return { tokenizer, model };
  };
  return {
    dimensions: 768,
    async embed(inputs) {
      loading ??= load();
      const { tokenizer, model } = await loading;
      const out: number[][] = [];
      for (let i = 0; i < inputs.length; i += batchSize) {
        const batch = inputs
          .slice(i, i + batchSize)
          .map((d) => `title: ${d.title.replace(/\s+/g, " ").slice(0, 200)} | text: ${d.text.replace(/\s+/g, " ").slice(0, 2000)}`);
        const encoded = await tokenizer(batch, { padding: true, truncation: true, max_length: 512 });
        const { sentence_embedding } = await model(encoded);
        out.push(...sentence_embedding.tolist());
      }
      return out;
    },
  };
}

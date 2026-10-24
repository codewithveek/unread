import { workerContext } from "../context";
import { voiceProviderFor } from "@unread/core/voice";

/** Download and load EmbeddingGemma and Kokoro once (run at image build, so cold starts are fast). */
async function main() {
  const ctx = workerContext();
  const started = Date.now();
  await ctx.embedder.embed([{ title: "warm up", text: "Loading EmbeddingGemma." }]);
  await voiceProviderFor("kokoro", ctx.config).synthesize({ text: "Warming up.", voiceId: "af_heart" });
  console.log(`models ready in ${Math.round((Date.now() - started) / 1000)}s at ${ctx.config.env.MODEL_CACHE_DIR}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

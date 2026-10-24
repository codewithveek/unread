import { afterAll, describe, expect, it } from "vitest";
import { createEmbeddingGemma } from "../src/embeddings";
import { processInbound } from "../src/inbound";
import { buildScript, findProblems } from "../src/pipeline";
import { createFakeModel } from "./fake-model";
import { createTestUser, fixture, randomAlias, tempStorage, testDatabaseUrl, testDb } from "./helpers";

const runModels = Boolean(testDatabaseUrl && process.env.RUN_EMBEDDING_TESTS);

/** prd §13 U2 acceptance: script JSON with merged, cited chapters from 3+ newsletters. */
describe.skipIf(!runModels)("pipeline steps 1–6 with real EmbeddingGemma", () => {
  const db = testDb();
  afterAll(async () => {
    await db.$client.end();
  });

  it("merges the OpenAI story across three newsletters into one cited chapter", async () => {
    const alias = randomAlias();
    const user = await createTestUser(db, { alias, email: "lucky@example.com" });
    const storage = tempStorage();
    for (const name of ["newsletter-autoforward.eml", "newsletter-manual-forward.eml", "newsletter-tldr.eml"]) {
      const outcome = await processInbound({
        db,
        storage,
        raw: fixture(`email/${name}`),
        envelopeFrom: "lucky@example.com",
        envelopeTo: `${alias}@in.getunread.site`,
        inboundDomain: "in.getunread.site",
        trustUpstreamAuth: false,
      });
      expect(outcome.status).toBe("issue");
    }

    const model = createFakeModel();
    const result = await buildScript({
      db,
      model,
      embedder: createEmbeddingGemma({ modelId: "onnx-community/embeddinggemma-300m-ONNX" }),
      userId: user.id,
      maxChars: 9000,
      dateLabel: "Saturday, 24 October",
      now: new Date("2026-10-24T12:00:00Z"),
    });

    expect(result.status).toBe("ok");
    const script = result.script;
    if (!script) throw new Error("no script");
    const openai = script.chapters.find((c) => c.sources.length >= 3);
    expect(openai, JSON.stringify(script.chapters.map((c) => [c.title, c.origin]), null, 2)).toBeDefined();
    expect(openai?.origin).toMatch(/also in/);
    expect(new Set(openai?.sources.map((s) => s.label))).toEqual(new Set(["Morning Brew", "The Hustle", "TLDR"]));

    // Every remaining line cites a source and passes the deterministic check.
    const sourceText = new Map(result.clusters.flatMap((c) => c.items.map((i) => [i.id, `${i.title}\n${i.text}`] as const)));
    expect(findProblems(script, sourceText)).toEqual([]);
    expect(script.chapters.flatMap((c) => c.lines).every((l) => l.sourceIds.length > 0)).toBe(true);
    expect(script.intro[1]?.text).toMatch(/Morning Brew|The Hustle|TLDR/);
    expect(JSON.stringify(script)).not.toMatch(/DataCo|Acme Bank/);
    expect(result.stats.merged).toBeGreaterThanOrEqual(1);
  }, 180_000);
});

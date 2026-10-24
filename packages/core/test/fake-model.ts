import type { CompletionRequest, CompletionResult, ModelClient } from "../src/model";

/**
 * Deterministic stand-in for Gemma in tests: ranks in input order, confirms no
 * borderline pairs, and "writes" chapters from the sources' first sentences.
 */
export function createFakeModel(overrides: { writer?: (prompt: string) => string } = {}): ModelClient & { calls: CompletionRequest[] } {
  const calls: CompletionRequest[] = [];
  const reply = (text: string): CompletionResult => ({ text, model: "fake", inputTokens: 0, outputTokens: 0 });
  return {
    name: "fake",
    calls,
    async complete(request) {
      calls.push(request);
      if (request.system.includes("editor of Unread")) {
        const keys = Array.from(request.prompt.matchAll(/^(K\d+):/gm), (m) => m[1]);
        return reply(JSON.stringify({ order: keys }));
      }
      if (request.system.includes("SAME news story")) return reply(JSON.stringify({ same: [] }));
      if (request.prompt.includes("failed a fact check")) return reply(JSON.stringify({ line: null }));
      if (overrides.writer) return reply(overrides.writer(request.prompt));
      const sources = Array.from(request.prompt.matchAll(/\[(S\d+)\] ([^\n]+?) — "([^"]*)"\n([^\n]+)/g));
      const names = sources.map((s) => s[2]);
      const lines = sources.map((s) => ({
        text: (s[4] ?? "").split(/(?<=\.)\s/)[0]?.split(" ").slice(0, 28).join(" ") ?? "",
        sourceIds: [s[1]],
      }));
      if (names.length > 1) lines.unshift({ text: `${names.join(" and ")} both covered this.`, sourceIds: sources.map((s) => s[1] ?? "") });
      return reply(JSON.stringify({ title: sources[0]?.[3]?.slice(0, 60) ?? "Story", lines }));
    },
  };
}

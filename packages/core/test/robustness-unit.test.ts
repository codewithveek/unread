import { describe, expect, it } from "vitest";
import { withRetry } from "../src/episodes/make-episode";
import { mapLimit, spokenTitle } from "../src/episodes/steps";
import { cleanHeadline } from "../src/pipeline/script";
import { VoiceNotConfiguredError } from "../src/voice/voice-provider";
import { splitForSpeech } from "../src/voice/split-text";

describe("splitForSpeech", () => {
  it("keeps short lines whole", () => {
    expect(splitForSpeech("  Short line.  ")).toEqual(["Short line."]);
    expect(splitForSpeech("")).toEqual([]);
  });

  it("splits long lines at sentence ends and keeps every word", () => {
    const text = Array.from({ length: 12 }, (_, i) => `Sentence number ${i} talks about something rather important today.`).join(" ");
    const chunks = splitForSpeech(text, 120);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 120)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
    expect(chunks.every((c) => c.endsWith("."))).toBe(true);
  });

  it("falls back to commas, then spaces, for one very long sentence", () => {
    const text = `${"alpha beta gamma, ".repeat(20)}end`;
    const chunks = splitForSpeech(text, 60);
    expect(chunks.every((c) => c.length <= 60)).toBe(true);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " "));
    const words = "word ".repeat(80).trim();
    expect(splitForSpeech(words, 50).every((c) => c.length <= 50)).toBe(true);
  });
});

describe("cleanHeadline", () => {
  it("drops reading times and sponsor tags", () => {
    expect(cleanHeadline("Rust in the Linux kernel passes a milestone (6 minute read)")).toBe("Rust in the Linux kernel passes a milestone");
    expect(cleanHeadline("Big news [5 min read]")).toBe("Big news");
    expect(cleanHeadline("Cheaper GPUs (Sponsored)")).toBe("Cheaper GPUs");
    expect(cleanHeadline("Sponsored: Try our app")).toBe("Try our app");
    expect(cleanHeadline("Why it matters | 4 min read")).toBe("Why it matters");
  });

  it("leaves normal titles alone", () => {
    expect(cleanHeadline("OpenAI cuts the price of reasoning")).toBe("OpenAI cuts the price of reasoning");
    expect(cleanHeadline("The 5-minute rule (explained)")).toBe("The 5-minute rule (explained)");
  });
});

describe("spokenTitle", () => {
  it("ends with exactly one sentence mark", () => {
    expect(spokenTitle("Rust ships")).toBe("Rust ships.");
    expect(spokenTitle("Is it over?")).toBe("Is it over?");
    expect(spokenTitle("Done.")).toBe("Done.");
  });
});

describe("mapLimit", () => {
  it("keeps order and respects the limit", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBe(2);
  });

  it("starts no new work after a failure", async () => {
    const started: number[] = [];
    await expect(
      mapLimit([0, 1, 2, 3, 4, 5, 6, 7], 2, async (n) => {
        started.push(n);
        await new Promise((r) => setTimeout(r, 5));
        if (n === 1) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow("boom");
    await new Promise((r) => setTimeout(r, 30));
    expect(started.length).toBeLessThanOrEqual(3);
  });
});

describe("withRetry", () => {
  it("retries transient errors, then succeeds", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error("flaky");
        return "ok";
      },
      { attempts: 3, initialDelayMs: 1 },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("gives up after the last attempt and never retries missing config", async () => {
    let calls = 0;
    await expect(withRetry(async () => (calls++, Promise.reject(new Error("down"))), { attempts: 2, initialDelayMs: 1 })).rejects.toThrow("down");
    expect(calls).toBe(2);
    calls = 0;
    await expect(
      withRetry(async () => (calls++, Promise.reject(new VoiceNotConfiguredError("no key"))), { attempts: 3, initialDelayMs: 1 }),
    ).rejects.toThrow("no key");
    expect(calls).toBe(1);
  });
});

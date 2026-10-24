import { describe, expect, it } from "vitest";
import { z } from "zod";
import { extractJson, generateStructured, type ModelClient } from "../src/model";
import { checkLine, fitBudget, numbersIn, planEpisode, quotesIn, type Cluster, type EpisodeScript } from "../src/pipeline";
import { effectivePlan, episodeBudget } from "../src/plans";

describe("structured output", () => {
  it("pulls JSON from fenced or chatty replies", () => {
    expect(extractJson('Sure!\n```json\n{"a": [1, "}"]}\n```')).toEqual({ a: [1, "}"] });
    expect(extractJson('Here: {"order": ["K1"]} hope that helps')).toEqual({ order: ["K1"] });
  });

  it("feeds validation errors back and retries", async () => {
    const replies = ['{"n": "one"}', '{"n": 2}'];
    const prompts: string[] = [];
    const client: ModelClient = {
      name: "t",
      async complete(r) {
        prompts.push(r.prompt);
        return { text: replies.shift() ?? "", model: "t", inputTokens: 0, outputTokens: 0 };
      },
    };
    const value = await generateStructured({ client, system: "s", prompt: "p", schema: z.object({ n: z.number() }) });
    expect(value).toEqual({ n: 2 });
    expect(prompts[1]).toContain("previous reply was rejected");
  });
});

describe("script check", () => {
  const sources = new Map([["i1", 'OpenAI cut prices by 60% to $2 per million tokens. Altman said it "changes the economics of agents".']]);
  const allowed = new Set(["i1"]);

  it("passes supported numbers and quotes", () => {
    expect(numbersIn("$1,200.50 and 60%")).toEqual(["1200.50", "60"]);
    expect(quotesIn('He said "changes the economics of agents" today')).toEqual(["changes the economics of agents"]);
    expect(checkLine({ text: 'Prices fell 60%, to $2 per million tokens, which "changes the economics of agents".', sourceIds: ["i1"] }, allowed, sources)).toEqual([]);
  });

  it("flags invented numbers, invented quotes, missing citations and long lines", () => {
    expect(checkLine({ text: "Prices fell 70%.", sourceIds: ["i1"] }, allowed, sources)).toEqual(["number 70 is not in the cited sources"]);
    expect(checkLine({ text: 'He called it "a total game changer for everyone".', sourceIds: ["i1"] }, allowed, sources)[0]).toMatch(/quote/);
    expect(checkLine({ text: "Prices fell.", sourceIds: ["other"] }, allowed, sources)).toEqual(["cites no valid source"]);
    expect(checkLine({ text: Array(31).fill("word").join(" "), sourceIds: ["i1"] }, allowed, sources)[0]).toMatch(/31 words/);
  });

  it("trims to the character budget without emptying chapters", () => {
    const line = { text: "x".repeat(99), sourceIds: ["i1"] };
    const script: EpisodeScript = {
      title: "t",
      intro: [],
      outro: [],
      chapters: [
        { clusterKey: "a", title: "A", origin: "", sources: [], lines: Array(6).fill(line) },
        { clusterKey: "b", title: "B", origin: "", sources: [], lines: Array(3).fill(line) },
      ],
    };
    const fitted = fitBudget(script, 500);
    expect(fitted.chapters.every((c) => c.lines.length >= 2)).toBe(true);
    expect(fitted.chapters.reduce((s, c) => s + c.lines.length, 0)).toBeLessThan(9);
  });
});

describe("plans and budgets", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const redemption = {
    id: "r1", codeId: "c", userId: "u", redeemedAt: now, trialEndsAt: new Date("2026-11-07T00:00:00Z"),
    episodeLimit: 3, episodesUsed: 1, endedAt: null, endedReason: null, remindersSent: [],
  };
  const subscription = {
    id: "s", userId: "u", bachsCustomerId: "cust_1", bachsSubscriptionId: "sub_1", productId: "prod_1",
    status: "cancelled" as const, currentPeriodEnd: new Date("2026-10-30T00:00:00Z"), cancelAtPeriodEnd: true, updatedAt: now,
  };

  it("paid Plus wins, then a live trial, then Free", () => {
    expect(effectivePlan({ subscriptions: [subscription], redemptions: [redemption], now }).source).toBe("paid");
    const trial = effectivePlan({ subscriptions: [], redemptions: [redemption], now });
    expect(trial).toMatchObject({ plan: "plus", source: "trial", voiceProvider: "elevenlabs", trial: { episodesLeft: 2 } });
    expect(effectivePlan({ subscriptions: [], redemptions: [{ ...redemption, episodesUsed: 3 }], now }).source).toBe("free");
    expect(effectivePlan({ subscriptions: [{ ...subscription, currentPeriodEnd: new Date("2026-10-01") }], redemptions: [], now }).voiceProvider).toBe("kokoro");
  });

  it("budgets by plan", () => {
    const free = effectivePlan({ subscriptions: [], redemptions: [], now });
    expect(episodeBudget({ plan: free, episodeMinutes: 20, charactersUsedThisMonth: 0, episodesMadeThisMonth: 0 })).toMatchObject({ minutes: 10, maxChars: 9000, blocked: null });
    expect(episodeBudget({ plan: free, episodeMinutes: 10, charactersUsedThisMonth: 0, episodesMadeThisMonth: 4 }).blocked).toMatch(/4 episodes/);
    const plus = effectivePlan({ subscriptions: [{ ...subscription, status: "active" }], redemptions: [], now });
    expect(episodeBudget({ plan: plus, episodeMinutes: 20, charactersUsedThisMonth: 345_000, episodesMadeThisMonth: 9 })).toMatchObject({ maxChars: 5000, blocked: null });
  });
});

describe("planEpisode", () => {
  const candidate = (id: string, priority: Cluster["priority"], text = "word ".repeat(600)) => ({
    id, sourceKind: "newsletter" as const, title: id, text, url: null, links: [], newsletterId: null, sourceLabel: id,
    priority, topicLabel: null, publishedAt: new Date(), limited: false, embedding: null,
  });
  const cluster = (id: string, priority: Cluster["priority"]): Cluster => ({ key: id, priority, items: [candidate(id, priority)] });

  it("puts 'always' first, 'only if room' last, and stops at the budget", async () => {
    const plan = await planEpisode({
      model: null,
      clusters: [cluster("roomy", "if_room"), cluster("normal", "normal"), cluster("first", "always")],
      maxChars: 2200,
      now: new Date(),
    });
    expect(plan.chapters.map((c) => c.clusterKey)).toEqual(["first", "normal"]);
    expect(plan.chapters.reduce((s, c) => s + c.targetChars, 0)).toBeLessThanOrEqual(2200);
  });
});

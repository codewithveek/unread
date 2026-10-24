import { fileURLToPath } from "node:url";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Activities } from "./activities";
import { makeEpisodeWorkflow } from "./workflows";

const runTemporal = Boolean(process.env.RUN_TEMPORAL_TESTS);

describe.skipIf(!runTemporal)("makeEpisodeWorkflow", () => {
  let env: TestWorkflowEnvironment;
  beforeAll(async () => {
    env = await TestWorkflowEnvironment.createTimeSkipping();
  }, 120_000);
  afterAll(async () => {
    await env?.teardown();
  });

  const run = async (activities: Partial<Activities>) => {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue: "test",
      workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
      activities,
    });
    return worker.runUntil(env.client.workflow.execute(makeEpisodeWorkflow, { args: ["req1"], workflowId: `wf-${Math.random()}`, taskQueue: "test" }));
  };

  it("runs every step in order and retries a flaky voice step", async () => {
    const calls: string[] = [];
    let voiceAttempts = 0;
    const result = await run({
      startEpisode: async () => (calls.push("start"), { status: "started" as const, episodeId: "ep1" }),
      prepareScript: async () => (calls.push("script"), { status: "ok" as const }),
      voiceEpisode: async () => {
        calls.push("voice");
        if (++voiceAttempts === 1) throw new Error("transient");
      },
      renderEpisodeCover: async () => void calls.push("cover"),
      publishEpisode: async () => void calls.push("publish"),
      failEpisode: async () => void calls.push("fail"),
    });
    expect(result).toBe("ready: ep1");
    expect(calls).toEqual(["start", "script", "voice", "voice", "cover", "publish"]);
  }, 120_000);

  it("skips without publishing when there's not enough content", async () => {
    const calls: string[] = [];
    const result = await run({
      startEpisode: async () => ({ status: "started" as const, episodeId: "ep2" }),
      prepareScript: async () => ({ status: "skipped" as const, message: "Not enough new content yet" }),
      publishEpisode: async () => void calls.push("publish"),
    });
    expect(result).toMatch(/^skipped/);
    expect(calls).toEqual([]);
  }, 120_000);
});

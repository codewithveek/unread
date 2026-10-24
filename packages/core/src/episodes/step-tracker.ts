import { type Database, type PipelineStep, schema } from "@unread/db";
import { and, eq, sql } from "drizzle-orm";

/** Records step_runs (attempt-numbered) and the episode's current step for progress UI. */
export async function trackStep<T>(options: {
  db: Database;
  episodeId: string;
  step: PipelineStep;
  run: () => Promise<T>;
  outputRef?: string;
}): Promise<T> {
  const { db, episodeId, step } = options;
  const startedAt = new Date();
  await db.update(schema.episodes).set({ currentStep: step }).where(eq(schema.episodes.id, episodeId));
  const [{ attempt } = { attempt: 1 }] = await db
    .select({ attempt: sql<number>`coalesce(max(${schema.stepRuns.attempt}), 0)::int + 1` })
    .from(schema.stepRuns)
    .where(and(eq(schema.stepRuns.episodeId, episodeId), eq(schema.stepRuns.step, step)));
  const [run] = await db
    .insert(schema.stepRuns)
    .values({ episodeId, step, attempt, status: "running", timings: { startedAt: startedAt.toISOString() } })
    .returning({ id: schema.stepRuns.id });
  try {
    const result = await options.run();
    const finishedAt = new Date();
    if (run) {
      await db
        .update(schema.stepRuns)
        .set({
          status: "succeeded",
          outputRef: options.outputRef,
          timings: { startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), ms: finishedAt.getTime() - startedAt.getTime() },
        })
        .where(eq(schema.stepRuns.id, run.id));
    }
    return result;
  } catch (error) {
    if (run) {
      await db
        .update(schema.stepRuns)
        .set({ status: "failed", timings: { startedAt: startedAt.toISOString(), error: String(error).slice(0, 500) } })
        .where(eq(schema.stepRuns.id, run.id));
    }
    throw error;
  }
}

/** For steps done inside one call (collect..check): record what already happened. */
export async function recordSteps(options: { db: Database; episodeId: string; timingsMs: Record<string, number> }) {
  const map: Record<string, PipelineStep> = { collect: "collect", cluster: "cluster", plan: "plan", script: "script", check: "check" };
  const rows = Object.entries(options.timingsMs).flatMap(([name, ms]) =>
    map[name] ? [{ episodeId: options.episodeId, step: map[name] as PipelineStep, status: "succeeded" as const, attempt: 1, timings: { ms } }] : [],
  );
  if (rows.length) await options.db.insert(schema.stepRuns).values(rows).onConflictDoNothing();
}

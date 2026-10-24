import { fileURLToPath } from "node:url";
import { ScheduleOverlapPolicy } from "@temporalio/client";
import { NativeConnection, Worker } from "@temporalio/worker";
import { workerContext } from "../context";
import { activities } from "./activities";
import { temporalClient, temporalConnectionOptions } from "./connection";

/** Idempotently create the dispatch (every 10 min) and maintenance (hourly) schedules. */
async function ensureSchedules() {
  const { config } = workerContext();
  const client = await temporalClient(config);
  const taskQueue = config.env.TEMPORAL_TASK_QUEUE;
  const schedules = [
    { id: "unread-dispatch", workflowType: "dispatchWorkflow", every: "10m" },
    { id: "unread-maintenance", workflowType: "maintenanceWorkflow", every: "1h" },
  ];
  for (const s of schedules) {
    try {
      await client.schedule.create({
        scheduleId: s.id,
        spec: { intervals: [{ every: s.every }] },
        action: { type: "startWorkflow", workflowType: s.workflowType, taskQueue, args: [] },
        policies: { overlap: ScheduleOverlapPolicy.SKIP },
      });
      console.log(`created schedule ${s.id}`);
    } catch (error) {
      if (!(error instanceof Error) || !/already/i.test(error.message)) throw error;
    }
  }
}

export async function runTemporalWorker(): Promise<void> {
  const { config } = workerContext();
  const connection = await NativeConnection.connect(await temporalConnectionOptions(config));
  await ensureSchedules();
  const worker = await Worker.create({
    connection,
    namespace: config.env.TEMPORAL_NAMESPACE,
    taskQueue: config.env.TEMPORAL_TASK_QUEUE,
    workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
    activities,
    // Kokoro is CPU-bound; one voicing job at a time per worker keeps RAM predictable.
    maxConcurrentActivityTaskExecutions: 2,
  });
  console.log(`Temporal worker on ${config.env.TEMPORAL_ADDRESS} / ${config.env.TEMPORAL_TASK_QUEUE}`);
  await worker.run();
}

import { ApplicationFailure, ParentClosePolicy, proxyActivities, startChild, WorkflowIdReusePolicy } from "@temporalio/workflow";
import type { Activities } from "./activities";

const quick = proxyActivities<Activities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 5, initialInterval: "5 seconds", backoffCoefficient: 2 },
});
const thinking = proxyActivities<Activities>({
  startToCloseTimeout: "10 minutes",
  retry: { maximumAttempts: 3, initialInterval: "30 seconds", backoffCoefficient: 2 },
});
const voicing = proxyActivities<Activities>({
  startToCloseTimeout: "30 minutes",
  heartbeatTimeout: "2 minutes",
  retry: { maximumAttempts: 3, initialInterval: "30 seconds", backoffCoefficient: 2 },
});

export const episodeWorkflowId = (requestId: string) => `episode-request-${requestId}`;

/** `make-episode` (prd §6): durable, retried per step, failure recorded for the user. */
export async function makeEpisodeWorkflow(requestId: string): Promise<string> {
  const started = await quick.startEpisode(requestId);
  if (started.status === "skipped") return `skipped: ${started.message}`;
  const { episodeId } = started;
  try {
    const prepared = await thinking.prepareScript(episodeId);
    if (prepared.status === "skipped") return `skipped: ${prepared.message}`;
    await voicing.voiceEpisode(episodeId);
    await quick.renderEpisodeCover(episodeId);
    await quick.publishEpisode(episodeId);
    return `ready: ${episodeId}`;
  } catch (error) {
    const message = error instanceof Error ? (error.cause instanceof Error ? error.cause.message : error.message) : String(error);
    await quick.failEpisode(episodeId, message);
    throw ApplicationFailure.nonRetryable(message);
  }
}

/** Runs every 10 minutes from a Temporal Schedule: starts one child workflow per due request. */
export async function dispatchWorkflow(): Promise<number> {
  const requestIds = await quick.dispatch();
  let started = 0;
  for (const requestId of requestIds) {
    try {
      await startChild(makeEpisodeWorkflow, {
        args: [requestId],
        workflowId: episodeWorkflowId(requestId),
        workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE,
        parentClosePolicy: ParentClosePolicy.ABANDON,
      });
      started++;
    } catch {
      // Already running or done for this request.
    }
  }
  return started;
}

export async function maintenanceWorkflow(): Promise<void> {
  await quick.maintenance();
}

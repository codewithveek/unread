import "server-only";
import { Client, Connection } from "@temporalio/client";
import { serverEnv } from "@/lib/env";

let client: Promise<Client> | undefined;

/**
 * Kick off the durable workflow for a request right away. Without Temporal
 * (or if it's unreachable) the worker's poller/dispatcher picks the request up.
 */
export async function startEpisodeWorkflow(requestId: string): Promise<void> {
  const env = serverEnv();
  if (!env.TEMPORAL_ADDRESS) return;
  try {
    client ??= Connection.connect({
      address: env.TEMPORAL_ADDRESS,
      ...(env.TEMPORAL_API_KEY ? { tls: true, apiKey: env.TEMPORAL_API_KEY, metadata: { "temporal-namespace": env.TEMPORAL_NAMESPACE } } : {}),
    }).then((connection) => new Client({ connection, namespace: env.TEMPORAL_NAMESPACE }));
    await (await client).workflow.start("makeEpisodeWorkflow", {
      args: [requestId],
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId: `episode-request-${requestId}`,
    });
  } catch (error) {
    client = undefined;
    console.error("Could not start workflow; the dispatcher will pick it up", error);
  }
}

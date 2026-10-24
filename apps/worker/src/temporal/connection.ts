import { Client, Connection } from "@temporalio/client";
import type { CoreConfig } from "@unread/core/config";

/** Temporal Cloud (API key + TLS) or a self-hosted/dev server. */
export async function temporalConnectionOptions(config: CoreConfig) {
  const env = config.env;
  if (!env.TEMPORAL_ADDRESS) throw new Error("TEMPORAL_ADDRESS not set");
  return {
    address: env.TEMPORAL_ADDRESS,
    ...(env.TEMPORAL_API_KEY ? { tls: true, apiKey: env.TEMPORAL_API_KEY, metadata: { "temporal-namespace": env.TEMPORAL_NAMESPACE } } : {}),
  };
}

export async function temporalClient(config: CoreConfig): Promise<Client> {
  const connection = await Connection.connect(await temporalConnectionOptions(config));
  return new Client({ connection, namespace: config.env.TEMPORAL_NAMESPACE });
}

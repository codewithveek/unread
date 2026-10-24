import { relay, type RelayEnv } from "./relay";

export default {
  async email(message: ForwardableEmailMessage, env: RelayEnv): Promise<void> {
    const result = await relay(message, env);
    console.log(JSON.stringify({ event: "inbound", result, size: message.rawSize }));
  },
} satisfies ExportedHandler<RelayEnv>;

import {
  AssistantConnectionSchema,
  createEnvelope,
  type AssistantApi
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";
async function connect(type: "assistant.start" | "assistant.restart") {
  const id = browserId("cmd_assistant");
  return AssistantConnectionSchema.parse(
    await invokeCommand(createEnvelope(type, {}, { id, correlationId: id }))
  );
}
export const assistantApi: AssistantApi = {
  start: () => connect("assistant.start"),
  restart: () => connect("assistant.restart"),
  async openConfiguration() {
    const id = browserId("cmd_assistant_config");
    await invokeCommand(
      createEnvelope(
        "assistant.openConfiguration",
        {},
        { id, correlationId: id }
      )
    );
  }
};

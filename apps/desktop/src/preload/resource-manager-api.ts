import {
  ResourceManagerRequestSchema,
  ResourceManagerResultSchema,
  createEnvelope,
  type ResourceManagerApi
} from "@deepwrite/contracts";
import { webUtils } from "electron";
import { browserId, invokeCommand } from "./invoke";
export const resourceManagerApi: ResourceManagerApi = {
  async execute(raw) {
    const id = browserId("cmd_resource_manager");
    return ResourceManagerResultSchema.parse(
      await invokeCommand(
        createEnvelope(
          "resourceManager.execute",
          ResourceManagerRequestSchema.parse(raw),
          { id, correlationId: id }
        )
      )
    );
  },
  droppedFilePath(file) {
    return webUtils.getPathForFile(file);
  }
};

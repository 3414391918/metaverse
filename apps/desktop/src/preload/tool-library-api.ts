import {
  createEnvelope,
  ToolCreateSchema,
  ToolFileSaveSchema,
  ToolFileSnapshotSchema,
  ToolFileTargetSchema,
  ToolIdSchema,
  ToolLibrarySnapshotSchema,
  type ToolLibraryApi
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";

export const toolLibrary: ToolLibraryApi = {
  async list() {
    const id = browserId("cmd_tool_list");
    return ToolLibrarySnapshotSchema.parse(
      await invokeCommand(createEnvelope("toolLibrary.list", {}, { id }))
    );
  },
  async read(input) {
    const id = browserId("cmd_tool_read");
    return ToolFileSnapshotSchema.parse(
      await invokeCommand(
        createEnvelope("toolLibrary.read", ToolFileTargetSchema.parse(input), {
          id
        })
      )
    );
  },
  async save(input) {
    const id = browserId("cmd_tool_save");
    return ToolFileSnapshotSchema.parse(
      await invokeCommand(
        createEnvelope("toolLibrary.save", ToolFileSaveSchema.parse(input), {
          id
        })
      )
    );
  },
  async create(input) {
    const id = browserId("cmd_tool_create");
    return ToolLibrarySnapshotSchema.parse(
      await invokeCommand(
        createEnvelope("toolLibrary.create", ToolCreateSchema.parse(input), {
          id
        })
      )
    );
  },
  async delete(toolId) {
    const id = browserId("cmd_tool_delete");
    return ToolLibrarySnapshotSchema.parse(
      await invokeCommand(
        createEnvelope(
          "toolLibrary.delete",
          { id: ToolIdSchema.parse(toolId) },
          { id }
        )
      )
    );
  }
};

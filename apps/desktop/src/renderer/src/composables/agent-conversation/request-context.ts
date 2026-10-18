import type {
  DeepWriteApi,
  WorkspaceRuntimeContext
} from "@deepwrite/contracts";
import { LibraryAgentWorkspaceSnapshotSchema } from "@deepwrite/contracts/renderer";
import type { WorkspaceDocument } from "../../types/workspace";
import type { WorkspaceContextAttachments } from "./types";
import type { AgentConversationContext } from "./context";
type Context = Pick<
  AgentConversationContext,
  "epoch" | "sessionId" | "options"
>;
type RequestContext =
  { contextSnapshot: WorkspaceRuntimeContext | undefined } | undefined;
export function preparePromptContext(
  _ctx: Context,
  _api: DeepWriteApi,
  activeDocument: WorkspaceDocument | null,
  _workspaceDocuments: WorkspaceDocument[],
  attachments: WorkspaceContextAttachments,
  contextOverride: WorkspaceRuntimeContext | undefined,
  mode: "workspace" | "chat-assistant",
  _sendEpoch: number,
  _sendSessionId: string
): RequestContext | Promise<RequestContext> {
  const originalLength = activeDocument?.content.length ?? 0;
  if (
    mode === "workspace" &&
    activeDocument?.domain === "creation" &&
    !contextOverride
  ) {
    throw new Error("请选择小说创作空间后再发送");
  }
  const snapshotContent = activeDocument?.content.slice(0, 20000) ?? "";
  const contextSnapshot: WorkspaceRuntimeContext | undefined =
    mode === "chat-assistant"
      ? undefined
      : (contextOverride ??
        (activeDocument
          ? {
              activeResource: {
                id: activeDocument.id,
                domain: activeDocument.domain,
                title: activeDocument.title,
                path: [...activeDocument.path],
                ...(activeDocument.format
                  ? { format: activeDocument.format }
                  : {}),
                source: "live-editor" as const,
                content: snapshotContent,
                ...(originalLength > snapshotContent.length
                  ? { truncated: true as const, originalLength }
                  : {})
              }
            }
          : undefined));
  if (contextSnapshot && attachments.attachedSkills?.length) {
    contextSnapshot.attachedSkills = attachments.attachedSkills.map(
      (skill) => ({
        ...skill
      })
    );
  }
  if (contextSnapshot && attachments.attachedMaterials?.length) {
    contextSnapshot.attachedMaterials = attachments.attachedMaterials.map(
      (material) => ({
        ...material
      })
    );
  }
  if (!contextOverride && attachments.libraryWorkspace) {
    if (!contextSnapshot) return;
    contextSnapshot.libraryWorkspace =
      LibraryAgentWorkspaceSnapshotSchema.parse(attachments.libraryWorkspace);
  }

  return { contextSnapshot };
}

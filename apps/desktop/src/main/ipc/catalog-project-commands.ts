import {
  CatalogLibraryGroupSchema,
  CatalogLibrarySchema,
  CatalogOpenProjectResultSchema,
  CommandEnvelopeSchema,
  createEnvelope,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import { LEGACY_LIBRARY_FILE_SELECTION_PROPERTIES } from "../legacy-library-import-batch";
import type { IpcCommandContext } from "./command-types";
import { safeErrorDetails } from "./errors";
export type CatalogProjectCommandContext = Pick<
  IpcCommandContext,
  | "requireSelectedWorkspaceDirectory"
  | "workspaceGroupParent"
  | "workspaceResourceParent"
  | "dialog"
  | "importLegacyLibraryArchives"
  | "supervisor"
>;
export async function handleCatalogProjectCommands(
  ctx: CatalogProjectCommandContext,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (
    command.type === "catalog.createLibrary" ||
    command.type === "catalog.createLibraryGroup" ||
    command.type === "catalog.openProject" ||
    command.type === "catalog.importLegacyLibrary"
  ) {
    try {
      const workspaceDirectory = await ctx.requireSelectedWorkspaceDirectory();
      if (!workspaceDirectory) {
        return {
          status: "accepted",
          requestId: command.id,
          payload: null
        };
      }
      const domain = command.payload.domain;
      const defaultPath =
        command.type === "catalog.createLibraryGroup"
          ? ctx.workspaceGroupParent(workspaceDirectory, command.payload.domain)
          : ctx.workspaceResourceParent(workspaceDirectory, domain);
      let selectedPaths: string[];
      if (
        command.type === "catalog.createLibrary" ||
        command.type === "catalog.createLibraryGroup"
      ) {
        selectedPaths = [defaultPath];
      } else {
        const selection = await ctx.dialog.showOpenDialog({
          title:
            command.type === "catalog.importLegacyLibrary"
              ? `导入旧版${domain === "material" ? "素材" : "技能"}库压缩包`
              : domain === "book"
                ? "打开已有书籍"
                : domain === "material"
                  ? "打开已有素材库"
                  : "打开已有技能库",
          defaultPath,
          ...(command.type === "catalog.importLegacyLibrary"
            ? {
                properties: LEGACY_LIBRARY_FILE_SELECTION_PROPERTIES,
                filters: [
                  {
                    name: `旧版${domain === "material" ? "素材" : "技能"}库压缩包`,
                    extensions: ["zip"]
                  }
                ]
              }
            : { properties: ["openDirectory"] as const })
        });
        if (selection.canceled || selection.filePaths.length === 0) {
          return {
            status: "accepted",
            requestId: command.id,
            payload: null
          };
        }
        selectedPaths = selection.filePaths;
      }
      const selectedPath = selectedPaths[0]!;
      const internalCommand = CommandEnvelopeSchema.parse(
        command.type === "catalog.createLibrary"
          ? createEnvelope(
              "catalog.createLibraryAtPath",
              {
                ...command.payload,
                parentDirectory: selectedPath
              },
              { id: command.id, context: command.context }
            )
          : command.type === "catalog.createLibraryGroup"
            ? createEnvelope(
                "catalog.createLibraryGroupAtPath",
                {
                  parentDirectory: selectedPath,
                  input: command.payload
                },
                { id: command.id, context: command.context }
              )
            : command.type === "catalog.openProject"
              ? createEnvelope(
                  "catalog.openProjectAtPath",
                  {
                    projectDirectory: selectedPath,
                    domain: command.payload.domain
                  },
                  { id: command.id, context: command.context }
                )
              : createEnvelope(
                  "catalog.importLegacyLibraryAtPath",
                  {
                    domain: command.payload.domain,
                    archivePath: selectedPath,
                    parentDirectory: defaultPath
                  },
                  { id: command.id, context: command.context }
                )
      );
      if (command.type === "catalog.importLegacyLibrary") {
        const payload = await ctx.importLegacyLibraryArchives(
          selectedPaths,
          async (archivePath, index) => {
            const result = await ctx.supervisor.requestCommand(
              "core",
              createEnvelope(
                "catalog.importLegacyLibraryAtPath",
                {
                  domain: command.payload.domain,
                  archivePath,
                  parentDirectory: defaultPath
                },
                {
                  id: `${command.id}_${index + 1}`,
                  context: command.context
                }
              ),
              0
            );
            if (result.status === "rejected") {
              throw new Error(result.error.message);
            }
            return result.payload;
          }
        );
        return {
          status: "accepted",
          requestId: command.id,
          payload
        };
      }
      const result = await ctx.supervisor.requestCommand(
        "core",
        internalCommand,
        0
      );
      if (result.status === "rejected") {
        return result;
      }
      const payload =
        command.type === "catalog.createLibrary"
          ? CatalogLibrarySchema.parse(result.payload)
          : command.type === "catalog.createLibraryGroup"
            ? CatalogLibraryGroupSchema.parse(result.payload)
            : command.type === "catalog.openProject"
              ? CatalogOpenProjectResultSchema.parse(result.payload)
              : CatalogLibrarySchema.parse(result.payload);
      return { status: "accepted", requestId: command.id, payload };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "catalog.forward_failed",
          message: error instanceof Error ? error.message : "目录操作失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
}

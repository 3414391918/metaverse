import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";

export const WorkspaceDirectorySettingsSchema = z.object({
  path: z.string().trim().min(1).nullable(),
  previousPath: z.string().trim().min(1).nullable().default(null),
  migrationSourcePath: z.string().trim().min(1).nullable().default(null),
  directories: z.array(z.string().trim().min(1)).default([])
});
export type WorkspaceDirectorySettings = z.infer<
  typeof WorkspaceDirectorySettingsSchema
>;

export const WorkspaceDirectoryListCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceDirectory.list"),
    payload: z.object({})
  });
export const WorkspaceDirectoryChooseCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceDirectory.choose"),
    payload: z.object({})
  });
export const WorkspaceDirectoryRestoreCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceDirectory.restore"),
    payload: z.object({})
  });
export const WorkspaceDirectoryMigrateCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceDirectory.migrate"),
    payload: z.object({})
  });
export const WorkspaceDirectoryAddCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceDirectory.add"),
    payload: z.object({})
  });
export const WorkspaceDirectoryRemoveCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceDirectory.remove"),
    payload: z.object({ path: z.string().trim().min(1) })
  });
export const WorkspaceDirectorySwitchCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceDirectory.switch"),
    payload: z.object({ path: z.string().trim().min(1) })
  });
export const WorkspaceDirectoryMigrateDataCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceDirectory.migrateData"),
    payload: z.object({
      sourcePath: z.string().trim().min(1),
      targetPath: z.string().trim().min(1)
    })
  });

import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";

export const WorkspaceDirectorySettingsSchema = z.object({
  path: z.string().trim().min(1).nullable(),
  previousPath: z.string().trim().min(1).nullable().default(null),
  migrationSourcePath: z.string().trim().min(1).nullable().default(null)
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

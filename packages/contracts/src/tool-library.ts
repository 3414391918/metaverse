import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";

export const ToolIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const ToolFilePathSchema = z
  .string()
  .min(1)
  .max(260)
  .refine(
    (path) =>
      !path.includes("\\") &&
      path
        .split("/")
        .every(
          (part) => part && part !== "." && part !== ".." && !part.includes(":")
        ) &&
      !path.includes("\0"),
    "文件路径必须位于当前工具目录内。"
  );
export const ToolManifestSchema = z
  .object({
    version: z.literal(1),
    id: ToolIdSchema,
    name: z.string().trim().min(1).max(200),
    description: z.string().max(4000),
    entryFile: ToolFilePathSchema,
    relatedToolIds: z
      .array(ToolIdSchema)
      .max(200)
      .refine((ids) => new Set(ids).size === ids.length, "关联工具不能重复。")
  })
  .strict();
export type ToolManifest = z.infer<typeof ToolManifestSchema>;
export const ToolSummarySchema = ToolManifestSchema.extend({
  directory: z.string(),
  files: z.array(
    z
      .object({
        path: ToolFilePathSchema,
        bytes: z.number().int().nonnegative()
      })
      .strict()
  ),
  error: z.string().optional()
});
export type ToolSummary = z.infer<typeof ToolSummarySchema>;
export const ToolLibrarySnapshotSchema = z
  .object({ directory: z.string(), tools: z.array(ToolSummarySchema) })
  .strict();
export type ToolLibrarySnapshot = z.infer<typeof ToolLibrarySnapshotSchema>;
export const ToolFileTargetSchema = z
  .object({ toolId: ToolIdSchema, path: ToolFilePathSchema })
  .strict();
export type ToolFileTarget = z.infer<typeof ToolFileTargetSchema>;
export const ToolFileSnapshotSchema = ToolFileTargetSchema.extend({
  content: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
export type ToolFileSnapshot = z.infer<typeof ToolFileSnapshotSchema>;
export const ToolFileSaveSchema = ToolFileTargetSchema.extend({
  content: z.string().max(4 * 1024 * 1024),
  expectedSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable()
}).strict();
export type ToolFileSave = z.infer<typeof ToolFileSaveSchema>;
export const ToolCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(4000).default("")
  })
  .strict();
export type ToolCreate = z.infer<typeof ToolCreateSchema>;

export const ToolLibraryCommandEnvelopeSchemas = [
  EnvelopeBaseSchema.extend({
    type: z.literal("toolLibrary.list"),
    payload: z.object({}).strict()
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("toolLibrary.read"),
    payload: ToolFileTargetSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("toolLibrary.save"),
    payload: ToolFileSaveSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("toolLibrary.create"),
    payload: ToolCreateSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("toolLibrary.delete"),
    payload: z.object({ id: ToolIdSchema }).strict()
  })
] as const;

export interface ToolLibraryApi {
  list(): Promise<ToolLibrarySnapshot>;
  read(input: ToolFileTarget): Promise<ToolFileSnapshot>;
  save(input: ToolFileSave): Promise<ToolFileSnapshot>;
  create(input: ToolCreate): Promise<ToolLibrarySnapshot>;
  delete(id: string): Promise<ToolLibrarySnapshot>;
}

import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";

export const ResourcePathSchema = z
  .string()
  .max(4096)
  .refine(
    (value) =>
      value === "" ||
      value
        .split("/")
        .every(
          (part) =>
            part !== "" &&
            part !== "." &&
            part !== ".." &&
            !/[\\:\u0000-\u001f]/u.test(part)
        ),
    "资源路径必须是目录内的相对路径。"
  );
const target = ResourcePathSchema.refine(
  (value) => value.length > 0,
  "请选择文件或文件夹。"
);
const targets = z.array(target).min(1).max(500);
const directory = ResourcePathSchema.default("");
export const ResourceManagerRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    directory,
    query: z.string().trim().max(200).default("")
  }),
  z.object({
    action: z.literal("createFolder"),
    directory,
    name: z.string().min(1).max(255)
  }),
  z.object({
    action: z.literal("rename"),
    path: target,
    name: z.string().min(1).max(255)
  }),
  z.object({ action: z.literal("open"), path: target }),
  z.object({ action: z.literal("reveal"), path: ResourcePathSchema }),
  z.object({ action: z.literal("copyPath"), paths: targets }),
  z.object({
    action: z.literal("clipboard"),
    paths: targets,
    mode: z.enum(["copy", "cut"])
  }),
  z.object({ action: z.literal("paste"), directory }),
  z.object({
    action: z.literal("import"),
    directory,
    sourcePaths: z.array(z.string().min(1).max(4096)).max(500).default([])
  }),
  z.object({ action: z.literal("trash"), paths: targets })
]);
export type ResourceManagerRequest = z.infer<
  typeof ResourceManagerRequestSchema
>;
export const ResourceEntrySchema = z.object({
  name: z.string(),
  path: ResourcePathSchema,
  kind: z.enum(["file", "directory"]),
  size: z.number().nonnegative(),
  modifiedAt: z.string()
});
export type ResourceEntry = z.infer<typeof ResourceEntrySchema>;
export const ResourceManagerResultSchema = z.object({
  root: z.string(),
  directory: ResourcePathSchema,
  entries: z.array(ResourceEntrySchema),
  canPaste: z.boolean(),
  clipboardMode: z.enum(["copy", "cut"]).nullable(),
  truncated: z.boolean().default(false),
  message: z.string().optional()
});
export type ResourceManagerResult = z.infer<typeof ResourceManagerResultSchema>;
export const ResourceManagerCommandEnvelopeSchema = EnvelopeBaseSchema.extend({
  type: z.literal("resourceManager.execute"),
  payload: ResourceManagerRequestSchema
});
export interface ResourceManagerApi {
  execute(input: ResourceManagerRequest): Promise<ResourceManagerResult>;
  droppedFilePath(file: File): string;
}

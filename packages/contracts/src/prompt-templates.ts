import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";

const TemplateIdSchema = z.string().trim().min(1).max(128);
const ImageIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);

export const PromptTemplateSchema = z
  .object({
    id: TemplateIdSchema,
    name: z.string().trim().min(1, "请输入模板名称").max(200),
    content: z
      .string()
      .min(1)
      .max(100_000)
      .refine((value) => value.trim().length > 0, "请输入模板内容"),
    imageIds: z.array(ImageIdSchema).max(20).optional()
  })
  .strict()
  .superRefine((template, context) => {
    const ids = template.imageIds ?? [];
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        path: ["imageIds"],
        message: "模板图片不能重复"
      });
  });
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;

export const PromptTemplatesSchema = z
  .array(PromptTemplateSchema)
  .max(200)
  .superRefine((templates, context) => {
    const ids = new Set<string>();
    templates.forEach((template, index) => {
      if (ids.has(template.id))
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: "模板 ID 不能重复"
        });
      ids.add(template.id);
    });
  });

export const PromptTemplateSaveSchema = z
  .object({
    template: PromptTemplateSchema,
    newImages: z
      .array(
        z
          .object({
            id: ImageIdSchema,
            pngDataUrl: z.string().max(14_000_000)
          })
          .strict()
      )
      .max(20)
  })
  .strict();
export type PromptTemplateSave = z.infer<typeof PromptTemplateSaveSchema>;

export const PromptTemplateImageRequestSchema = z
  .object({ templateId: TemplateIdSchema, imageId: ImageIdSchema })
  .strict();
export type PromptTemplateImageRequest = z.infer<
  typeof PromptTemplateImageRequestSchema
>;

export const PromptTemplateImageResultSchema = z
  .object({ pngDataUrl: z.string() })
  .strict();
export type PromptTemplateImageResult = z.infer<
  typeof PromptTemplateImageResultSchema
>;

export const PromptTemplateCopyImageInputSchema = z
  .object({ pngDataUrl: z.string().max(14_000_000) })
  .strict();
export type PromptTemplateCopyImageInput = z.infer<
  typeof PromptTemplateCopyImageInputSchema
>;
export const PromptTemplateCopyImageResultSchema = z
  .object({ copied: z.literal(true) })
  .strict();

export const PromptTemplatesListCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("promptTemplates.list"),
    payload: z.object({}).strict()
  });
export const PromptTemplatesSaveCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("promptTemplates.save"),
    payload: PromptTemplateSaveSchema
  });
export const PromptTemplatesDeleteCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("promptTemplates.delete"),
    payload: z.object({ id: TemplateIdSchema }).strict()
  });
export const PromptTemplatesReadImageCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("promptTemplates.readImage"),
    payload: PromptTemplateImageRequestSchema
  });
export const PromptTemplatesCopyImageCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("promptTemplates.copyImage"),
    payload: PromptTemplateCopyImageInputSchema
  });

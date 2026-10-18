import {
  PromptTemplateCopyImageInputSchema,
  PromptTemplateCopyImageResultSchema,
  PromptTemplateImageRequestSchema,
  PromptTemplateImageResultSchema,
  PromptTemplateSaveSchema,
  PromptTemplatesSchema,
  createEnvelope,
  type PromptTemplate,
  type PromptTemplateCopyImageInput,
  type PromptTemplateImageRequest,
  type PromptTemplateImageResult,
  type PromptTemplateSave
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";

export async function listPromptTemplates(): Promise<PromptTemplate[]> {
  const id = browserId("cmd_prompt_templates_list");
  return PromptTemplatesSchema.parse(
    await invokeCommand<PromptTemplate[]>(
      createEnvelope("promptTemplates.list", {}, { id, correlationId: id })
    )
  );
}

export async function savePromptTemplate(
  rawInput: PromptTemplateSave
): Promise<PromptTemplate[]> {
  const input = PromptTemplateSaveSchema.parse(rawInput);
  const id = browserId("cmd_prompt_templates_save");
  return PromptTemplatesSchema.parse(
    await invokeCommand<PromptTemplate[]>(
      createEnvelope("promptTemplates.save", input, { id, correlationId: id })
    )
  );
}

export async function deletePromptTemplate(
  idToDelete: string
): Promise<PromptTemplate[]> {
  const id = browserId("cmd_prompt_templates_delete");
  return PromptTemplatesSchema.parse(
    await invokeCommand<PromptTemplate[]>(
      createEnvelope(
        "promptTemplates.delete",
        { id: idToDelete },
        {
          id,
          correlationId: id
        }
      )
    )
  );
}

export async function readPromptTemplateImage(
  rawInput: PromptTemplateImageRequest
): Promise<PromptTemplateImageResult> {
  const input = PromptTemplateImageRequestSchema.parse(rawInput);
  const id = browserId("cmd_prompt_templates_read_image");
  return PromptTemplateImageResultSchema.parse(
    await invokeCommand<PromptTemplateImageResult>(
      createEnvelope("promptTemplates.readImage", input, {
        id,
        correlationId: id
      })
    )
  );
}

export async function copyPromptTemplateImage(
  rawInput: PromptTemplateCopyImageInput
): Promise<void> {
  const input = PromptTemplateCopyImageInputSchema.parse(rawInput);
  const id = browserId("cmd_prompt_templates_copy_image");
  PromptTemplateCopyImageResultSchema.parse(
    await invokeCommand(
      createEnvelope("promptTemplates.copyImage", input, {
        id,
        correlationId: id
      })
    )
  );
}

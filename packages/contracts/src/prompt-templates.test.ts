import { describe, expect, it } from "vitest";
import {
  CommandEnvelopeSchema,
  createEnvelope,
  PromptTemplateSchema,
  PromptTemplatesSchema
} from "./index";

describe("prompt template public commands", () => {
  it("accepts independent template saves, deletes and image reads", () => {
    const template = {
      id: "template-one",
      name: "检查人物",
      content: "检查当前人物状态。"
    };
    for (const [type, payload] of [
      ["promptTemplates.save", { template, newImages: [] }],
      ["promptTemplates.delete", { id: template.id }],
      [
        "promptTemplates.readImage",
        { templateId: template.id, imageId: "image-one" }
      ],
      [
        "promptTemplates.copyImage",
        { pngDataUrl: "data:image/png;base64,AA==" }
      ]
    ] as const) {
      expect(
        CommandEnvelopeSchema.parse(
          createEnvelope(type, payload, {
            id: "cmd_template_test"
          })
        ).payload
      ).toEqual(payload);
    }
  });
  it("rejects blank text and duplicate IDs but accepts an intentionally empty list", () => {
    const template = { id: "one", name: "模板", content: "有效内容" };
    expect(
      PromptTemplateSchema.safeParse({ ...template, content: "  " }).success
    ).toBe(false);
    expect(
      PromptTemplateSchema.safeParse({ ...template, name: "  " }).success
    ).toBe(false);
    expect(PromptTemplatesSchema.safeParse([template, template]).success).toBe(
      false
    );
    expect(PromptTemplatesSchema.parse([])).toEqual([]);
  });
});

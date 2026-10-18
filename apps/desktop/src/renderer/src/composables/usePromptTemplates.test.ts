import { describe, expect, it, vi } from "vitest";
import type { DeepWriteApi, PromptTemplate } from "@deepwrite/contracts";
import { usePromptTemplates } from "./usePromptTemplates";

function harness() {
  let saved: PromptTemplate[] = [
    { id: "existing", name: "检查设定", content: "检查现有设定。" }
  ];
  const list = vi.fn(async () => saved);
  const save = vi.fn<DeepWriteApi["promptTemplates"]["save"]>(
    async ({ template }) => {
      saved = [...saved.filter(({ id }) => id !== template.id), template];
      return saved;
    }
  );
  const remove = vi.fn<DeepWriteApi["promptTemplates"]["delete"]>(
    async (id) => {
      saved = saved.filter((item) => item.id !== id);
      return saved;
    }
  );
  const readImage = vi.fn<DeepWriteApi["promptTemplates"]["readImage"]>(
    async () => ({
      pngDataUrl: "data:image/png;base64,AA=="
    })
  );
  const error = vi.fn();
  const warning = vi.fn();
  const success = vi.fn();
  const model = usePromptTemplates({
    api: () => ({ list, save, delete: remove, readImage, copyImage: vi.fn() }),
    error,
    warning,
    success,
    makeId: () => "new-template"
  });
  return { model, list, save, remove, readImage, error, warning, success };
}

describe("standalone prompt template editor", () => {
  it("saves text independently of the agent configuration", async () => {
    const test = harness();
    await test.model.load();
    test.model.open(test.model.templates.value[0]);
    test.model.draft.value!.name = "检查人物";
    test.model.draft.value!.content = "检查人物当前状态。";
    await test.model.save();
    expect(test.save).toHaveBeenCalledWith({
      template: {
        id: "existing",
        name: "检查人物",
        content: "检查人物当前状态。",
        imageIds: []
      },
      newImages: []
    });
    expect(test.model.draft.value).toBeNull();
  });

  it("adds multiple pasted images and can remove one before saving", async () => {
    const test = harness();
    await test.model.load();
    test.model.open();
    test.model.draft.value!.name = "多图";
    test.model.draft.value!.content = "参考图片。";
    test.model.addImage("data:image/png;base64,AA==");
    test.model.addImage("data:image/png;base64,AQ==");
    const ids = [...test.model.draft.value!.imageIds!];
    test.model.removeImage(ids[0]!);
    await test.model.save();
    expect(test.save).toHaveBeenCalledWith({
      template: expect.objectContaining({ imageIds: [ids[1]] }),
      newImages: [{ id: ids[1], pngDataUrl: "data:image/png;base64,AQ==" }]
    });
  });

  it("keeps the editor open when saving fails, and deletes an existing template", async () => {
    const test = harness();
    await test.model.load();
    test.model.open(test.model.templates.value[0]);
    test.model.draft.value!.content = "   ";
    await test.model.save();
    expect(test.warning).toHaveBeenCalled();
    test.model.draft.value!.content = "有效内容";
    test.save.mockRejectedValueOnce(new Error("保存失败"));
    await test.model.save();
    expect(test.error).toHaveBeenCalledWith("保存失败");
    expect(test.model.draft.value).not.toBeNull();
    await test.model.remove();
    expect(test.remove).toHaveBeenCalledWith("existing");
    expect(test.model.templates.value).toEqual([]);
  });
});

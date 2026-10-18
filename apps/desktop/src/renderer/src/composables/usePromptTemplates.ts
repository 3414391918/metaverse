import { computed, ref } from "vue";
import {
  PromptTemplateSchema,
  PromptTemplatesSchema,
  type DeepWriteApi,
  type PromptTemplate
} from "@deepwrite/contracts/renderer";

export function usePromptTemplates(options: {
  api: () => DeepWriteApi["promptTemplates"] | undefined;
  error: (message: string) => unknown;
  warning: (message: string) => unknown;
  success: (message: string) => unknown;
  makeId?: () => string;
}) {
  const templates = ref<PromptTemplate[]>([]);
  const draft = ref<PromptTemplate | null>(null);
  const previews = ref<Record<string, string>>({});
  const newImages = ref<Record<string, string>>({});
  const busy = ref(false);
  const loaded = ref(false);
  const existing = computed(() =>
    Boolean(
      draft.value && templates.value.some(({ id }) => id === draft.value!.id)
    )
  );
  let disposed = false;
  let previewEpoch = 0;

  async function load(): Promise<void> {
    if (busy.value || draft.value || disposed) return;
    busy.value = true;
    try {
      const api = options.api();
      if (!api) throw new Error("提示词模板服务暂不可用。");
      const listed = await api.list();
      if (disposed) return;
      templates.value = PromptTemplatesSchema.parse(listed);
      loaded.value = true;
    } catch (error) {
      if (!disposed)
        options.error(
          error instanceof Error ? error.message : "加载提示词模板失败。"
        );
    } finally {
      busy.value = false;
    }
  }

  function open(template?: PromptTemplate): void {
    if (!loaded.value || busy.value || disposed) return;
    const epoch = ++previewEpoch;
    draft.value = template
      ? { ...template, imageIds: [...(template.imageIds ?? [])] }
      : {
          id: options.makeId?.() ?? `template_${crypto.randomUUID()}`,
          name: "",
          content: "",
          imageIds: []
        };
    previews.value = {};
    newImages.value = {};
    if (!template?.imageIds?.length) return;
    const api = options.api();
    if (!api) return;
    for (const imageId of template.imageIds) {
      void api.readImage({ templateId: template.id, imageId }).then(
        ({ pngDataUrl }) => {
          if (epoch === previewEpoch && !disposed)
            previews.value = { ...previews.value, [imageId]: pngDataUrl };
        },
        (error: unknown) => {
          if (epoch === previewEpoch && !disposed)
            options.error(
              error instanceof Error ? error.message : "读取模板图片失败。"
            );
        }
      );
    }
  }

  function clearDraft(): void {
    previewEpoch++;
    draft.value = null;
    previews.value = {};
    newImages.value = {};
  }
  function close(): void {
    if (!busy.value) clearDraft();
  }

  function addImage(pngDataUrl: string): void {
    if (!draft.value || busy.value) return;
    if (!pngDataUrl.startsWith("data:image/png;base64,")) {
      options.warning("请粘贴 PNG 图片。");
      return;
    }
    const estimatedBytes = (pngDataUrl.length - 22) * 0.75;
    if (estimatedBytes > 10 * 1024 * 1024) {
      options.warning("单张模板图片不能超过 10 MB。");
      return;
    }
    const ids = draft.value.imageIds ?? [];
    if (ids.length >= 20) {
      options.warning("一个模板最多保存 20 张图片。");
      return;
    }
    const id = `image_${crypto.randomUUID()}`;
    draft.value.imageIds = [...ids, id];
    previews.value = { ...previews.value, [id]: pngDataUrl };
    newImages.value = { ...newImages.value, [id]: pngDataUrl };
  }

  function removeImage(id: string): void {
    if (!draft.value || busy.value) return;
    draft.value.imageIds = (draft.value.imageIds ?? []).filter(
      (item) => item !== id
    );
    const { [id]: _preview, ...remainingPreviews } = previews.value;
    const { [id]: _newImage, ...remainingNewImages } = newImages.value;
    previews.value = remainingPreviews;
    newImages.value = remainingNewImages;
  }

  async function save(): Promise<void> {
    if (!draft.value || busy.value || disposed) return;
    const parsed = PromptTemplateSchema.safeParse(draft.value);
    if (!parsed.success) {
      options.warning(
        parsed.error.issues[0]?.message ?? "请填写完整的模板名称和内容。"
      );
      return;
    }
    const api = options.api();
    if (!api) {
      options.error("提示词模板服务暂不可用。");
      return;
    }
    busy.value = true;
    try {
      const saved = await api.save({
        template: parsed.data,
        newImages: (parsed.data.imageIds ?? [])
          .filter((id) => Boolean(newImages.value[id]))
          .map((id) => ({ id, pngDataUrl: newImages.value[id]! }))
      });
      if (disposed) return;
      templates.value = PromptTemplatesSchema.parse(saved);
      clearDraft();
      options.success("模板已保存。");
    } catch (error) {
      if (!disposed)
        options.error(
          error instanceof Error ? error.message : "保存提示词模板失败。"
        );
    } finally {
      busy.value = false;
    }
  }

  async function remove(): Promise<void> {
    const id = draft.value?.id;
    if (!id || !existing.value || busy.value || disposed) return;
    const api = options.api();
    if (!api) {
      options.error("提示词模板服务暂不可用。");
      return;
    }
    busy.value = true;
    try {
      const saved = await api.delete(id);
      if (disposed) return;
      templates.value = PromptTemplatesSchema.parse(saved);
      clearDraft();
      options.success("模板已删除。");
    } catch (error) {
      if (!disposed)
        options.error(
          error instanceof Error ? error.message : "删除提示词模板失败。"
        );
    } finally {
      busy.value = false;
    }
  }

  return {
    templates,
    draft,
    previews,
    busy,
    loaded,
    existing,
    load,
    open,
    close,
    addImage,
    removeImage,
    save,
    remove,
    dispose: () => {
      disposed = true;
      previewEpoch++;
    }
  };
}

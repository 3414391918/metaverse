import { computed, ref, shallowRef } from "vue";
import {
  ToolManifestSchema,
  type ToolFileSnapshot,
  type ToolLibraryApi,
  type ToolLibrarySnapshot
} from "@deepwrite/contracts/renderer";
import { uiMessage } from "../ui-feedback";

const drafts = new Map<string, { file: ToolFileSnapshot; content: string }>();
export function useToolLibrary(api: () => ToolLibraryApi | undefined) {
  const snapshot = shallowRef<ToolLibrarySnapshot | null>(null);
  const file = shallowRef<ToolFileSnapshot | null>(null);
  const content = ref("");
  const busy = ref(false);
  const saving = ref(false);
  let pendingSave: Promise<boolean> | undefined;
  const selectedId = ref<string | null>(null);
  const history = ref<Array<{ id: string; path: string }>>([]);
  const tool = computed(
    () =>
      snapshot.value?.tools.find(({ id }) => id === selectedId.value) ?? null
  );
  const dirty = computed(() =>
    Boolean(file.value && file.value.content !== content.value)
  );
  let disposed = false;
  const service = () => {
    const value = api();
    if (!value) throw new Error("工具管理服务暂不可用。");
    return value;
  };
  const draftKey = (entry: ToolFileSnapshot) =>
    `${snapshot.value?.directory}/${entry.toolId}/${entry.path}`;
  const report = (error: unknown) =>
    uiMessage.error(error instanceof Error ? error.message : "工具操作失败。");
  function edit(value: string) {
    content.value = value;
    if (file.value)
      drafts.set(draftKey(file.value), { file: file.value, content: value });
  }
  async function refresh() {
    if (busy.value || saving.value || disposed) return;
    busy.value = true;
    try {
      snapshot.value = await service().list();
      if (file.value && !dirty.value && tool.value) {
        const latest = await service().read({
          toolId: file.value.toolId,
          path: file.value.path
        });
        file.value = latest;
        content.value = latest.content;
      }
    } catch (error) {
      report(error);
    } finally {
      busy.value = false;
    }
  }
  async function save(): Promise<boolean> {
    while (pendingSave) if (!(await pendingSave)) return false;
    if (!file.value || !dirty.value) return true;
    const current = file.value;
    const nextContent = content.value;
    const key = draftKey(current);
    saving.value = true;
    const task = persist();
    pendingSave = task;
    try {
      return await task;
    } finally {
      if (pendingSave === task) pendingSave = undefined;
      saving.value = false;
    }
    async function persist(): Promise<boolean> {
      try {
        const saved = await service().save({
          toolId: current.toolId,
          path: current.path,
          content: nextContent,
          expectedSha256: current.sha256
        });
        if (file.value === current) {
          file.value = saved;
          if (content.value === nextContent) content.value = saved.content;
          if (content.value !== saved.content) {
            drafts.set(key, { file: saved, content: content.value });
          } else drafts.delete(key);
        } else {
          drafts.delete(key);
        }
        snapshot.value = await service().list();
        return true;
      } catch (error) {
        report(error);
        return false;
      }
    }
  }
  async function open(id: string, path?: string, remember = true) {
    if (busy.value || disposed) return;
    busy.value = true;
    try {
      if (!(await save())) return;
      const target = snapshot.value?.tools.find((item) => item.id === id);
      if (!target) throw new Error("关联工具不存在，请检查 tool.json。");
      const next = await service().read({
        toolId: id,
        path: path ?? target.entryFile
      });
      if (remember && file.value)
        history.value.push({ id: file.value.toolId, path: file.value.path });
      selectedId.value = id;
      const draft = drafts.get(draftKey(next));
      file.value = draft?.file ?? next;
      content.value = draft?.content ?? next.content;
    } catch (error) {
      report(error);
    } finally {
      busy.value = false;
    }
  }
  async function back() {
    const previous = history.value.at(-1);
    if (previous) {
      await open(previous.id, previous.path, false);
      if (file.value?.toolId === previous.id) history.value.pop();
    } else if (await save()) {
      selectedId.value = null;
      file.value = null;
      content.value = "";
    }
  }
  async function create(name: string, description: string) {
    if (busy.value || !(await save())) return;
    busy.value = true;
    try {
      const before = new Set(snapshot.value?.tools.map(({ id }) => id));
      snapshot.value = await service().create({ name, description });
      const created = snapshot.value.tools.find(({ id }) => !before.has(id));
      if (created) {
        busy.value = false;
        await open(created.id);
      }
    } catch (error) {
      report(error);
    } finally {
      busy.value = false;
    }
  }
  async function addFile(path: string) {
    if (!tool.value || busy.value || !(await save())) return false;
    busy.value = true;
    try {
      await service().save({
        toolId: tool.value.id,
        path,
        content: "",
        expectedSha256: null
      });
      snapshot.value = await service().list();
      busy.value = false;
      await open(tool.value.id, path);
      return true;
    } catch (error) {
      report(error);
      return false;
    } finally {
      busy.value = false;
    }
  }
  async function relate(id: string, enabled: boolean) {
    if (!tool.value || busy.value || !(await save())) return;
    busy.value = true;
    try {
      const original = await service().read({
        toolId: tool.value.id,
        path: "tool.json"
      });
      const metadata = ToolManifestSchema.parse(JSON.parse(original.content));
      metadata.relatedToolIds = enabled
        ? [...new Set([...metadata.relatedToolIds, id])]
        : metadata.relatedToolIds.filter((item) => item !== id);
      const saved = await service().save({
        toolId: original.toolId,
        path: original.path,
        content: JSON.stringify(metadata, null, 2) + "\n",
        expectedSha256: original.sha256
      });
      if (file.value?.path === "tool.json") {
        file.value = saved;
        content.value = saved.content;
      }
      snapshot.value = await service().list();
    } catch (error) {
      report(error);
    } finally {
      busy.value = false;
    }
  }
  async function remove() {
    if (!tool.value || busy.value) return;
    busy.value = true;
    try {
      snapshot.value = await service().delete(tool.value.id);
      selectedId.value = null;
      file.value = null;
      content.value = "";
      history.value = [];
      uiMessage.success("工具已删除。");
    } catch (error) {
      report(error);
    } finally {
      busy.value = false;
    }
  }
  async function reload() {
    if (!file.value || busy.value) return;
    busy.value = true;
    try {
      const latest = await service().read({
        toolId: file.value.toolId,
        path: file.value.path
      });
      drafts.delete(draftKey(file.value));
      file.value = latest;
      content.value = latest.content;
    } catch (error) {
      report(error);
    } finally {
      busy.value = false;
    }
  }
  async function copyPath(entry = false) {
    const current = tool.value;
    if (!current) return;
    try {
      await navigator.clipboard.writeText(
        `${current.directory}/${entry ? current.entryFile : (file.value?.path ?? current.entryFile)}`
      );
      uiMessage.success("绝对路径已复制。");
    } catch (error) {
      report(error);
    }
  }
  return {
    snapshot,
    file,
    content,
    tool,
    busy: computed(() => busy.value || saving.value),
    dirty,
    history,
    edit,
    refresh,
    save,
    open,
    back,
    create,
    addFile,
    relate,
    remove,
    reload,
    copyPath,
    dispose() {
      disposed = true;
      void save();
    }
  };
}

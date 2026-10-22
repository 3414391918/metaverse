import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type {
  ResourceManagerRequest,
  ResourceManagerResult
} from "@deepwrite/contracts";
import { uiMessage } from "../ui-feedback";
export function useResourceManager() {
  const snapshot = ref<ResourceManagerResult | null>(null);
  const directory = ref("");
  const query = ref("");
  const selected = ref<string[]>([]);
  const loading = ref(false),
    pending = ref(false);
  let epoch = 0,
    alive = true;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const api = () => window.deepwrite?.resourceManager;
  async function load() {
    const port = api();
    if (!port || !alive) return;
    const ticket = ++epoch;
    loading.value = true;
    try {
      const result = await port.execute({
        action: "list",
        directory: directory.value,
        query: query.value
      });
      if (!alive || ticket !== epoch) return;
      snapshot.value = result;
      const known = new Set(result.entries.map((entry) => entry.path));
      selected.value = selected.value.filter((path) => known.has(path));
    } catch (error) {
      if (alive && ticket === epoch)
        uiMessage.error(
          error instanceof Error ? error.message : "加载资源失败。"
        );
    } finally {
      if (alive && ticket === epoch) loading.value = false;
    }
  }
  async function run(input: ResourceManagerRequest): Promise<boolean> {
    const port = api();
    if (!port || pending.value) return false;
    pending.value = true;
    try {
      const result = await port.execute(input);
      if (!alive) return false;
      if (result.message) uiMessage.success(result.message);
      await load();
      return true;
    } catch (error) {
      if (alive)
        uiMessage.error(
          error instanceof Error ? error.message : "资源操作失败。"
        );
      await load();
      return false;
    } finally {
      if (alive) pending.value = false;
    }
  }
  function navigate(path: string) {
    directory.value = path;
    query.value = "";
    selected.value = [];
    if (searchTimer) clearTimeout(searchTimer);
    void load();
  }
  function refresh() {
    if (!pending.value) void load();
  }
  watch(query, () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => void load(), 200);
  });
  onMounted(() => {
    void load();
    window.addEventListener("focus", refresh);
  });
  onBeforeUnmount(() => {
    alive = false;
    epoch++;
    if (searchTimer) clearTimeout(searchTimer);
    window.removeEventListener("focus", refresh);
  });
  return {
    snapshot,
    directory,
    query,
    selected,
    loading,
    pending,
    load,
    run,
    navigate,
    refresh
  };
}

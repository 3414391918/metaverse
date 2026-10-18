import { ref } from "vue";
import type { FishAudioProgressPayload } from "@deepwrite/contracts";

export interface FishAudioProgressNode {
  id: string;
  label: string;
  status: "running" | "completed" | "error" | "cancelled";
  detail: string;
}

const platformLabels: Record<FishAudioProgressPayload["stage"], string> = {
  "voice.create": "创建声音"
};

export function useFishAudioProgress() {
  const nodes = ref<FishAudioProgressNode[]>([]);
  let activeId = "";
  const find = (id: string) => nodes.value.find((node) => node.id === id);

  function clear() {
    nodes.value = [];
    activeId = "";
  }
  function start(id: string, label: string, detail = "") {
    const existing = find(id);
    if (existing) {
      existing.status = "running";
      existing.detail = detail;
    } else {
      nodes.value.push({
        id,
        label,
        status: "running",
        detail
      });
    }
    activeId = id;
  }
  function complete(id: string, detail = "") {
    const node = find(id);
    if (!node) return;
    node.status = "completed";
    if (detail) node.detail = detail;
    if (activeId === id) activeId = "";
  }
  function fail(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const node = find(activeId);
    if (node) {
      node.status = "error";
      node.detail = message;
    } else {
      start("operation.error", "操作失败", message);
      const fallback = find("operation.error");
      if (fallback) fallback.status = "error";
    }
    activeId = "";
  }
  function cancel() {
    const node = find(activeId);
    if (node) {
      node.status = "cancelled";
      node.detail = "任务已取消";
    }
    activeId = "";
  }
  function acceptPlatform(
    operationId: string,
    progress: FishAudioProgressPayload
  ) {
    if (progress.operationId !== operationId) return;
    const id = progress.stage;
    if (progress.status === "running")
      start(id, platformLabels[id], progress.detail ?? "");
    else if (progress.status === "completed") complete(id, progress.detail);
    else {
      if (!find(id)) start(id, platformLabels[id]);
      activeId = id;
      fail(new Error(progress.detail ?? "平台操作失败"));
    }
  }
  return {
    nodes,
    clear,
    start,
    complete,
    fail,
    cancel,
    acceptPlatform
  };
}

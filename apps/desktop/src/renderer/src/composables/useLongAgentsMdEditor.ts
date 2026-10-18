import { computed, ref, watch } from "vue";
import { LONG_AGENTS_MD_MAX_CHARACTERS } from "@deepwrite/contracts/renderer";
import type { LongStructureMutationCompletion } from "../types/longWorkspace";
import type { LongStructureMutationController } from "./useLongStructureMutation";

export function useLongAgentsMdEditor(options: {
  content(): string | null | undefined;
  pending(): boolean;
  active(): boolean;
  mutations: LongStructureMutationController;
  save(content: string, completion: LongStructureMutationCompletion): void;
  notify: { success(message: string): void; warning(message: string): void };
}) {
  const agentsMdDraft = ref(options.content() ?? "");
  const agentsMdDirty = computed(
    () => agentsMdDraft.value !== (options.content() ?? "")
  );
  const agentsMdCharacterCount = computed(
    () => Array.from(agentsMdDraft.value).length
  );
  const agentsMdOverLimit = computed(
    () => agentsMdCharacterCount.value > LONG_AGENTS_MD_MAX_CHARACTERS
  );

  watch(options.content, (content) => {
    if (options.mutations.pendingMutation.value?.surface !== "agents") {
      agentsMdDraft.value = content ?? "";
    }
  });

  function save(resolve?: (saved: boolean) => void): boolean {
    if (options.pending() || options.mutations.mutationLocked.value)
      return false;
    if (agentsMdOverLimit.value) {
      options.notify.warning(
        `主智能体上下文不能超过 ${LONG_AGENTS_MD_MAX_CHARACTERS} 个字符。`
      );
      return false;
    }
    const id = options.mutations.begin("agents");
    if (id === null) return false;
    options.save(agentsMdDraft.value, {
      succeed: () => {
        if (!options.mutations.finish(id, "succeeded")) return;
        if (resolve) resolve(true);
        else options.notify.success("已保存主智能体上下文。");
      },
      fail: () => {
        if (options.mutations.finish(id, "failed")) resolve?.(false);
      },
      appliedButRefreshFailed: () => {
        if (options.mutations.finish(id, "applied-refresh-failed"))
          resolve?.(true);
      }
    });
    return true;
  }

  function flushAgentsMdIfNeeded(): Promise<boolean> {
    if (!agentsMdDirty.value || !options.active()) return Promise.resolve(true);
    return new Promise((resolve) => {
      if (!save(resolve)) resolve(false);
    });
  }

  return {
    agentsMdDraft,
    agentsMdDirty,
    agentsMdCharacterCount,
    agentsMdOverLimit,
    saveAgentsMd: () => save(),
    flushAgentsMdIfNeeded
  };
}

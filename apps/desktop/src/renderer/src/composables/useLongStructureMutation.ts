import { computed, shallowRef } from "vue";

export type LongStructureMutationSurface =
  "form" | "sync" | "background" | "agents";
export type LongStructureMutationOutcome =
  "succeeded" | "failed" | "applied-refresh-failed";

export function useLongStructureMutation(options: {
  locked(): boolean;
  onApplied(surface: LongStructureMutationSurface): void;
}) {
  const pendingMutation = shallowRef<{
    id: number;
    surface: LongStructureMutationSurface;
  } | null>(null);
  let clock = 0;
  const mutationLocked = computed(
    () => options.locked() || pendingMutation.value !== null
  );

  function begin(surface: LongStructureMutationSurface): number | null {
    if (mutationLocked.value) return null;
    const id = ++clock;
    pendingMutation.value = { id, surface };
    return id;
  }

  function finish(id: number, outcome: LongStructureMutationOutcome): boolean {
    const pending = pendingMutation.value;
    if (!pending || pending.id !== id) return false;
    pendingMutation.value = null;
    if (outcome !== "failed") options.onApplied(pending.surface);
    return true;
  }

  return { pendingMutation, mutationLocked, begin, finish };
}

export type LongStructureMutationController = ReturnType<
  typeof useLongStructureMutation
>;

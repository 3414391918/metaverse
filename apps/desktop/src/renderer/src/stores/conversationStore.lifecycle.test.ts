import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConversationStore } from "./conversationStore";

beforeEach(() => setActivePinia(createPinia()));

describe("conversation store lifecycle ownership", () => {
  it("does not let an unmounted shell close persistence after a newer shell claims it", async () => {
    const store = useConversationStore();
    const previousOwner = store.claimLifecycle();
    const stop = vi.fn();
    const save = vi.fn(async () => undefined);
    store.configurePersistenceAdapter({
      load: async () => undefined,
      save,
      onBeforeClose: () => stop
    });
    const currentOwner = store.claimLifecycle();
    await store.dispose({ isCurrent: previousOwner });
    expect(stop).not.toHaveBeenCalled();
    expect(() =>
      store.schedulePersistence("preferences", { revision: 2 })
    ).not.toThrow();
    await store.flushPersistence();
    expect(save).toHaveBeenCalledWith("preferences", { revision: 2 });
    await store.dispose({ isCurrent: currentOwner });
    expect(stop).toHaveBeenCalledOnce();
    expect(() => store.schedulePersistence("preferences", {})).toThrow(
      "已经关闭"
    );
  });

  it("rechecks ownership after a slow flush before disconnecting the replacement", async () => {
    const store = useConversationStore();
    const previousOwner = store.claimLifecycle();
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const save = vi.fn(async () => pending);
    store.configurePersistenceAdapter(
      { load: async () => undefined, save },
      { debounceMs: 10000 }
    );
    store.schedulePersistence("preferences", { revision: 1 });
    const disposing = store.dispose({ isCurrent: previousOwner });
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    const currentOwner = store.claimLifecycle();
    const replacementSave = vi.fn(async () => undefined);
    const stopReplacement = vi.fn();
    store.configurePersistenceAdapter({
      load: async () => undefined,
      save: replacementSave,
      onBeforeClose: () => stopReplacement
    });
    finish();
    await disposing;
    expect(stopReplacement).not.toHaveBeenCalled();
    expect(() =>
      store.schedulePersistence("preferences", { revision: 2 })
    ).not.toThrow();
    await store.flushPersistence();
    expect(replacementSave).toHaveBeenCalledWith("preferences", {
      revision: 2
    });
    await store.dispose({ isCurrent: currentOwner });
  });
});

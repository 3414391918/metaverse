import { describe, expect, it, vi } from "vitest";
import type { SystemEventEnvelope } from "@deepwrite/contracts";
import type { SubagentAuthoringController } from "./useSubagentAuthoring";
import { useLazySubagentAuthoringController } from "./useLazyFeatureControllers";

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(cause: unknown): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function authoringModule(controller: SubagentAuthoringController) {
  return {
    useSubagentAuthoring: vi.fn(() => controller)
  };
}

function authoringController(): SubagentAuthoringController {
  return {
    handleEvent: vi.fn()
  } as unknown as SubagentAuthoringController;
}

describe("lazy feature controllers", () => {
  it("does not create feature state before the feature is requested", () => {
    const api = () => undefined;
    const authoring = useLazySubagentAuthoringController({ api });

    expect(authoring.controller.value).toBeNull();
  });

  it("forwards events only after authoring has been initialized", async () => {
    const authoring = useLazySubagentAuthoringController({
      api: () => undefined
    });
    const event = {
      type: "unrelated-test-event"
    } as unknown as SystemEventEnvelope;

    authoring.handleEvent(event);
    const controller = await authoring.ensureLoaded();
    const handleEvent = vi.spyOn(controller, "handleEvent");
    authoring.handleEvent(event);
    expect(handleEvent).toHaveBeenCalledWith(event);
  });

  it("does not publish a late authoring controller after disposal", async () => {
    const firstImport = deferred<ReturnType<typeof authoringModule>>();
    const lateController = authoringController();
    const reactivatedController = authoringController();
    let loadAttempt = 0;
    const authoring = useLazySubagentAuthoringController({
      api: () => undefined,
      loadModule: async () => {
        loadAttempt += 1;
        if (loadAttempt === 1) return await firstImport.promise;
        return authoringModule(reactivatedController);
      }
    });

    const staleLoad = authoring.ensureLoaded();
    const staleRejection = expect(staleLoad).rejects.toThrow(
      "Subagent authoring controller load was cancelled."
    );
    authoring.dispose();
    const reactivatedLoad = authoring.ensureLoaded();
    firstImport.resolve(authoringModule(lateController));

    await staleRejection;
    await expect(reactivatedLoad).resolves.toBe(reactivatedController);
    expect(authoring.controller.value).toBe(reactivatedController);
  });
});

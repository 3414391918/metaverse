import { describe, expect, it, vi } from "vitest";
import type {
  ToolFileSnapshot,
  ToolLibraryApi,
  ToolLibrarySnapshot
} from "@deepwrite/contracts";
import { useToolLibrary } from "./useToolLibrary";
vi.mock("../ui-feedback", () => ({
  uiMessage: { error: vi.fn(), success: vi.fn() }
}));
function harness() {
  const snapshot: ToolLibrarySnapshot = {
    directory: "/tmp/tools-test",
    tools: [
      {
        version: 1,
        id: "first",
        name: "First",
        description: "",
        entryFile: "SKILL.md",
        relatedToolIds: ["second"],
        directory: "/tmp/tools-test/first",
        files: [{ path: "SKILL.md", bytes: 1 }]
      },
      {
        version: 1,
        id: "second",
        name: "Second",
        description: "",
        entryFile: "SKILL.md",
        relatedToolIds: [],
        directory: "/tmp/tools-test/second",
        files: [{ path: "SKILL.md", bytes: 1 }]
      }
    ]
  };
  const files = new Map<string, ToolFileSnapshot>(
    ["first", "second"].map((id) => [
      id,
      {
        toolId: id,
        path: "SKILL.md",
        content: id,
        sha256: id.repeat(64).slice(0, 64)
      }
    ])
  );
  const save = vi.fn<ToolLibraryApi["save"]>(async (input) => {
    const old = files.get(input.toolId)!;
    if (old.sha256 !== input.expectedSha256)
      throw new Error("externally changed");
    const next = {
      toolId: input.toolId,
      path: input.path,
      content: input.content,
      sha256: "b".repeat(64)
    };
    files.set(input.toolId, next);
    return next;
  });
  const api: ToolLibraryApi = {
    list: vi.fn(async () => snapshot),
    read: vi.fn(async (input) => files.get(input.toolId)!),
    save,
    create: vi.fn(),
    delete: vi.fn()
  };
  return { model: useToolLibrary(() => api), api, files, save };
}
describe("editable tool navigation and persistence", () => {
  it("saves before following a relation and returns through navigation history", async () => {
    const { model, files } = harness();
    await model.refresh();
    await model.open("first");
    model.edit("changed");
    await model.open("second");
    expect(files.get("first")!.content).toBe("changed");
    expect(model.history.value).toEqual([{ id: "first", path: "SKILL.md" }]);
    await model.back();
    expect(model.tool.value?.id).toBe("first");
    expect(model.content.value).toBe("changed");
  });
  it("does not navigate away or discard a draft after an external file edit", async () => {
    const { model, files } = harness();
    await model.refresh();
    await model.open("first");
    model.edit("local draft");
    files.set("first", {
      ...files.get("first")!,
      content: "external edit",
      sha256: "e".repeat(64)
    });
    await model.open("second");
    expect(model.tool.value?.id).toBe("first");
    expect(model.content.value).toBe("local draft");
    await model.reload();
    expect(model.content.value).toBe("external edit");
  });
  it("serializes repeated saves and preserves an edit made while the first write is pending", async () => {
    const { model, save } = harness();
    await model.refresh();
    await model.open("first");
    model.edit("one");
    let finish!: (value: ToolFileSnapshot) => void;
    save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const first = model.save();
    model.edit("two");
    const second = model.save();
    const third = model.save();
    expect(model.busy.value).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    finish({
      toolId: "first",
      path: "SKILL.md",
      content: "one",
      sha256: "c".repeat(64)
    });
    // The next queued write must use the returned base, not the stale read.
    save.mockImplementation(async (input) => ({
      toolId: input.toolId,
      path: input.path,
      content: input.content,
      sha256: "d".repeat(64)
    }));
    await Promise.all([first, second, third]);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]![0].expectedSha256).toBe("c".repeat(64));
    expect(model.content.value).toBe("two");
    expect(model.dirty.value).toBe(false);
    expect(model.busy.value).toBe(false);
  });
});

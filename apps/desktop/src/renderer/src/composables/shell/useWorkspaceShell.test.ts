import { createPinia } from "pinia";
import { createRenderer, defineComponent, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceShell } from "./useWorkspaceShell";
vi.mock("../useAppearance", () => ({ useAppearance: () => undefined }));
afterEach(() => vi.unstubAllGlobals());
describe("workspace shell composition", () => {
  it("initializes the novel and library surface without forward-port access", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("document", {
      documentElement: { lang: "", dataset: {} },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    vi.stubGlobal("navigator", { language: "zh-CN" });
    vi.stubGlobal("window", {
      innerWidth: 1280,
      innerHeight: 800,
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key)
      },
      setTimeout,
      clearTimeout,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    type Node = { children: Node[]; text: string };
    const renderer = createRenderer<Node, Node>({
      createElement: () => ({ children: [], text: "" }),
      createText: (text) => ({ children: [], text }),
      createComment: (text) => ({ children: [], text }),
      insert: (child, parent) => {
        parent.children.push(child);
      },
      remove: () => {},
      patchProp: () => {},
      setText: (node, text) => {
        node.text = text;
      },
      setElementText: (node, text) => {
        node.text = text;
      },
      parentNode: () => null,
      nextSibling: () => null
    });
    const app = renderer.createApp(
      defineComponent({
        setup() {
          const shell = useWorkspaceShell();
          expect(shell.selectedResourceId).toBe("");
          expect(shell.workspaceFeatureModule).toEqual({ kind: "tools" });
          expect(shell.activeAgentDocument.domain).toBe("creation");
          expect(
            shell.resourceTreeSections.find(
              (section) => section.id === "creation"
            )?.nodes
          ).toEqual([]);
          return () => h("div", "ready");
        }
      })
    );
    app.use(createPinia());
    const host: Node = { children: [], text: "" };
    app.mount(host);
    expect(host.children[0]?.text).toBe("ready");
    app.unmount();
  });
});

import { describe, expect, it } from "vitest";
import {
  collectPlugins,
  collectPluginConfigurations,
  pluginToggleTarget
} from "../integrations/harness/plugin/plugin-catalog.js";

const row = (entryId, moduleName, enabled = true, more = {}) => ({
  entryId,
  moduleName,
  enabled,
  fiberPhase: enabled ? "active" : null,
  ...more
});
const bundle = (name, enabled, more = {}) => ({
  name,
  enabled,
  installed: true,
  optional: true,
  official: true,
  availability: "installation",
  rows: [],
  ...more
});

describe("unified assistant plugin catalog", () => {
  it("includes enabled and disabled entries, without duplicating a bundle's own rows", () => {
    const packages = [
      bundle("@deepseek-ai/dsh-bundle-voice", false, {
        rows: [row("include:voice", "@deepseek-ai/dsh-voice")]
      }),
      bundle("@deepseek-ai/dsh-base", true, {
        rows: [row("include:web", "@deepseek-ai/dsh-tool-web")]
      })
    ];
    const cards = collectPlugins({
      packages,
      plugins: [
        row("include:voice", "@deepseek-ai/dsh-voice", false),
        row("include:web", "@deepseek-ai/dsh-tool-web")
      ],
      inventory: { agentPresets: [] },
      locale: "zh"
    });
    expect(cards.map((card) => card.key).sort()).toEqual([
      "bundle:@deepseek-ai/dsh-bundle-voice",
      "plugin:include:web"
    ]);
    expect(cards.find((card) => card.kind === "bundle").enabled).toBe(false);
    expect(cards.find((card) => card.kind === "plugin").enabled).toBe(true);
    expect(
      pluginToggleTarget(cards.find((card) => card.kind === "plugin"))
    ).toEqual({ kind: "plugin", id: "include:web" });
  });
  it("joins inactive preset references without inventing a toggle address or duplicate cards", () => {
    const moduleName = "@deepseek-ai/dsh-tool-fs";
    const inventory = {
      agentPresets: [
        {
          id: "standard",
          name: "标准模式",
          rows: [row("read", moduleName), row("time", "@deepseek-ai/dsh-time")]
        },
        { id: "minimal", name: "极简模式", rows: [row("read", moduleName)] }
      ]
    };
    const cards = collectPlugins({
      packages: [],
      plugins: [row("include:fs", moduleName)],
      inventory,
      locale: "zh"
    });
    expect(cards).toHaveLength(2);
    expect(
      cards.find((card) => card.moduleName === moduleName).presets
    ).toEqual(["标准模式", "极简模式"]);
    const preset = cards.find(
      (card) => card.moduleName === "@deepseek-ai/dsh-time"
    );
    expect(preset.readOnlyReason).toBe("preset-composition");
    expect(pluginToggleTarget(preset)).toBeUndefined();
  });
  it("preserves host readonly reasons and distinguishes different addressable instances", () => {
    const cards = collectPlugins({
      packages: [],
      plugins: [
        row("include:manager", "@deepseek-ai/dsh-plugin-manager", true, {
          readOnlyReason: "management-required"
        }),
        row("include:a", "sample", true),
        row("include:b", "sample", false)
      ],
      inventory: {},
      locale: "en"
    });
    expect(cards).toHaveLength(3);
    expect(
      pluginToggleTarget(
        cards.find((card) => card.entryId === "include:manager")
      )
    ).toBeUndefined();
    expect(
      pluginToggleTarget(cards.find((card) => card.entryId === "include:b"))
    ).toEqual({ kind: "plugin", id: "include:b" });
  });
  it("keeps the integration that owns the plugin settings available", () => {
    const [card] = collectPlugins({
      plugins: [
        row("include:metaverse-integration", "file:///app/plugin/index.js")
      ]
    });
    expect(card.readOnlyReason).toBe("management-required");
    expect(pluginToggleTarget(card)).toBeUndefined();
  });
  it("keeps all item, bundle and row configuration forms in one configuration list", () => {
    const packages = [
      bundle("example", true, {
        meta: { title: { zh: "示例", en: "Example" } },
        rows: [
          {
            rowId: "web",
            moduleName: "example-web",
            meta: { title: { zh: "网页" } }
          }
        ]
      })
    ];
    const configurations = collectPluginConfigurations({
      ledger: {
        items: [{ id: "subagent", label: "子智能体" }],
        bundles: new Set(["example"]),
        rows: new Set(["example#web"])
      },
      packages,
      locale: "zh"
    });
    expect(configurations.map((item) => item.view)).toEqual([
      { kind: "item", id: "subagent" },
      { kind: "package", name: "example" },
      { kind: "row", name: "example", rowId: "web" }
    ]);
    expect(configurations.map((item) => item.title)).toEqual([
      "子智能体",
      "示例",
      "网页"
    ]);
  });
});

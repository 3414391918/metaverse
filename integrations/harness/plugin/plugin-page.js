import {
  collectPlugins,
  collectPluginConfigurations,
  pluginToggleTarget
} from "./plugin-catalog.js";

/** Keep Harness's installation dialogs and forms; replace only its list presentation. */
export function createPluginPage(
  React,
  ctx,
  { apiSource, useSource, openConfiguration, primitives }
) {
  const {
    createElement: h,
    useState,
    useEffect,
    useMemo,
    useSyncExternalStore
  } = React;
  const { Switch } = primitives;
  const en = () => ctx.locale.getSnapshot().active === "en";
  const text = (zh, english) => (en() ? english : zh);
  const descriptions = {
    subagent: [
      "设置子智能体的递归层级、数量和模型。",
      "Configure subagent depth, limits and models."
    ],
    "web-search": [
      "设置网页搜索提供方与搜索参数。",
      "Configure web search providers and parameters."
    ],
    "agent-loop": [
      "控制 Agent 派发工具调用的方式。",
      "Configure how the agent dispatches tools."
    ],
    shell: [
      "设置终端命令的运行时限和输出上限。",
      "Configure command timeouts and output limits."
    ]
  };
  const configIds = {
    "tool-subagent": "subagent",
    subagent: "subagent",
    "tool-web": "web-search",
    "web-search": "web-search",
    "agent-loop": "agent-loop",
    shell: "shell"
  };
  const style = document.createElement("style");
  style.textContent = `
    .mv-plugin-surface{height:100%;overflow:auto;color:var(--dsw-alias-label-primary)}
    .mv-native-plugin{height:100%}.mv-plugin-surface.is-list .mv-native-plugin{height:auto}
    .mv-plugin-surface.is-list [data-plugin-panel]{height:auto;overflow:visible;padding-bottom:0;gap:0}
    .mv-plugin-surface.is-list [data-plugin-panel]>[class$="_installedPanel"],.mv-plugin-surface.is-list [class$="_pageTabs"],.mv-plugin-surface.is-list [class$="_moreHead"]{display:none}
    .mv-plugin-surface.is-module .mv-native-plugin{display:none}
    .mv-plugin-surface.is-package .mv-native-plugin{height:calc(100% - 64px)}
    .mv-plugin-surface.is-package [data-plugin-detail] [class$="_crumb"]{display:none}
    .mv-plugin-return{box-sizing:border-box;width:calc(100% - clamp(48px,8vw,96px));max-width:960px;margin:28px auto 0;height:36px;display:flex;align-items:center}
    .mv-plugin-sections,.mv-plugin-module{width:calc(100% - clamp(48px,8vw,96px));max-width:960px;margin:28px auto 48px}
    .mv-plugin-search{box-sizing:border-box;width:100%;padding:10px 14px;border:1px solid var(--dsw-alias-border-l1,#8883);border-radius:10px;background:transparent;color:inherit;font:inherit;outline-offset:3px}
    .mv-plugin-section{margin-top:32px}.mv-plugin-section h2{font-size:14px;line-height:22px;font-weight:600;margin:0 8px 16px}
    .mv-plugin-cards{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
    .mv-plugin-card{display:flex;align-items:center;gap:16px;border-radius:16px;padding:10px 12px;min-width:0}
    .mv-plugin-card:hover,.mv-plugin-card:focus-within{background:var(--dsw-alias-bg-layer-2,#8881)}
    .mv-plugin-open{display:flex;align-items:center;gap:16px;min-width:0;flex:1;text-align:left;border:0;background:transparent;color:inherit;cursor:pointer;font:inherit;padding:0;border-radius:10px;outline-offset:5px}
    .mv-plugin-art{width:52px;height:52px;flex:none;border:1px solid var(--dsw-alias-border-l1,#8883);border-radius:14px;display:grid;place-items:center;overflow:hidden;color:#5c91f5}
    .mv-plugin-art img{width:36px;height:36px;object-fit:contain}.mv-plugin-art svg{width:30px;height:30px}
    .mv-plugin-copy{min-width:0;display:flex;flex-direction:column;gap:4px}.mv-plugin-name{font-size:15px;line-height:22px;font-weight:500;overflow-wrap:anywhere}
    .mv-plugin-desc{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.mv-plugin-card>[role=switch]{flex:none;margin:0 2px 0 12px}
    .mv-plugin-note{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:22px;margin:16px 8px;overflow-wrap:anywhere}
    .mv-plugin-module h1{font-size:22px;font-weight:600;line-height:30px;overflow-wrap:anywhere}.mv-plugin-module-head{display:flex;align-items:center;gap:16px;margin:24px 0}.mv-plugin-module-head h1{flex:1}
    .mv-plugin-back,.mv-plugin-file,.mv-plugin-config-link{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l1,#8883);background:transparent;border-radius:10px;padding:9px 14px}
    .mv-plugin-file{margin:14px 8px 0;font-size:13px}.mv-plugin-module dl{display:grid;grid-template-columns:110px minmax(0,1fr);gap:14px;font-size:13px;line-height:22px;margin:28px 0}.mv-plugin-module dt{color:var(--dsw-alias-label-secondary)}.mv-plugin-module dd{margin:0;overflow-wrap:anywhere}
    @media(max-width:700px){.mv-plugin-card{gap:10px;padding:10px 4px}.mv-plugin-open{gap:12px}.mv-plugin-art{width:44px;height:44px}}
  `;
  document.head.append(style);
  ctx.effect(() => () => style.remove());

  function reason(card) {
    if (card.readOnlyReason === "management-required")
      return text(
        "插件管理所需的内核服务，不能单独停用。",
        "Required by plugin management; cannot be stopped independently."
      );
    if (card.readOnlyReason === "preset-composition")
      return text(
        "由所属预设管理，使用该预设时加载。",
        "Managed by its presets and loaded with the selected preset."
      );
    if (card.readOnlyReason)
      return text(
        "由上层插件统一管理，无法单独切换。",
        "Managed by its parent plugin and cannot be toggled independently."
      );
    return undefined;
  }
  function Artwork({ card }) {
    const [failed, setFailed] = useState(false);
    const key = card.id || card.moduleName || card.name || card.title;
    return h(
      "span",
      { className: "mv-plugin-art", "aria-hidden": true },
      card.meta?.icon && !failed
        ? h("img", {
            src: card.meta.icon,
            alt: "",
            onError: () => setFailed(true)
          })
        : h(
            "svg",
            { viewBox: "0 0 32 32", fill: "none" },
            key.includes("web")
              ? [
                  h("circle", {
                    key: "circle",
                    cx: 13,
                    cy: 13,
                    r: 8,
                    stroke: "#56c4cb",
                    strokeWidth: 5
                  }),
                  h("path", {
                    key: "handle",
                    d: "M20 20L28 28",
                    stroke: "#5c91f5",
                    strokeWidth: 5
                  })
                ]
              : key.includes("shell")
                ? h("path", {
                    d: "M6 7L15 16L6 25M18 25H29",
                    stroke: "currentColor",
                    strokeWidth: 4
                  })
                : [
                    h("rect", {
                      key: "one",
                      x: 4,
                      y: 4,
                      width: 16,
                      height: 16,
                      rx: 3,
                      fill: "#6792f2"
                    }),
                    h("rect", {
                      key: "two",
                      x: 13,
                      y: 13,
                      width: 15,
                      height: 15,
                      rx: 3,
                      fill: "#49bbb3",
                      opacity: 0.85
                    })
                  ]
          )
    );
  }
  function Toggle({ card, face, state }) {
    const target = pluginToggleTarget(card);
    return h(Switch, {
      checked: card.enabled === true,
      disabled:
        !target ||
        state.busy.includes(
          target.kind === "bundle" ? target.id : `row:${target.id}`
        ),
      label: `${card.enabled ? text("停用", "Disable") : text("启用", "Enable")} ${card.title}`,
      title: reason(card),
      onChange: (enabled) => {
        if (!target) return;
        if (target.kind === "bundle") face.setEnabled(target.id, enabled);
        else face.setRowEnabled(target.id, enabled);
      }
    });
  }
  function Card({ card, onOpen, face, state, configuration = false }) {
    return h(
      "li",
      {
        className: "mv-plugin-card",
        "data-metaverse-plugin": configuration ? undefined : card.key,
        "data-metaverse-config": configuration ? card.key : undefined
      },
      h(
        "button",
        {
          className: "mv-plugin-open",
          type: "button",
          onClick: onOpen,
          "aria-label": `${text("查看", "View")} ${card.title}`
        },
        h(Artwork, { card }),
        h(
          "span",
          { className: "mv-plugin-copy" },
          h("span", { className: "mv-plugin-name" }, card.title),
          h(
            "span",
            { className: "mv-plugin-desc" },
            card.description ||
              (configuration
                ? text("配置插件参数。", "Configure plugin parameters.")
                : reason(card) || card.moduleName || card.name)
          )
        )
      ),
      !configuration && h(Toggle, { card, face, state })
    );
  }
  function ModuleDetail({
    card,
    face,
    state,
    configurations,
    onBack,
    onConfigure
  }) {
    const short = (card.moduleName || "")
      .split("/")
      .pop()
      .replace(/^dsh-(?:host-|client-)?/, "");
    const configuration = configurations.find(
      (item) => item.id === configIds[short]
    );
    const phase = {
      active: text("运行中", "Running"),
      loading: text("加载中", "Loading"),
      pending: text("等待依赖", "Waiting for dependencies"),
      failed: text("加载失败", "Failed"),
      unloading: text("正在停止", "Stopping")
    }[card.fiberPhase];
    return h(
      "article",
      {
        className: "mv-plugin-module",
        "data-metaverse-plugin-detail": card.key
      },
      h(
        "button",
        { className: "mv-plugin-back", onClick: onBack },
        text("返回插件列表", "Back to plugins")
      ),
      h(
        "div",
        { className: "mv-plugin-module-head" },
        h(Artwork, { card }),
        h("h1", null, card.title),
        h(Toggle, { card, face, state })
      ),
      h("p", { className: "mv-plugin-desc" }, card.description),
      h(
        "dl",
        null,
        h("dt", null, text("完整名称", "Module")),
        h("dd", null, card.moduleName),
        h("dt", null, text("插件标识", "Plugin ID")),
        h("dd", null, card.entryId || card.key),
        h("dt", null, text("配置状态", "Configuration")),
        h(
          "dd",
          null,
          card.enabled ? text("已启用", "Enabled") : text("未启用", "Disabled")
        ),
        h("dt", null, text("运行状态", "Runtime")),
        h("dd", null, phase || text("未运行", "Not running")),
        card.presets.length
          ? h(
              React.Fragment,
              null,
              h("dt", null, text("所属预设", "Presets")),
              h("dd", null, card.presets.join("、"))
            )
          : null
      ),
      reason(card) && h("p", { className: "mv-plugin-note" }, reason(card)),
      configuration &&
        h(
          "button",
          {
            className: "mv-plugin-config-link",
            onClick: () => onConfigure(configuration.view)
          },
          text("配置插件", "Configure plugin")
        )
    );
  }
  function ManagedPage({ entry, renderSlot }) {
    const face = useMemo(() => entry.inject(), [entry]);
    const navigation = useMemo(() => entry.store.create(), [entry]);
    const state = useSource(face.hooks.pluginManager);
    const ledger = useSource(face.hooks.configLedger);
    const selected = useSource(navigation);
    const api = useSource(apiSource);
    const [records, setRecords] = useState({ plugins: [], inventory: {} });
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [moduleKey, setModuleKey] = useState(null);
    const locale = ctx.locale.getSnapshot().active;
    useEffect(() => {
      if (selected.view.kind === "more")
        navigation.actions.setView({ kind: "list" });
    }, [selected.view.kind, navigation]);
    useEffect(() => {
      let active = true;
      if (!api || (state.status !== "ready" && state.status !== "error"))
        return;
      void Promise.all([api.manager.listPlugins(), api.inventory.list()])
        .then(([plugins, inventory]) => {
          if (!plugins.ok) throw new Error(plugins.error.message);
          if (!inventory.ok) throw new Error(inventory.error.message);
          if (active) {
            setRecords({ plugins: plugins.value, inventory: inventory.value });
            setError("");
          }
        })
        .catch((error) => {
          if (active) setError(error.message);
        });
      return () => {
        active = false;
      };
    }, [api, state.packages, state.status]);
    const cards = useMemo(
      () => collectPlugins({ ...records, packages: state.packages, locale }),
      [records, state.packages, locale]
    );
    const configurations = collectPluginConfigurations({
      ledger,
      packages: state.packages,
      locale
    }).map((card) => ({
      ...card,
      description: card.description || descriptions[card.id]?.[en() ? 1 : 0]
    }));
    const detail = cards.find((card) => card.key === moduleKey);
    const list =
      !detail &&
      selected.tab === "installed" &&
      ["list", "more"].includes(selected.view.kind);
    const packageDetail = !detail && selected.view.kind === "package";
    const configure = (view) => {
      setModuleKey(null);
      navigation.actions.setTab("installed");
      navigation.actions.setView(view);
    };
    const open = (card) =>
      card.kind === "bundle"
        ? configure({ kind: "package", name: card.name })
        : setModuleKey(card.key);
    const matches = (card) =>
      `${card.title} ${card.description || ""} ${card.moduleName || card.name || ""} ${(card.presets || []).join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());
    const visible = cards.filter(matches);
    return h(
      "div",
      {
        className: `mv-plugin-surface${list ? " is-list" : ""}${detail ? " is-module" : ""}${packageDetail ? " is-package" : ""}`
      },
      packageDetail &&
        h(
          "div",
          { className: "mv-plugin-return" },
          h(
            "button",
            {
              className: "mv-plugin-back",
              onClick: () => configure({ kind: "list" })
            },
            text("返回插件列表", "Back to plugins")
          )
        ),
      h(
        "div",
        { className: "mv-native-plugin" },
        renderSlot("main", {}, { entryKey: "plugins" })
      ),
      detail
        ? h(ModuleDetail, {
            card: detail,
            face,
            state,
            configurations,
            onBack: () => setModuleKey(null),
            onConfigure: configure
          })
        : list
          ? h(
              "div",
              { className: "mv-plugin-sections" },
              h("input", {
                className: "mv-plugin-search",
                type: "search",
                value: query,
                placeholder: text("搜索插件", "Search plugins"),
                "aria-label": text("搜索插件", "Search plugins"),
                onChange: (e) => setQuery(e.target.value)
              }),
              h(
                "section",
                {
                  className: "mv-plugin-section",
                  "aria-label": text("插件配置", "Plugin configuration")
                },
                h("h2", null, text("插件配置", "Plugin configuration")),
                h(
                  "ul",
                  { className: "mv-plugin-cards" },
                  configurations.filter(matches).map((card) =>
                    h(Card, {
                      key: card.key,
                      card,
                      configuration: true,
                      onOpen: () => configure(card.view)
                    })
                  )
                ),
                h(
                  "button",
                  { className: "mv-plugin-file", onClick: openConfiguration },
                  text("打开插件配置文件", "Open plugin configuration file")
                )
              ),
              h(
                "section",
                {
                  className: "mv-plugin-section",
                  "aria-label": text("插件管理", "Plugin management")
                },
                h("h2", null, text("插件管理", "Plugin management")),
                error &&
                  h("p", { className: "mv-error", role: "alert" }, error),
                state.status === "loading" || state.status === "idle"
                  ? h(
                      "p",
                      { className: "mv-plugin-note", role: "status" },
                      text("正在读取插件…", "Loading plugins…")
                    )
                  : null,
                h(
                  "ul",
                  { className: "mv-plugin-cards" },
                  visible.map((card) =>
                    h(Card, {
                      key: card.key,
                      card,
                      face,
                      state,
                      onOpen: () => open(card)
                    })
                  )
                ),
                !visible.length &&
                  state.status === "ready" &&
                  h(
                    "p",
                    { className: "mv-plugin-note" },
                    text("没有匹配的插件", "No matching plugins")
                  )
              )
            )
          : null
    );
  }
  return function PluginPage({ renderSlot }) {
    useSyncExternalStore(
      (listener) => ctx.slots.subscribe("main", listener),
      () => ctx.slots.getVersion("main")
    );
    useSource(ctx.locale);
    const entry = ctx.slots
      .entries("main")
      .find((item) => item.options.key === "plugins");
    return entry
      ? h(ManagedPage, { entry, renderSlot })
      : h(
          "p",
          { className: "mv-plugin-note", role: "status" },
          text("正在读取插件…", "Loading plugins…")
        );
  };
}

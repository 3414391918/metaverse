import { createPluginPage } from "./plugin-page.js";
import {
  beginToolCommand,
  createToolClaim,
  createToolRestoreSource,
  parseToolRequest
} from "./tool-command.js";
/* Fixed to Harness 0.2.1-rc.2. Render through its public slots and services. */
window.__ModuleLoader__.load({
  id: "@metaverse/harness-integration",
  factory(require) {
    const React = require("react");
    const {
      Component,
      createElement: h,
      useState,
      useEffect,
      useRef,
      useSyncExternalStore
    } = React;
    function source(initial) {
      let value = initial;
      const listeners = new Set();
      return {
        getSnapshot: () => value,
        subscribe(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
        set(next) {
          value = next;
          for (const fn of listeners) fn();
        }
      };
    }
    const useSource = (store) =>
      useSyncExternalStore(
        (listener) => store.subscribe(listener),
        () => store.getSnapshot()
      );
    return {
      inject: ["slots", "locale", "configForms", "remote"],
      apply(ctx) {
        const labels = {
          会话设置: "Conversation settings",
          关闭: "Close",
          关闭会话设置: "Close conversation settings",
          显示代码工作视图: "Show code work view",
          助手会话: "Assistant sessions",
          "＋ 新建会话": "+ New conversation",
          导入会话: "Import conversation",
          正在导入: "Importing…",
          切换会话列表: "Toggle conversations",
          会话: "Conversations",
          插件管理: "Manage plugins",
          "正在读取插件…": "Loading plugins…",
          删除会话: "Delete conversation",
          工具: "Tool",
          选择工具管理中的工具: "Choose a tool from Tool Management",
          "搜索工具…": "Search tools…",
          没有可用的工具: "No tools available",
          没有匹配的工具: "No matching tools",
          "删除这个会话？会话将从列表移除，可以在归档中恢复。":
            "Delete this conversation? It can be restored from the archive."
        };
        const t = (text) =>
          ctx.locale.getSnapshot().active === "en"
            ? labels[text] || text
            : text;
        const pluginApi = source(null);
        ctx.inject(
          ["remote.pluginInventory", "remote.pluginManager"],
          (child) => {
            pluginApi.set({
              inventory: child.remote.pluginInventory,
              manager: child.remote.pluginManager
            });
            return () => pluginApi.set(null);
          }
        );
        const nav = source({
          activePanelId: null,
          screen: "assistant",
          sidebar: true,
          rightbar: false,
          track: false,
          fullscreen: false
        });
        let navigation = new AbortController();
        const update = (patch) => {
          const current = nav.getSnapshot();
          if (
            Object.entries(patch).some(
              ([key, value]) => !Object.is(current[key], value)
            )
          )
            nav.set({ ...current, ...patch });
        };
        const panelInfo = source({ activePanelId: null });
        const layout = {
          panelInfo,
          selectPanel(id) {
            navigation.abort();
            const previous = nav.getSnapshot().screen;
            update({
              activePanelId: id,
              screen: id === "plugins" ? "plugins" : "assistant"
            });
            if (panelInfo.getSnapshot().activePanelId !== id)
              panelInfo.set({ activePanelId: id });
            if (previous !== "assistant" && id === null)
              notify({ type: "navigate", screen: "assistant" });
          },
          beginNavigation() {
            navigation.abort();
            navigation = new AbortController();
            return navigation.signal;
          },
          toggleSidebar() {
            update({ sidebar: !nav.getSnapshot().sidebar });
          },
          openRightbar(track, fullscreen) {
            update({ rightbar: true, track, fullscreen });
          },
          closeRightbar() {
            update({ rightbar: false, track: false, fullscreen: false });
          }
        };
        ctx.reflect.provide("layout", layout);
        ctx.slots.provideRoot({ hooks: { panelInfo } });
        const params = new URLSearchParams(location.hash.slice(1));
        const nonce = params.get("metaverse");
        const parentOrigin = params.get("parent") || "null";
        const workspacePath = params.get("workspace");
        const bridge = window.metaverseAssistant;
        const toolRequests = new Map();
        let nextToolRequest = 0;
        function listTools() {
          if (!bridge)
            return Promise.reject(new Error("工具目录仅可在桌面应用中读取。"));
          const requestId = `tools-${++nextToolRequest}`;
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              toolRequests.delete(requestId);
              reject(new Error("读取工具目录超时。"));
            }, 15_000);
            toolRequests.set(requestId, { resolve, reject, timeout });
            bridge.notify({
              source: "metaverse-harness",
              nonce,
              type: "list-tools",
              requestId
            });
          });
        }
        const fonts = new Map();
        const notify = (data) => {
          const value = { source: "metaverse-harness", nonce, ...data };
          if (bridge) bridge.notify(value);
          else
            window.parent.postMessage(
              value,
              parentOrigin === "null" ? "*" : parentOrigin
            );
        };
        const go = (screen) => {
          if (nav.getSnapshot().screen === screen) return;
          update({
            screen,
            activePanelId: screen === "plugins" ? "plugins" : null
          });
          panelInfo.set({
            activePanelId: screen === "plugins" ? "plugins" : null
          });
        };
        const readMessage = (event) => {
          if (
            event.source !== window.parent ||
            event.origin !== parentOrigin ||
            !event.data ||
            event.data.nonce !== nonce ||
            event.data.source !== "metaverse-host"
          )
            return;
          const { screen, appearance, language } = event.data;
          if (event.data.type === "tools-result") {
            const request = toolRequests.get(event.data.requestId);
            if (!request) return;
            toolRequests.delete(event.data.requestId);
            clearTimeout(request.timeout);
            if (typeof event.data.error === "string")
              request.reject(new Error(event.data.error));
            else
              request.resolve(
                Array.isArray(event.data.tools) ? event.data.tools : []
              );
            return;
          }
          if (["assistant", "models", "plugins", "presets"].includes(screen))
            go(screen);
          if (appearance && ["light", "dark"].includes(appearance.scheme)) {
            document.body.toggleAttribute(
              "data-ds-dark-theme",
              appearance.scheme === "dark"
            );
            document.documentElement.style.colorScheme = appearance.scheme;
            if (typeof appearance.font === "string") {
              document.body.style.fontFamily = appearance.font;
              document.body.style.setProperty(
                "--dsh-font-family-text",
                appearance.font
              );
              const match = appearance.font.match(
                /DeepWriteCustom_([a-f\d]{64})/
              );
              if (match && !fonts.has(match[1])) {
                const face = new FontFace(
                  `DeepWriteCustom_${match[1]}`,
                  `url("deepwrite-font://asset/font_${match[1]}")`
                );
                fonts.set(match[1], face);
                document.fonts.add(face);
                void face
                  .load()
                  .catch((error) =>
                    console.warn("Metaverse font unavailable", error)
                  );
              }
            }
            if (Number.isFinite(appearance.fontSize))
              document.body.style.setProperty(
                "--dsh-content-font-size",
                `${Math.max(10, Math.min(28, appearance.fontSize))}px`
              );
          }
          if (appearance?.palette && typeof appearance.palette === "object") {
            for (const key of [
              "--dsw-alias-bg-base",
              "--dsw-alias-bg-layer-1",
              "--dsw-alias-bg-layer-2",
              "--dsw-alias-bg-overlay",
              "--dsw-alias-border-l1",
              "--dsw-alias-border-l2",
              "--dsw-alias-label-primary",
              "--dsw-alias-label-secondary",
              "--dsw-specific-sidebar-fill"
            ]) {
              const value = appearance.palette[key];
              if (typeof value === "string" && CSS.supports("color", value))
                document.body.style.setProperty(key, value);
            }
            if (Number.isFinite(appearance.codeFontSize))
              document.body.style.setProperty(
                "--dsh-code-font-size",
                `${Math.max(10, Math.min(24, appearance.codeFontSize))}px`
              );
          }
          if (
            (language === "zh" || language === "en") &&
            ctx.locale.getSnapshot().active !== language
          )
            void ctx.configForms
              .get("settings.locale")
              .set("preference", language)
              .catch(report);
        };
        function report(error) {
          console.error("[metaverse]", error);
          notify({
            type: "error",
            message: error instanceof Error ? error.message : String(error)
          });
        }
        window.addEventListener("message", readMessage);
        const unsubscribe = bridge?.subscribe((data) =>
          readMessage({ source: window.parent, origin: parentOrigin, data })
        );
        ctx.effect(() => () => {
          window.removeEventListener("message", readMessage);
          unsubscribe?.();
          navigation.abort();
          for (const face of fonts.values()) document.fonts.delete(face);
          for (const request of toolRequests.values()) {
            clearTimeout(request.timeout);
            request.reject(new Error("智能体界面已关闭。"));
          }
          toolRequests.clear();
        });
        const style = document.createElement("style");
        style.textContent = `
        html,body,#root{height:100%;margin:0}.mv-shell{height:100dvh;display:flex;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base,transparent)}
        .mv-sessions{width:230px;flex:none;display:flex;flex-direction:column;border-right:1px solid var(--dsw-alias-border-l1,#8883);min-height:0;padding:18px 10px 8px;gap:12px}
        .mv-sessions>button,.mv-top button,.mv-dialog header button{font:inherit;border:1px solid #8883;background:transparent;color:inherit;border-radius:9px;padding:8px 12px;cursor:pointer}.mv-sessions>button{flex:none}.mv-sessions-list{min-height:0;flex:1;overflow:hidden;display:flex;flex-direction:column}
        .mv-import-status{font-size:12px;color:#db6565;white-space:pre-wrap;padding:0 4px}.mv-sessions>button:disabled{opacity:.55;cursor:default}
        .mv-center{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;position:relative}.mv-main{flex:1;min-height:0;overflow:hidden}.mv-top{display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;flex:none}.mv-right{width:36%;min-width:300px;position:relative}.mv-right:empty{display:none}
        .mv-settings{height:100%;overflow:auto;padding:8px 20px 28px}.mv-settings-inner{max-width:1100px;margin:auto}.mv-backdrop{position:fixed;inset:0;background:#0006;z-index:2000;display:grid;place-items:center}.mv-dialog{background:var(--dsw-alias-bg-base,#222);border:1px solid #8884;border-radius:14px;padding:22px;width:min(580px,90vw);max-height:85vh;overflow:auto;box-shadow:0 16px 60px #0005}.mv-dialog header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.mv-dialog label{display:flex;justify-content:space-between;align-items:center;padding:14px 0}.mv-error{color:#db6565;padding:12px;white-space:pre-wrap}.mv-sessions-list>div{min-height:0;flex:1}
        [class$="_headline"]:has([class$="_fishHitbox"]){display:none!important}
      `;
        document.head.append(style);
        ctx.effect(() => () => style.remove());
        const PluginPage = createPluginPage(React, ctx, {
          apiSource: pluginApi,
          useSource,
          openConfiguration: () => notify({ type: "open-configuration" }),
          primitives: require("@deepseek-ai/dsh-client-ui-primitives")
        });
        function SettingsDialog({ renderSlot, close }) {
          const form = ctx.configForms.get("ui-settings");
          const state = useSource(form);
          const dialog = useRef(null);
          useEffect(() => {
            const previous = document.activeElement;
            const key = (e) => {
              if (e.key === "Escape") close();
              if (e.key !== "Tab") return;
              const controls = [
                ...dialog.current.querySelectorAll(
                  'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'
                )
              ].filter((el) => el.getClientRects().length);
              const first = controls[0],
                last = controls.at(-1);
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
              }
            };
            document.addEventListener("keydown", key);
            return () => {
              document.removeEventListener("keydown", key);
              previous?.focus();
            };
          }, [close]);
          return h(
            "div",
            {
              className: "mv-backdrop",
              onMouseDown: (e) => {
                if (e.target === e.currentTarget) close();
              }
            },
            h(
              "section",
              {
                className: "mv-dialog",
                ref: dialog,
                role: "dialog",
                "aria-modal": true,
                "aria-label": t("会话设置")
              },
              h(
                "header",
                null,
                h("strong", null, t("会话设置")),
                h(
                  "button",
                  {
                    onClick: close,
                    "aria-label": t("关闭会话设置"),
                    autoFocus: true
                  },
                  t("关闭")
                )
              ),
              renderSlot(
                "settings.general.item",
                {},
                { only: "transcript-view" }
              ),
              h(
                "label",
                null,
                t("显示代码工作视图"),
                h("input", {
                  type: "checkbox",
                  checked: state.value?.enabled === true,
                  disabled: !state.writable,
                  onChange: (e) => {
                    void form.set("enabled", e.target.checked).catch(report);
                  }
                })
              ),
              renderSlot(
                "settings.general.item",
                {},
                { only: "composer-enter" }
              )
            )
          );
        }
        function Root({ renderSlot }) {
          useSource(ctx.locale);
          const state = useSource(nav),
            [settingsOpen, setSettingsOpen] = useState(false),
            [importing, setImporting] = useState(false),
            [importError, setImportError] = useState("");
          const importInput = useRef(null);
          useEffect(() => setSettingsOpen(false), [state.screen]);
          const isAssistant = state.screen === "assistant";
          const importSession = async (file) => {
            if (!file) return;
            setImporting(true);
            setImportError("");
            try {
              if (!file.name.toLowerCase().endsWith(".zip"))
                throw new Error("请选择导出的 ZIP 会话文件。");
              const response = await fetch("/api/metaverse.session.import", {
                method: "POST",
                headers: { "content-type": "application/zip" },
                body: file
              });
              const result = await response.json();
              if (!response.ok)
                throw new Error(result.error || "导入会话失败。");
              await ctx.get("sessions").refresh();
              ctx.get("uiWorkspace").openSession(result.sessionId);
            } catch (error) {
              setImportError(
                error instanceof Error ? error.message : String(error)
              );
            } finally {
              setImporting(false);
              if (importInput.current) importInput.current.value = "";
            }
          };
          return h(
            "div",
            { className: "mv-shell" },
            isAssistant &&
              state.sidebar &&
              h(
                "aside",
                {
                  className: "mv-sessions",
                  "aria-label": t("助手会话"),
                  inert: settingsOpen || undefined
                },
                h(
                  "button",
                  { onClick: () => ctx.get("uiWorkspace")?.startSession() },
                  t("＋ 新建会话")
                ),
                h("input", {
                  ref: importInput,
                  type: "file",
                  accept: ".zip,application/zip",
                  hidden: true,
                  onChange: (event) =>
                    void importSession(event.target.files?.[0])
                }),
                h(
                  "button",
                  {
                    disabled: importing,
                    onClick: () => importInput.current?.click()
                  },
                  t(importing ? "正在导入" : "导入会话")
                ),
                importError &&
                  h(
                    "div",
                    { className: "mv-import-status", role: "alert" },
                    importError
                  ),
                h(
                  "div",
                  { className: "mv-sessions-list" },
                  renderSlot("sidebar.workspaces", {
                    wide: true,
                    expandSidebar: () => update({ sidebar: true })
                  })
                )
              ),
            h(
              "main",
              { className: "mv-center", inert: settingsOpen || undefined },
              isAssistant
                ? h(
                    "div",
                    { className: "mv-top" },
                    h(
                      "button",
                      {
                        onClick: () => layout.toggleSidebar(),
                        "aria-label": t("切换会话列表")
                      },
                      t("会话")
                    ),
                    h(
                      "button",
                      { onClick: () => setSettingsOpen(true) },
                      t("会话设置")
                    )
                  )
                : null,
              h(
                "div",
                { className: "mv-main" },
                state.screen === "models" || state.screen === "presets"
                  ? h(
                      "div",
                      { className: "mv-settings" },
                      h(
                        "div",
                        { className: "mv-settings-inner" },
                        renderSlot(
                          "settings.section",
                          {
                            close: () => {
                              notify({ type: "navigate", screen: "assistant" });
                              go("assistant");
                            }
                          },
                          {
                            only:
                              state.screen === "models"
                                ? "models"
                                : "agent-presets"
                          }
                        )
                      )
                    )
                  : state.screen === "plugins"
                    ? h(PluginPage, { renderSlot })
                    : renderSlot(
                        "main",
                        {},
                        { entryKey: state.activePanelId || "conversation" }
                      )
              )
            ),
            isAssistant &&
              h(
                "aside",
                {
                  className: "mv-right",
                  style: state.fullscreen
                    ? {
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        zIndex: 100
                      }
                    : {
                        width: state.rightbar && state.track ? "36%" : "0",
                        minWidth: state.rightbar && state.track ? "300px" : "0"
                      }
                },
                renderSlot("rightbar", {
                  width: 450,
                  viewportWidth: innerWidth,
                  canShow: true
                })
              ),
            renderSlot("shell.overlay", {}),
            settingsOpen &&
              h(SettingsDialog, {
                renderSlot,
                close: () => setSettingsOpen(false)
              })
          );
        }
        const children = {
          "sidebar.workspaces": { kind: "single", scope: "root" },
          "sidebar.settings": { kind: "single", scope: "root" },
          "sidebar.brand.mark": { kind: "single", scope: "root" },
          "sidebar.brand.name": { kind: "single", scope: "root" },
          "sidebar.toggle.badge": { kind: "single", scope: "root" },
          "sidebar.panellist": { kind: "list", scope: "root" },
          "sidebar.footer.action": { kind: "list", scope: "root" },
          sidebar: { kind: "single", scope: "root" },
          main: { kind: "keyed", scope: "root" },
          rightbar: { kind: "single", scope: "root" },
          "shell.bottom": { kind: "single", scope: "root" },
          "shell.overlay": { kind: "list", scope: "root" },
          "shell.leading": { kind: "single", scope: "root" },
          "settings.launcher": { kind: "single", scope: "root" },
          "settings.trigger": { kind: "single", scope: "root" },
          "settings.header": { kind: "single", scope: "root" },
          "settings.action": { kind: "list", scope: "root" },
          "settings.close": { kind: "single", scope: "root" },
          "settings.section": { kind: "list", scope: "root" },
          "settings.onboarding": { kind: "list", scope: "root" },
          "settings.general.item": { kind: "list", scope: "root" }
        };
        class Guard extends Component {
          state = { error: null };
          static getDerivedStateFromError(error) {
            return { error };
          }
          componentDidCatch(error) {
            report(error);
          }
          render() {
            return this.state.error
              ? h(
                  "div",
                  { className: "mv-error", role: "alert" },
                  String(this.state.error)
                )
              : this.props.children;
          }
        }
        ctx.slots.register({ name: "root", children }, (props) =>
          h(Guard, null, h(Root, props))
        );
        // Sidebar supplies session-browser child declarations; its chrome remains unmounted.
        ctx.slots.inject("conversation.hero.brand.mark", () =>
          ctx.slots.register(
            { name: "conversation.hero.brand.mark", priority: -100 },
            () => null
          )
        );
        // Keep the model-facing tool instructions, but render the sent user
        // message with the same compact label used in the composer.
        ctx.inject(["uiConversation"], (child) => {
          child.uiConversation.userText.register({
            id: "metaverse-tool",
            order: -100,
            match(text, from) {
              if (from !== 0) return undefined;
              const request = parseToolRequest(text);
              return request
                ? { id: "metaverse-tool", start: 0, end: text.length, data: request }
                : undefined;
            }
          });
        });
        ctx.slots.inject("conversation.user.text.node", () =>
          ctx.slots.register(
            { name: "conversation.user.text.node", key: "metaverse-tool", priority: 100 },
            ({ node }) =>
              h(
                React.Fragment,
                null,
                h("span", { style: { color: "#6fa8ff" } }, `/${node.data.name}`),
                node.data.task ? ` ${node.data.task}` : ""
              )
          )
        );
        ctx.slots.inject("sidebar.workspaces.session.menu.item", () =>
          ctx.slots.register(
            {
              name: "sidebar.workspaces.session.menu.item",
              id: "metaverse-delete",
              order: 450
            },
            function DeleteSession({ sessionId, useMenuOpenState }) {
              useSource(ctx.locale);
              const [, setMenu] = useMenuOpenState();
              const Button =
                require("@deepseek-ai/dsh-client-ui-primitives").MenuItemButton;
              return h(
                Button,
                {
                  onSelect: () => {
                    setMenu(false);
                    if (
                      window.confirm(
                        t("删除这个会话？会话将从列表移除，可以在归档中恢复。")
                      )
                    )
                      void ctx
                        .get("uiWorkspace")
                        .archiveSession(sessionId, { stopActivity: true })
                        .catch(report);
                  }
                },
                t("删除会话")
              );
            }
          )
        );
        ctx.inject(["commandUi", "sessions", "conversation", "remote.session"], (child) =>
          child.commandUi.register({
            name: "tool",
            label: () => t("工具"),
            description: () => t("选择工具管理中的工具"),
            icon: () =>
              h(
                "svg",
                {
                  viewBox: "0 0 24 24",
                  width: 20,
                  height: 20,
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: 1.8,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  "aria-hidden": true
                },
                h("path", { d: "M4 7h16M4 12h16M4 17h16" }),
                h("circle", { cx: 8, cy: 7, r: 2, fill: "currentColor" }),
                h("circle", { cx: 16, cy: 12, r: 2, fill: "currentColor" }),
                h("circle", { cx: 10, cy: 17, r: 2, fill: "currentColor" })
              ),
            available: (session) => {
              const binding = child.sessions.binding(session.sessionId);
              return (
                binding !== undefined &&
                child.conversation.input.for(binding.ctx).state.getSnapshot()
                  .claim?.name !== "tool"
              );
            },
            ui: {
              kind: "popupSelect",
              searchLabels: () => ({
                placeholder: t("搜索工具…"),
                empty: t("没有可用的工具"),
                noResults: t("没有匹配的工具")
              }),
              async options() {
                return (await listTools()).map((tool) => ({
                  id: tool.id,
                  label: tool.name,
                  detail: tool.description
                }));
              },
              async onSelect(option, session) {
                const tool = (await listTools()).find(
                  (item) => item.id === option.id
                );
                if (!tool) throw new Error("所选工具已不存在，请重新选择。");
                const binding = child.sessions.binding(session.sessionId);
                if (!binding) throw new Error("当前会话已关闭。");
                const input = child.conversation.input.for(binding.ctx);
                const claim = createToolClaim(
                  tool,
                  session.sessionId,
                  child.sessions,
                  child.conversation,
                  child.remote.session
                );
                if (!beginToolCommand(input, claim))
                  throw new Error("无法在当前输入框中选择工具，请重试。");
              }
            }
          })
        );
        ctx.inject(["inputTriggers", "sessions", "conversation", "remote.session"], (child) =>
          child.inputTriggers.registerSource(
            createToolRestoreSource(
              listTools,
              child.sessions,
              child.conversation,
              child.remote.session
            )
          )
        );
        ctx.inject(
          ["uiWorkspace", "workspaces", "sessions", "remote.workspace"],
          (child) => {
            void (async () => {
              if (workspacePath) {
                await child.workspaces.create({ path: workspacePath });
              }
              notify({ type: "ready" });
            })().catch(report);
          }
        );
        ctx.inject(["connection"], (child) => {
          let connected = false,
            timer;
          const changed = () => {
            const state = child.connection.state.getSnapshot();
            clearTimeout(timer);
            if (state === "connected") connected = true;
            else if (connected)
              timer = setTimeout(
                () =>
                  notify({
                    type: "error",
                    message: "智能体连接已断开，请重新启动智能体。"
                  }),
                5000
              );
          };
          const stop = child.connection.state.subscribe(changed);
          changed();
          return () => {
            stop();
            clearTimeout(timer);
          };
        });
      }
    };
  }
});

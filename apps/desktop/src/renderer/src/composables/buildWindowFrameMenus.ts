import type {
  WindowFrameMenu,
  WorkspaceWindowActions
} from "./windowFrameMenus";
export function buildWindowFrameMenus(
  actions: WorkspaceWindowActions
): WindowFrameMenu[] {
  return [
    {
      label: "文件",
      options: [
        {
          value: "create",
          label: "新建作品",
          description: "Ctrl+N",
          disabled: actions.busy()
        },
        { value: "open", label: "打开作品…", disabled: actions.busy() },
        { value: "settings", label: "设置…" }
      ],
      run(value) {
        if (value === "create" && !actions.busy()) actions.create();
        if (value === "open" && !actions.busy()) return actions.open();
        if (value === "settings") return actions.settings();
      }
    },
    {
      label: "视图",
      options: [
        {
          value: "left",
          label: actions.leftCollapsed() ? "显示目录侧栏" : "隐藏目录侧栏"
        },
        {
          value: "right",
          label: actions.rightCollapsed() ? "显示文稿面板" : "隐藏文稿面板",
          disabled: !actions.canToggleRight()
        },
        { value: "appearance", label: "外观与主题…" }
      ],
      run(value) {
        if (value === "left") actions.toggleLeft();
        if (value === "right" && actions.canToggleRight())
          actions.toggleRight();
        if (value === "appearance") return actions.settings("appearance");
      }
    },
    {
      label: "帮助",
      options: [{ value: "keyboard", label: "键盘快捷键…" }],
      run: () => actions.settings("keyboard")
    }
  ];
}

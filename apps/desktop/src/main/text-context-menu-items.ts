import type { ContextMenuParams } from "electron";
import type {
  TextContextMenuAction,
  TextContextMenuContext
} from "@deepwrite/contracts";

export interface TextMenuItem {
  action?: TextContextMenuAction;
  label?: string;
  enabled?: boolean;
  accelerator?: string;
  type?: "separator";
}

export function fallbackTextContext(
  params: ContextMenuParams
): TextContextMenuContext {
  return {
    kind: params.isEditable
      ? "editable"
      : params.selectionText && params.editFlags.canCopy
        ? "selection"
        : "none",
    password: params.formControlType === "input-password",
    hasSelection: Boolean(params.selectionText),
    hasText: params.editFlags.canSelectAll,
    canInsertReference: false
  };
}

export function buildTextMenuItems(
  params: ContextMenuParams,
  context: TextContextMenuContext,
  hasClipboardText: boolean,
  platform: string
): TextMenuItem[] {
  if (context.kind === "none") return [];
  const flags = params.editFlags;
  const selected = context.hasSelection || Boolean(params.selectionText);
  const item = (
    action: TextContextMenuAction,
    label: string,
    enabled: boolean,
    accelerator?: string
  ): TextMenuItem => ({
    action,
    label,
    enabled,
    ...(accelerator ? { accelerator } : {})
  });
  const separator = (): TextMenuItem => ({ type: "separator" });
  const copy = item(
    "copy",
    "复制",
    selected && flags.canCopy && !context.password,
    "CommandOrControl+C"
  );
  const selectAll = item(
    "selectAll",
    "全选",
    context.hasText,
    "CommandOrControl+A"
  );
  const items: TextMenuItem[] =
    context.kind === "editable"
      ? [
          item(
            "undo",
            "撤销",
            context.history?.canUndo ?? flags.canUndo,
            "CommandOrControl+Z"
          ),
          item(
            "redo",
            "重做",
            context.history?.canRedo ?? flags.canRedo,
            platform === "darwin" ? "Command+Shift+Z" : "Control+Y"
          ),
          separator(),
          item(
            "cut",
            "剪切",
            selected && flags.canCut && !context.password,
            "CommandOrControl+X"
          ),
          copy,
          item(
            "paste",
            "粘贴",
            flags.canPaste && hasClipboardText,
            "CommandOrControl+V"
          ),
          item("delete", "删除", selected && flags.canDelete),
          separator(),
          selectAll
        ]
      : context.kind === "readonly"
        ? [copy, separator(), selectAll]
        : [copy];
  if (context.canInsertReference && selected && !context.password) {
    items.unshift(item("insertReference", "插入输入框", true), separator());
  }
  if (
    context.kind === "editable" &&
    context.canAddIllustration &&
    !context.password
  ) {
    items.push(separator(), item("addIllustration", "新增插画", true));
  }
  return items;
}

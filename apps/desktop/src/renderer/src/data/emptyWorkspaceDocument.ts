import type { WorkspaceDocument } from "../types/workspace";

export const EMPTY_WORKSPACE_DOCUMENT: WorkspaceDocument = {
  id: "deepwrite-empty-workspace",
  domain: "creation",
  title: "尚未打开书籍",
  eyebrow: "创作空间",
  path: ["尚未打开书籍"],
  content: "请从左侧点击“新建书籍”，或打开一个已存在的元宇宙书籍文件夹。",
  readOnly: true,
  format: "设定"
};

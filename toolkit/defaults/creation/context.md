# 创作上下文操作

技能库保存写作方法，素材库保存参考内容，它们都是外部 Agent 按需读取的上下文。用户继续通过虚拟世界界面手动管理，也可以由你通过本工具维护。

## 关联工具

[创作空间操作](workspace.md)负责本书索引和文件操作。上下文 CLI 复用本工具的 `runtime/context-engine.mjs`；`bookContext` 内部调用创作空间引擎读取约束和小说概要。

## 调用

```sh
node /工作目录/tools/creation/context-cli.mjs --input /请求.json
```

默认工作目录由工具位置推导，也可传 `--workdir /工作目录`。`--input -` 支持 stdin，stdout 返回 JSON，失败返回非零退出码。

| action | input 与用途 |
| --- | --- |
| list | `{}` 列出工作目录 skills/materials 下的库以及 libraries.json 中的外部库，仅返回目录和条目索引 |
| bookContext | `{"bookDirectory":"/小说目录"}` 获取本书约束、概要和可用资料目录 |
| read | `{"libraryDirectory":"/资料库目录"}` 返回概览与条目索引；加 `entryId` 读取指定条目全文与版本 |
| schema | `{"name":"saveEntry"}` 获取管理操作的完整 JSON Schema |
| createLibrary | 根据 schema 创建库，自动保存到工作目录 skills/ 或 materials/ |
| createEntry / saveEntry / deleteEntry / updateLibrary | 先查看 schema，再传 `libraryDirectory` 与对应字段；domain 和 libraryId 由工具识别，不能自行伪造 |

编辑条目时保留读取结果的内容 revision 和 projectRevision，并按 schema 使用 baseRevision/baseProjectRevision，避免覆盖别人刚保存的内容。新库由应用发现；已有外部库继续使用原路径。`libraries.json` 可以编辑，以增加或移除外部库目录。

## 管理与加载方法

1. 先查看库和条目索引，按当前任务选择少量相关条目，再读取正文。不要每次把全部技能、素材和全部历史正文都塞入上下文。
2. 新资料先查重，决定新建、补充或整合已有条目；保留来源、适用条件和用户原有分类。素材中的创作事实只在用户明确采用后成为本书设定。
3. [技能管理规则](skill-management.md)与[素材管理规则](material-management.md)保存原资料管理提示词及方法。把其中旧的内置工具名对应到本 CLI 的操作；不再创建或调用资料管理子智能体。
4. 整理本书上下文时，按需调用创作空间操作的 index/read/character.read。优先读取最近接续包、当前角色记录和涉及的设定，历史正文只在需要核实时补读。
5. 修改后重新读取验证，并报告实际文件位置。不要伪造资料来源或把模型推测当作用户确认事实。

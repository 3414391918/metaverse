# 创作空间操作

需要 Node.js 24 或更新版本。代码全部在创作工具目录内，`cli.mjs` 为入口，`runtime/` 为可编辑的共享文件引擎。运行不依赖 Electron、IPC、桌面应用注册表或模型配置。

## 调用

```sh
node /工作目录/tools/creation/cli.mjs --book /小说目录 --input /请求.json
```

`--input -` 可从 stdin 接收 JSON；输出为 JSON，失败时错误输出到 stderr 并返回非零退出码。所有目录使用绝对路径。请求格式是 `{"action":"index","input":{}}`。

## 操作

| action | input 与用途 |
| --- | --- |
| schema | `{"name":"apply"}` 获取某个动作的完整 JSON Schema，不需要 `--book` |
| create | `{"parentDirectory":"/工作目录/books","title":"新小说","genre":"玄幻"}` 创建兼容小说，不需要 `--book` |
| index | `{}` 读取小说索引和稳定 ID；结构文件路径、人物、卷、剧情点、章卡、正文和账本都在索引中 |
| read | `{"fileId":"索引中的文件ID"}` 默认完整读取，返回内容和哈希；`full:false` 时支持 offset/limit 分页 |
| write | `{"fileId":"文件ID","content":"完整新内容","expectedSha256":"read 返回的哈希"}` 保存 Markdown；哈希可选，提供时检查较新修改 |
| search | `{"query":"关键词","fileIds":["文件ID"]}` 搜索指定文件；支持返回的 resume 继续查询 |
| preview / apply | input 直接是结构操作 batch；涵盖世界观、人物分类与人物、卷、剧情点、章卡、文件和关联。先读取 schema |
| writeChapter | 根据 schema 成组保存章卡对应的正文、章末状态和接续包 |
| commitChapter | 根据 schema 创建章节连续性记录；支持当前格式中的 structured、text_files 与 text_files_batch 模式 |
| deleteLedgerCommit | 根据 schema 删除连续性提交并清理关联 |
| character.read | `{"characterId":"人物ID"}` 读取核心档案、关系、状态和历史以及 revision |
| character.create | `{"group":"index 中的分类 ID","name":"人物名称","faceDescription":"脸部身材描述","settingDescription":"角色设定描述","appearances":[{"name":"初始形象","description":"形象文本描述"}]}` 创建人物和核心档案；先查 schema |
| appearance.add | `{"characterId":"人物ID","name":"新形象","description":"形象文本描述","expectedRevision":"character.read 返回的 revision"}` 新增形象并准备独立目录；不处理形象图片描述 |
| character.save | `{"characterId":"人物ID","profile":{},"expectedRevision":"读取的revision"}` 用完整档案保存，先查看 schema |
| appearance.prepare | 根据 schema 准备独立形象目录 |
| appearance.delete | 根据 schema 物理删除指定形象及资产，调用前确认用户的删除范围 |
| character.assets | `{"characterId":"人物ID"}` 列出该角色各形象资产的绝对路径、标签与是否可读取；生成插图时把相关路径作为图片参考传给生图工具 |
| illustration.references | `{"chapterCardId":"章卡ID"}` 列出该章正文已引用插图的绝对路径、附近文字与可用状态；先 `search` 定位此前出现的场景再调用 |
| illustration.add | `{"chapterCardId":"章卡ID","imagePath":"/本地图片.png","expectedSha256":"read 返回的哈希","offset":123}` 原子保存 PNG 并在正文位置插入相对引用；先查看 schema |
| illustration.delete | `{"chapterCardId":"章卡ID","filename":"001.png","expectedSha256":"read 返回的哈希","offset":123}` 删除该位置的图片引用；无其它引用时同时删除图片文件。先用 `read` 和 `illustration.references` 定位并核对 |
| agents.read / agents.write | 读取本书创作约束；写入使用 `{"content":"完整约束"}` |

schema 中的 `bookId` 由 CLI 根据 `--book` 自动填入，不需要手动提供。结构 batch 的 `updatedAt` 使用当前 ISO 时间。删除等有影响的变更先执行 preview，检查结果后把返回的 confirmation 作为 expectedImpact 加入同一 batch 再 apply。

全书故事线属于全书；剧情点属于卷；章卡属于章。使用稳定 ID，不能因为页面标题变化而创建重复实体。保持现有 `deepwrite.json` 和 `long/` 文件组织，结构修改通过引擎更新索引，不手改索引冒充成功。

角色形象图片写入对应形象的独立目录，并更新其 `assets.json`；正文插画保留 `images/001.png` 这样的章节相对引用。`illustration.add` 接受绝对路径的 PNG，依现有编号规则将图片和引用一同保存；不需要剪贴板或 Electron。图片像素比例由生成端根据内容决定。系统剪贴板、文件选择弹窗、声音平台和模型密钥属于应用界面能力，不是本 CLI 的功能。

## 验证

修改后重新调用 index/read，检查实体和文件状态。应用检测到外部文件变动时会提示用户重新加载并合并未保存的编辑；新建小说和资料库放在工作目录的 books/skills/materials 下，可由应用发现。原书的 AGENTS.md 和用户已保存文件继续生效。

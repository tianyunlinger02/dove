# Installation

Dove 3.0.0 使用两层安装：

1. 为当前用户安装一个可信的精确 Dove artifact，使 `dove` 位于 `PATH`；
2. 在每个 Claude Code 项目中显式初始化。

公共 npm 上名为 `dove` 的包与本项目无关。不要把 bare `npm install -g dove`、bare `npx dove` 或源码入口当作消费者安装方法。

## Requirements

- Node.js `>=22`
- npm
- Claude Code（当前完整支持的项目初始化路径）
- `uvx`（仅在项目需要论文搜索、公开下载或全文阅读时使用；Dove 不自动安装）

OpenCode、Codex、Cursor 和共享 agent adapters 可以随包发布，但其存在不代表注册、连接或完整初始化已经可用。

## 用户级安装

```bash
npm install --global <exact-dove-package-specifier>
```

使用可信的精确 tarball、Git revision 或内部 registry version。用户级安装只把 `dove` 放到 `PATH`，不会修改项目、shell startup、host trust、凭据或研究文档。

## Claude 项目初始化

在目标项目运行：

```bash
dove init --host claude
```

初始化会建立：

- `.dove/install/manifest.json`（revision `2.0`）；
- `.claude/commands/dove/` 下的十个 Skill adapters；
- Claude Reviewer、ambient rule、隐藏 intake 和隐藏 paper-search support Skill；
- `.claude/settings.json` 中 Dove 的 prompt 与 stop hook fragments；
- `.mcp.json#/mcpServers/dove-paper-search`；
- `.dove/research/` 下完整默认 Markdown 研究树和六个通用 Lessons 主题。

初始化不会：

- 安装 `uv`、Python 或第三方 Python package；
- 写 API key、email、token 或其他凭据；
- 自动批准 project MCP、workspace trust 或 host 权限；
- 创建研究进度、Mission、Claim、实验结果或科学结论；
- 把 runtime bundles 复制进项目。

初始化后离开并重新进入 Claude Code，让新会话加载项目资源。第一次使用 project MCP 时，由用户在 Claude Code 中批准。

## 论文获取 MCP

Dove 只管理一个共享配置 fragment：

```text
.mcp.json#/mcpServers/dove-paper-search
```

它固定使用外部 `paper-search-mcp==0.1.4`，通过本机已有 `uvx` 启动。Dove 不包含该 Python package，不注册用户级 server，也不批准 trust。

对不公开来源，获取能力仍取决于合法访问条件。`download_with_fallback` 若被使用，必须显式传入：

```json
{"use_scihub": false}
```

没有 shell/CLI fallback。

## 安装 metadata 与反馈

```text
.dove/install/
├── manifest.json
└── DOCTOR.md     # 可选，宿主自然维护
```

Manifest 记录 package、选定 hosts、managed resources 和 lifecycle 所需 timestamps。`DOCTOR.md` 记录用户对 Dove 的明确反馈，以及 Dove 自身 Skill、hook、项目接入、路由、文档行为或 guidance 的实际故障。

`DOCTOR.md` 是普通自然语言 Markdown，没有 JSON state、issue ID、status、severity、counter、frontmatter 或固定模板。它不是研究日志或科学 health score，用户不需要为了反馈运行 `dove doctor`。

Managed-file hashes 只保护安装字节，不能作为来源 identity、研究证据或科学验证。

## 项目与文件边界

Dove 在修改项目前解析一个真实 project root，并拒绝越界、symlink 或不明确的 managed paths。

初始化和更新遵守：

- 普通项目文件不修改；
- shared JSON 中其他 fields、hooks 和 MCP servers 保留；
- 现有内容与期望完全相同时可以直接认领；
- 缺失的 managed file、hook 或 paper-search selector 会重建；
- 项目中已有的不同内容会阻止自动覆盖；
- 每个目标写入前检查当前状态，失败时执行普通 rollback。

这些是项目内容保护，不是科研严谨性或科学证明。

## Update

```bash
dove update
dove update --host claude
```

`update` 同时刷新已识别的项目接入和研究默认文档：

- 缺失默认文件从 package 的完整内容创建；
- 现有默认文件保留原有 bytes，并精确追加缺失的 canonical paragraphs 或 navigation lines；
- 普通 topic documents 和项目中已有的不同内容不重排、不归一化、不覆盖；
- 支持显式 revision `1.0` installation manifest 的一次更新；不通过历史文件猜测安装状态。

没有单独 `sync` 或 `upgrade` 命令，也没有长期兼容 fallback。

## One-time research export

```bash
dove export-research
```

`export-research` 只用于支持的 legacy Dove JSON research records 到普通 Markdown 的一次性转换。它先显示预览；确认后写入 `.dove/research/`，并把原始 JSON bytes 归档到 `.dove/archive/...`。

边界：

- 不转换 v1 research state；
- 正常 Dove 3 工作不读取旧 JSON fallback；
- `init`、`update`、Doctor 和 hooks 不会隐式 export；
- 对真实研究数据执行 export 需要单独用户授权，不能当作普通测试 fixture；
- 无法在不臆造含义的情况下转换时，应保留源文件并停止。

## Complete Reinstall

```bash
dove reinstall
```

Complete Reinstall 会当场读取并展示当前项目中的删除与替换范围，确认默认值为 No。

确认后它重新读取当前项目并执行当前计划：删除自定义 Dove 研究内容和旧归档，重建当前项目接入与完整默认研究树。普通项目文件和 shared JSON 中与 Dove 无关的内容保留；用户级 npm 安装不受管理。

这是破坏性项目重置。只需要刷新接入或补齐默认文档时使用 `dove update`。

## Doctor

```bash
dove doctor
dove doctor --json
```

Doctor 是面向开发排查的只读命令，检查当前软件 bundle、项目接入和 Markdown 外层可读性。它不修复文件，不拥有 `DOCTOR.md`，也不判断研究结论、完成度、复现性或 Reviewer 独立性。用户通常无需运行。

## CLI inventory

```text
init, update, reinstall, doctor, export-research, hook
```

Hooks：

```text
dove hook user-prompt-submit --project <project-root>
dove hook stop --project <project-root>
```

没有 `mcp`、`sync`、`upgrade`、Workspace、Mission database 或 `migrate-research` 命令。

## Maintainer validation

从源码仓库运行：

```bash
npm run check
npm run release:check
npm run pack:dry-run
```

生命周期行为应通过 repository-local `.claude/tmp/` 下的隔离 synthetic project 走真实 CLI 验证。除非另有授权，不对真实研究项目执行 install、update、reinstall 或 export。

这些检查只验证软件发布边界，不证明科学正确、研究完成、复现性、论文接受或独立评审。

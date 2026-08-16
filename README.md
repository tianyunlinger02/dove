# Dove

Dove 3.0.0 是一个本地优先的科研辅助推进系统。宿主模型使用正常的文件、编程、执行和研究工具完成真实工作；Dove 提供精简的 Skills、角色边界、项目接入，以及用普通 Markdown 保存研究上下文的方式。

Dove 区分三种责任：

- **Planner**：梳理目标、范围、关键未知、证据需要和停止条件。
- **Builder/Author**：负责研究、编码、实验、写作、图表、修订与 rebuttal。
- **Reviewer**：在用户管理的单独评审中，只读检查明确声明的材料范围并返回 Markdown。

宿主输出、测试、本地检查和 Review 返回都只是有限证据，不能单独证明科学正确、研究完成、论文可接受或 Reviewer 独立。

## 当前架构

Dove 3.0.0 包含：

- **10 个扁平 Skills**：`research`、`status`、`source`、`experiment`、`draft`、`figure`、`review`、`rebuttal`、`lessons`，以及只能显式调用的 `auto`；
- **3 个角色**：Planner、Builder/Author、Reviewer；
- Claude、OpenCode、Codex、Cursor 和共享 agent 格式的生成适配器；
- 项目生命周期 CLI、Claude prompt hook 与 stop hook；
- **3 个独立 Node.js bundles**：library、CLI、prompt hook。

Dove 3 没有研究状态 MCP server、研究数据库、工具注册表或隐藏的机器研究状态。Claude 项目可以按需使用固定版本的外部 `paper-search-mcp==0.1.4` 获取论文，但它不是 Dove 的研究数据库。

## 安装与项目初始化

要求：Node.js `>=22`、npm；当前完整支持的项目初始化路径是 Claude Code。

公共 npm 上名为 `dove` 的包与本项目无关。请安装可信的精确 tarball、Git revision 或内部 registry 版本：

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove init --host claude
```

初始化会安装 Claude Skills、Reviewer 与 ambient 资源、prompt/stop hooks、论文获取 MCP 声明、`.dove/install/manifest.json`，并建立默认 Markdown 研究树。它不会安装 Python、写入凭据、批准 MCP trust，也不会制造研究进度、Mission 或科学结论。

重新进入 Claude Code 后即可使用 Dove。

## 十个 Skills

| Skill | 用途 |
|---|---|
| `research` | 完成一次有边界的研究、综合或项目调查。 |
| `status` | 只读查看当前研究概览和相关文档。 |
| `source` | 搜索、获取、阅读、核对并记录真实来源。 |
| `experiment` | 设计、执行、分析或诚实记录实验。 |
| `draft` | 基于现有证据创建或修改普通项目文稿。 |
| `figure` | 收集真实材料，制作或修改图表与 caption。 |
| `review` | 准备、导入或查看用户管理的单独 Review。 |
| `rebuttal` | 根据真实 Review findings 完成作者侧回应与修订。 |
| `lessons` | 按需读取或维护通用 Lessons。 |
| `auto` | 在已记录主线内进行显式、多轮、高自主研究。 |

例如：

```text
/dove:research 比较当前实现和文档设计，找出最重要的未解决问题。
```

普通清晰工作请求可以由隐藏 intake 路由到最小合适 Skill；路由本身零写入，而且永远不会选择 Auto。

## 普通 Markdown 研究树

初始化建立：

```text
.dove/research/
├── RESEARCH.md
├── missions/MISSIONS.md
├── experiments/EXPERIMENTS.md
├── sources/SOURCES.md
├── reviews/REVIEWS.md
├── claims/CLAIMS.md
└── lessons/
    ├── LESSONS.md
    └── 六个通用主题文档
```

这些是研究者维护的普通 Markdown 入口，不是数据库、生成索引或科研完成证明。其他文件使用自然名称，并在有帮助时从汇总文档链接。

Dove 不要求固定 headings、frontmatter、ID、enum、hash、机器索引、条目计数或统一模板。

- `RESEARCH.md` 保持当前主线、重要进展、结论边界、链接和优先级简洁可恢复。
- Mission、Source、Experiment、Review 和必要时的 Claim 都是自然文档，不是 entity store。
- 新执行的实验先写计划，再把实际过程、结果、失败或偏差和解释追加到同一份 Experiment 文档。
- Review 的声明范围、prompt 和用户取得的实际返回保存在同一份 Review 文档；作者处理只在用户要求时添加，实质回应和修订属于 Rebuttal。
- Lessons 是可质疑的建议，不是证据或权限。

## 理论与证据

当问题或路线尚未明确时，先发散探索不同解释和方案，再比较重要候选，不直接投入第一个看似可行或最容易的方案。理论与证据冲突时，重新审视理论、实验和路线本身，选择最能澄清分歧的下一步，而不是默认继续增加实验。

## Status、Review 与 Auto

- `status` 只读。缺少 overview 或链接失效时，它自然说明事实，不创建文件，也不推断数据库状态。
- Review 是用户管理的单独交换。Dove 不启动、冒充或认证 Reviewer；内置 Reviewer 角色只提供责任分离，不能证明独立性。
- `auto` 只能显式调用。它把已记录主线作为只读方向边界；如果主线缺失、明显不完整或需要改变，Auto 返回建议并停止，不会暗中重定义研究方向。

## CLI

```text
init, update, reinstall, doctor, export-research, hook
```

- `init`：建立 Claude 项目接入和完整默认研究树。
- `update`：刷新已识别的项目接入，并以精确追加方式补齐缺失的默认 Markdown；项目中已有的不同内容不覆盖。
- `reinstall`：先展示删除和替换范围，默认 No；确认后重建 Dove 项目内容，保留普通项目文件。
- `doctor`：只读的开发排查命令，不判断科研质量。用户明确点名 Dove 的反馈和 Dove 自身实际故障写入 `.dove/install/DOCTOR.md`；未点名 Dove 的普通科研或协作反馈中，可复用的经验进入 Lessons。
- `export-research`：显式、一次性把支持的旧 JSON research records 导出为 Markdown，并归档原始字节；真实科研数据需要单独授权。
- `hook`：提供 Claude prompt 与 stop hooks。

没有 `dove sync`、`dove mcp`、Workspace 命令或 research database CLI。

## 论文获取

Claude 项目初始化只管理 `.mcp.json#/mcpServers/dove-paper-search`，固定到 `paper-search-mcp==0.1.4`，通过用户已有的 `uvx` 运行。Dove 不自动安装依赖、不写 API key/email/token、不批准 workspace trust，也不提供 shell fallback。首次使用 project MCP 时由用户在 Claude Code 中批准。

## 文档与验证

- [Documentation index](docs/README.md)
- [Installation](docs/INSTALL.md)
- [Usage](docs/USAGE.md)
- [Packaging](docs/PACKAGING.md)
- [Capability matrix](docs/CAPABILITY_MATRIX.md)
- [Output samples](docs/DOVE_COMMAND_OUTPUT_SAMPLES.md)

源码仓库使用 `npm run check` 做常规软件检查，`npm run release:check` 做发布检查，`npm run pack:dry-run` 查看发布归档。这些检查只说明软件边界，不证明科研结论、完成度、复现性或 Reviewer 独立性。

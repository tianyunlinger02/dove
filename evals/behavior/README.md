# Dove 行为评估

这些案例来自已记录的 Dove 使用反馈，用于观察实际宿主中的科研判断与行动。它们不是科研质量评分器，不属于 npm 发布包，也不是默认 release gate。

## 运行

```bash
npm run behavior:validate
npm run behavior:eval -- --list
npm run behavior:eval -- --run-real --case stale-summary-current-manuscript
```

- `behavior:validate` 是按需运行的离线证据卫生检查：验证案例可加载、公开证据解析、最小执行终态、工件快照和一个标准库合成实验程序。它不调用模型，不初始化或安装 Dove。scratch 限于 `evals/behavior/.scratch-*` 并在结束时清理；合成程序需要已有 Python 3，不自动安装。
- 默认 `npm run check` 不调用行为验证。行为 corpus 可独立演进，不能因为 runner 自检细节而阻断软件发布。
- `behavior:eval` 没有 `--run-real` 时不会调用模型。真实运行必须明确授权；`release:check` 不会运行它。
- 默认使用当前 Claude Code 的模型配置；可用 `--model` 明确指定。非交互临时项目默认 `acceptEdits`，仍遵守实际宿主权限与安全 hook，不接受 bypass 模式。
- 每次把 `min(case budget, --max-budget-usd override)` 作为 Claude 的 `--max-budget-usd` 传入。预算终止或公开费用超过该值均不是成功；不要自动增加预算取得通过。

完整案例以 `--list` 为准。案例继续覆盖纯判断后停止、正文进展、理论路线前置、当前 Review、图的实质审查、外部 grounding 缺失、程序错误与科研负结果的区分、central execution 前置计划与同文档追加、本地 Source 复合主张，以及 Figure 修改、渲染、视觉检查和返回可编辑源文件。

## 临时项目与公开证据

真实运行只使用授权的合成 fixture，不安装到用户环境或同步真实科研项目：

- 模型工作目录：仓库内 `.claude/tmp/w-*`。
- 公开证据：`.claude/tmp/dove-behavior-evals/r-*`。
- 每次在证据目录建立仅供该子进程使用的 `bin/dove`，指向当前源码 CLI。父进程 PATH、用户安装、权限和信任配置不变。
- `receipt.json` 只关联 case、attempt、时间、最小预算/权限事实、执行结果、证据路径和 hard checks，不把精确 argv、PATH、stderr 摘要、逐模型费用或宿主错误 taxonomy 当成科研质量合同。
- 原始公开 stream、stderr、主助手答复、工具动作和前后快照分别保存，便于人工复核。

只采集 CLI 公开输出，不读取宿主私有 transcript。主助手答复排除用户消息、Skill 文本、工具返回、思考内容和子代理文本。`tool-actions.json` 中的工具名与引用路径只是人工 evidence hint：工具输入提到路径不证明读取成功、程序执行、视觉打开或文件修改，也不是访问审计。

## 最小机器判断

运行真实性只保留以下 hard facts：

1. direct main-assistant 的公开结果非空；没有公开最终结果不能称完成。
2. spawn 失败、非零退出、signal、主 result error、预算终止/超额或缺少主终态不能形成成功结果。
3. 权限拒绝记录为动作未发生的事实；若随后走获准替代路径，整体是否完成仍由公开终态和实际工件决定。
4. `path-exists`、`path-changed`、`path-unchanged`、`path-not-created` 由 before/after snapshot 证明工件边界。成功终态不能覆盖相反的文件事实。

自然语言关键词和 `tool-action-path` 不再作为 hard gate。`expectedBehavior` 与 human rubric 继续描述需要检查的科学材料和判断，但不会因为某个工具序列、路径字符串或固定措辞自动通过。

central execution 必须由计划快照、结果工件和人工复核确认“先保存 prospective plan，再执行，再向同一 Experiment 文档追加真实结果”。Figure 必须由源文件变化、光栅工件和人工复核确认实际渲染与视觉检查；Read SVG XML 或输出中出现文件名都不能替代这些事实。程序配置失败、科学负结果、readiness 和主线选择同样保留在各案例 rubric 中，不由 runner receipt 代判。

发现解析错误时保留原始公开证据，可将离线重算写入另一目录。重算不是重新运行，也不能抹去原运行中的预算、权限或宿主失败。

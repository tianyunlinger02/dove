# Dove 行为评估

这些案例来自已记录的 Dove 使用反馈，观察实际宿主中的科研判断与行动；它们不是科研质量的自动评分器，也不属于 npm 发布包。

## 运行

```bash
npm run behavior:validate
npm run behavior:eval -- --list
npm run behavior:eval -- --run-real --case stale-summary-current-manuscript
```

- `behavior:validate` 只检查案例、公开证据解析和运行收据，不调用模型。
- `behavior:eval` 没有 `--run-real` 时不会调用模型。真实运行需要明确授权；`release:check` 不会运行它。
- 默认使用当前 Claude Code 的模型配置；可用 `--model` 明确指定。非交互临时项目默认 `acceptEdits`，仍遵守实际宿主权限与安全 hook，不接受 bypass 模式。
- 每次把 `min(case budget, --max-budget-usd override)` 作为 Claude 的 `--max-budget-usd` 传入。宿主可能在一轮结算后才停止，实际费用仍可能超过该值；收据保留观察到的费用和超额事实，评估按失败退出。不要自动增加预算来取得通过。

案例包括纯判断后停止、正文进展、投稿主线、当前 Review、图的实质审查、外部 grounding 缺失、程序错误与科研负结果的区分，以及旧恢复摘要与当前稿件的真实冲突。完整列表以 `--list` 为准。

## 临时项目与证据

真实运行只使用授权的合成 fixture，不安装到用户环境或同步真实科研项目：

- 模型工作目录：仓库内 `.claude/tmp/w-*`，保持较短以适应宿主 Unix socket 路径限制。
- 公开证据：`.claude/tmp/dove-behavior-evals/r-*`。
- 每次在证据目录建立 `bin/dove` 启动入口，只为该模型子进程前置 PATH，指向当前源码 CLI；避免新 fixture 的 SessionStart 意外调用已安装的旧版本。父进程 PATH、用户安装、权限和信任配置不变。
- `receipt.json` 关联上述路径、实际参数、预算和执行结果。证据还包括原始公开 stream、stderr、主助手答复、工具动作及前后文件快照。

只采集 CLI 公开输出，不读取宿主私有 transcript。主助手答复不包含用户消息、Skill 加载文本、工具返回、思考内容或子代理文本；工具动作不等于工具执行成功，写入是否发生仍需查快照和公开结果。

## 判断结果

执行失败、超额或任一 hard check 失败，命令以非零状态退出。全部 hard checks 通过也不代表科学判断正确：仍须按 case 的人评 rubric 阅读实际答复、工具结果和文件变化，区分实质进展、仅说明计划、权限阻塞及不完整运行。

旧摘要案例以普通共享笔记呈现恢复线索，与当前稿件和科学批评构成冲突；不把答案写进用户 prompt，也不模拟私有对话。是否正确重选主线和质疑旧 readiness 判断，由人根据材料评审。

发现解析错误时保留原始 stream 与 receipt，可将离线重算写入另一证据目录。重算不等于重新运行，也不能抹去原运行中的预算、权限、旧 CLI 或其他宿主问题。

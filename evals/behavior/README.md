# Dove 行为评估

这些案例来自已记录的 Dove 使用反馈，观察实际宿主中的科研判断与行动；它们不是科研质量的自动评分器，也不属于 npm 发布包。

## 运行

```bash
npm run behavior:validate
npm run behavior:eval -- --list
npm run behavior:eval -- --run-real --case stale-summary-current-manuscript
```

- `behavior:validate` 只检查案例、公开证据解析、运行收据、离线 fake CLI spawn 和一个标准库合成实验程序，不调用模型，也不初始化或安装 Dove。验证 scratch 限于 `evals/behavior/.scratch-*` 并在结束时清理。合成程序验证需要已有 Python 3，不自动安装。
- `behavior:eval` 没有 `--run-real` 时不会调用模型。真实运行需要明确授权；`release:check` 不会运行它。
- 默认使用当前 Claude Code 的模型配置；可用 `--model` 明确指定。非交互临时项目默认 `acceptEdits`，仍遵守实际宿主权限与安全 hook，不接受 bypass 模式。
- 每次把 `min(case budget, --max-budget-usd override)` 作为 Claude 的 `--max-budget-usd` 传入。宿主可能在一轮结算后才停止，实际费用仍可能超过该值；收据保留观察到的费用和超额事实，评估按失败退出。不要自动增加预算来取得通过。

案例包括纯判断后停止、正文进展、理论路线前置、当前 Review、图的实质审查、外部 grounding 缺失、程序错误与科研负结果的区分，以及旧恢复摘要与当前稿件的真实冲突。本轮有限补充 central execution 的前置计划/同文档追加、本地 Source 复合主张部分支持，以及真正 `/dove:figure` 修改可编辑图、渲染并打开光栅、返回源文件。完整列表以 `--list` 为准。

已有 DOCTOR 引文只复用案例中已摘录的文本，不重新读取真实项目反馈。理论、central 和 Figure 的合成延展在 `extension` 中标明；没有对应 DOCTOR 摘录的 Source 缺口引用已提供的用户审计请求，明确区分用户原话、批准计划和合成研究情境。案例不要求用户创建 DOCTOR 或永久记账。

## 临时项目与证据

真实运行只使用授权的合成 fixture，不安装到用户环境或同步真实科研项目：

- 模型工作目录：仓库内 `.claude/tmp/w-*`，保持较短以适应宿主 Unix socket 路径限制。
- 公开证据：`.claude/tmp/dove-behavior-evals/r-*`。
- 每次在证据目录建立 `bin/dove` 启动入口，只为该模型子进程前置 PATH，指向当前源码 CLI；避免新 fixture 的 SessionStart 意外调用已安装的旧版本。父进程 PATH、用户安装、权限和信任配置不变。
- `receipt.json` 关联上述路径、实际参数、预算和执行结果。证据还包括原始公开 stream、stderr、主助手答复、工具动作及前后文件快照。

只采集 CLI 公开输出，不读取宿主私有 transcript。主助手答复不包含用户消息、Skill 加载文本、工具返回、思考内容或子代理文本；工具动作不等于工具执行成功，写入是否发生仍需查快照和公开结果。

## 判断结果

进程失败、公开主会话 result 错误、权限拒绝、预算超额、缺失终态或任一 hard check 失败，命令以非零状态退出。退出码 0 本身不代表成功；预算耗尽 subtype 即使费用未高于上限也会失败。费用只取公开主会话终态的 `total_cost_usd`，不把分模型费用、工具材料或子代理字段当作总费用。未提供有效总费用时保留 `null`，不伪称已核验费用；出现权限拒绝的运行即使之后返回 success 也需人核，不能作为无阻塞完成。

`expectedBehavior` 是人评预期，不是隐式 hard gate。其全部声明路径、显式 snapshot 路径以及 hard expectation 路径都会进入前后快照，以便观察原先未捕获的禁止写路径。快照保留存在性、类型、大小和字节摘要，不复制宿主私有对话。只有 `hardExpectations` 会计算机器检查结果。

当前案例的 hard checks 限于答复非空、返回的工件路径、工具输入中的路径引用和快照变化。已移除科学结论、readiness、视觉质量以及对否定/引用敏感的自然语言关键词门槛，也不固定要求某个宿主工具。路径引用不是成功读取、执行或视觉打开的证明；路径提取也不是完备的访问审计。全部 hard checks 通过仍须按人评 rubric 阅读公开工具返回和实际文件：central 必须确认计划成功写在 run 前并将真实结果追加到同文档，Figure 必须确认修改后实际渲染并视觉打开最终光栅。合并在一次合法脚本或宿主动作中的正确实现同样可接受，不用固定工具序列拒绝它们。科学支持、理论推导和视觉质量始终人评；Read SVG XML 不能充当视觉检查。

旧摘要案例以普通共享笔记呈现恢复线索，与当前稿件和科学批评构成冲突；不把答案写进用户 prompt，也不模拟私有对话。是否正确重选主线和质疑旧 readiness 判断，由人根据材料评审。

发现解析错误时保留原始 stream 与 receipt，可将离线重算写入另一证据目录。重算不等于重新运行，也不能抹去原运行中的预算、权限、旧 CLI 或其他宿主问题。

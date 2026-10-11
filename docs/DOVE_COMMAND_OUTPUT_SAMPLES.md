# Dove command output samples

These examples show output shapes, not mandatory templates, live project observations, or scientific guarantees. Human CLI prose is Chinese; commands, paths, JSON keys, and enums remain exact. JSON modes return one direct result without a prose wrapper. Piped output omits mascot art and ANSI styling.

## Project setup

```text
Dove 已在此项目启用

项目  example-project
宿主  Claude Code

✓ Dove 与 9 个可选专项入口已安装；导师和论文审稿使用原生只读子 agent
✓ SessionStart 与 UserPromptSubmit 上下文展示已配置；状态栏空缺时安装只读显示
✓ 论文检索 MCP 与网页 Exa MCP 已声明
✓ 最小研究入口 RESEARCH.md 已建立
✓ 项目集成记录已建立

科研记录由主会话维护：IDENTITY.md、EVAL.md、rounds/。已有 missions、experiments、claims 保留原地。
两个中文短要点已安装；当前主 agent 在实质工作前亲自读取，完整内容仅按需查阅。安装本身不代表模型已经读过。

下一步  从项目进入 Claude Code，直接说明目标；/dove:* 是可选快捷入口。外部来源工具的批准仍由你决定。
```

If the research tree already exists, setup reports that it was preserved, not that a missing overview was created. Init/update output describes integration, not an already-confirmed goal or completed research round.

## Ordinary conversation

Ordinary Claude is the complete primary entrance. The optional agent/Skills add no authority or permissions. A question in an active round can be answered without closing it:

```text
用户：现在为什么还没做好？

已有开发集结果，但未见类别这一列没有改善，核心泛化还没证明。最近两轮只修了已见样本，继续加同类分支不能回答目标。现有判断是下一步针对共同原因换方法，不是继续加样本特例。
```

A bounded explanation-only request can finish without research records or execution. If the user explicitly asks to pause:

```text
用户：先别做，只讨论。

这次只讨论原因，不继续运行或修改方法。
```

Ending the reply needs no card edit, new round result or mentor call.

## One-time kickoff confirmation

This example is hypothetical, not an observed user confirmation:

```text
按你的原话重建，部署时输入未见类别的图像，输出共享对应关系；目标是提高跨类别成功率，而不是增加类别特例。对照是同输入强基线，完成含义也包括你要求的耗时。

请确认这份立项理解。确认后导师据此定义覆盖全部指标和泛化的 EVAL，不再另请你批准初始评测；修正评测会重算历史对照，只有改变目标含义才需再确认。
```

## Mentor brief

Use a fresh read-only mentor when requested or when kickoff, methods, evaluation, measured results or the route need independent judgment; reuse existing judgments without new material. It reads the specified records and actual artifacts, not the execution conversation. Save returned briefs verbatim. Shape-only example:

```text
作者：导师

上一轮：开发集成功率从 74% 到 81%，未见类别仍为 46%。原预测未见类别会到 55%，实际没对上。读到的改动只给两类输入加分支，没解决跨类别对应关系；继续这族补丁价值不大。

下一轮：用共享对应关系替换类别分支，检验失败是否来自局部规则无法组合。依据是失败样例在相同连接处出错，而不是类别本身不同。预测开发集保持约 80%，未见类别到 55–60%；这是待验证预测，不是已观测结果或通过线。

完成标志：按已确认协议跑完这两列，把实际值写进 EVAL。负结果也算本轮结果；单元测试通过不算。方法仍在已确认主线和资源内，不需重新批准。

实际读过的文件：IDENTITY.md、EVAL.md、rounds/002-brief.md、rounds/002-result.md、src/mapping.py。
```

The mentor's paper-level eight-dimensional assessment belongs in `EVAL.md` after important results. The main session saves that returned judgment rather than duplicating it with a self-score. Missing evidence remains unknown, not zero.

## Round result and evaluation row

The result is a few lines, not another long report. Hypothetical example:

```text
改动：src/mapping.py 移除类别分支，使用共享连接映射；scripts/evaluate.py 未改。
结果：开发集 80%，未见类别 57%；完整输出见 artifacts/round-003.json。
预测对照：开发集约 80%、未见类别 55–60%，本轮实际落在预测范围；还未完成最终 heldout 确认。
```

Append one measured row under the agreed columns:

```markdown
| Time | Round | Dev success | Unseen-category success |
|---|---|---|---|
| 2026-10-05 | 003 | 80% | 57% |
```

Briefs identify their actual author as mentor, user, or external. New core records use `rounds/`, not new `missions/`, `experiments/`, or `claims/` entries. Historical files stay in place; `RESEARCH.md` is only a short history index.

## Four-sentence status

Status reads the card, last evaluation rows, and current brief, without running evaluation or filling unknowns:

```text
共享映射已实现，开发集结果为 80%。
未见类别从 46% 到 57%，有进展，但还没达到已确认的整体完成标准。
当前卡点是长尾连接失败，最终 heldout 结论尚未取得。
正在执行导师给出的下一轮，针对共同失败原因改对应关系，再按同一评测表取结果。
```

Status may end the reply without completing or pausing the round. Progress comes from actual research evidence, not a Git branch, timestamp or test pass.

## Bounded identity and compact/resume

Keep the current fields at the top of the card, within its first 4KB:

```text
Current round: rounds/004-brief.md
Round status: ongoing
Mainline: <用户确认的原话>
```

Compact/resume presents this same short card and continuity guidance, not a timestamp summary of old Mission/Review/Run records. If overlong, the beginning remains visible:

```text
Identity card exceeds 4KB; the beginning is shown, not a missing card. Read the full card when needed and shorten it without changing Mainline; keep round details in rounds/ and measurements in EVAL.md.
```

Startup/clear instead supplies the two-essentials read bootstrap. Hooks present context; they do not prove reading, write research, or perform mentor judgment.

## Repeated cross-project correction

The suggestion is one sentence, not an automatic preference edit:

```text
其他已注册项目也出现过“不要按样本写特例”的纠正，要不要把它加进全局 AUTHOR_PREFERENCES？
```

## Paper review

Author-side self-check keeps its boundary clear:

```text
这是作者侧科学自检，不是独立 dove-review。Figure 3 支持趋势，但当前材料不足以证明因果机制；需要检查能区分替代解释的证据。
```

Native `dove-review` reads the specified current manuscript and cited results with only Read/Grep/Glob in a fresh context. No frozen snapshot or persistent runtime is needed. A shape-only return:

```text
总体判断：当前证据还不足以支持全文的机制主张。

实质问题：第 4 节把整套方法增益解释为组件因果效应，但 Table 2 的两个实现还改变了输入信息。需要匹配信息条件的比较，或把结论限定到实际识别的整套方法效果。

依据：paper/main.tex 第 4 节；results/ablation.csv 的 input 条件。
建议作者：先判断比较是否能识别该主张，再选择有效补证据或修订，不能用格式检查代替。

实际读过的文件：paper/main.tex、build/main.pdf、results/ablation.csv。
```

The main session preserves the actual return when useful and assesses its objections before authorized response/revision. A supplied external review retains its real provenance. Revisions need a fresh review of the full current version; an old recommendation is historical, not current acceptance. Unavailable native review is stated, not replaced by relabeled self-check.

## Run receipt output

`dove run` records execution facts, not scientific conclusions:

```text
Dove run 已启动

项目：/workspace/example-project
运行记录：run-20260903-a1b2c3d4
状态：started
Supervisor PID：12345
命令：node scripts/diagnostic.mjs
工作目录：/workspace/example-project
seed（用户声明）：seed-42
Git：commit 0123456789abcdef0123456789abcdef01234567；dirty false
日志：.dove/runs/run-20260903-a1b2c3d4/run.jsonl
stdout：.dove/runs/run-20260903-a1b2c3d4/stdout.log
stderr：.dove/runs/run-20260903-a1b2c3d4/stderr.log
```

`status` is read-only; `resume` never reruns a target. `compare` ranks only compatible terminal finalized runs by metric/budget/data/evaluator/resource basis. Git facts do not change ranking. For `start`, flags after `--` belong to the target command, not Dove output selection.

## Error result

Parser errors preserve exact command/flag names while explaining plainly:

```text
Dove 不能继续：--direction 只接受 min 或 max。
```

If JSON was requested before `--`:

```json
{
  "status": "blocked",
  "message": "--direction 只接受 min 或 max。"
}
```

Operational errors name the real limit and next step without exposing private transcripts or irrelevant internal fields:

```text
Dove 不能继续：当前项目没有有效的 .dove/install/manifest.json，无法判断 Dove 管理的项目集成。
下一步：确认这是目标项目后，显式运行 dove init --host claude；不要从这里推断或修复其他项目的安装。
```

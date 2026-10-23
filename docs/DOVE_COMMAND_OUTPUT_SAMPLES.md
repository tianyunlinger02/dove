# Dove command output samples

These examples show output shapes, not mandatory templates, live project observations, or scientific guarantees. Human CLI prose is Chinese; commands, paths, JSON keys, and enums remain exact. JSON modes return one direct result without a prose wrapper. Piped output omits mascot art and ANSI styling.

## Project setup

```text
Dove 已在此项目启用

项目  example-project
宿主  Claude Code

✓ Dove 与 7 个可选专项入口已安装；导师和论文审稿使用原生只读子 agent
✓ Claude SessionStart、UserPromptSubmit 与 Stop 已配置；状态栏空缺时安装只读显示
✓ 论文检索 MCP 与网页 Exa MCP 已声明
✓ 最小研究入口 RESEARCH.md 已建立
✓ 项目集成记录已建立

科研记录由主会话维护：IDENTITY.md、EVAL.md、rounds/。已有 missions、experiments、claims 保留原地。
已安装：操作说明 .claude/rules/dove.md、用户最常说的话 .dove/install/AUTHOR_PREFERENCES.md、研究标准 .dove/install/RESEARCH_QUALITY.md；作者偏好全文按需查阅。
新会话和 /clear 后，主会话本人先读“用户最常说的话”；研究标准到对应时刻再查。已打开的会话在下一条消息时收到一次更新提示，重读操作说明和“用户最常说的话”。安装本身不代表模型已经读过。

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

## Topic choice and direct judgments

Hypothetical shape, not a real candidate or user choice. Paper IDs below stand for actual full-text-grounded notes, not fabricated references:

```text
缺口：已有方法通过 Y 做 X，但 Y 留下 Z；依据为已读正文的 [论文A]、[论文B] 各自未解决之处。
证明补上它的观察：能区分 Z 与其它原因的比较。

一句话：把来源领域的机制 M 用于这个缺口。
缺口：上面的 Z。
来源机制：[来源论文]；M 在原处依赖条件 P。
对应关系：本问题中的 U 扮演原问题的 V。
成立前提：P 在这里也成立；证据与未知另列。
近邻差别：与已读 [最近邻论文] 的具体差别。
最大风险：P 可能不成立。
评审结论：修改
修改焦点：对应关系
最强反对：U 与 V 的关键结构未对应，见正文位置与检索证据。
```

Search according to the key unknowns and actively challenge novelty; query and field counts are breadth strategies, not quotas. Ground the judgment in sources and the strongest objection, and compare coordinated changes or alternatives when weaknesses share a cause. Recommend the best 2–3 choices, or one without padding. In actual topic selection, implementation waits for choice; already-authorized bounded work is not recast as selection. Clear choices need no reconfirmation.

```text
用户：达到要求了吗？

没达到。未见类别成功率仍为 57%，未达到你要求的 70%；耗时达标。最终留出确认也还没做。
```

## Mentor brief

At a decision point (a round's verdict, an overrun or stall, a new method design, or the user's request), generate the call with `dove mentor brief --project <root>`; use `--trigger` for the reason, sourced `--user-original` for direct words, `--opinion` / repeatable `--artifact` for attachments, and `--watch` when the user asks for a paper-watch review within the week. The generator supplies materials, the facts Dove computed and fixed questions, not a model call. The computed facts look like:

```text
## Dove 算出的事实

- 当前轮次：第 4 轮（rounds/004-brief.md，尚无结果）。
  对准：数据与评价；见分晓：2026-10-25（开始 2026-10-20）；规模：445 对全量，噪声约 1.5 点。
- 最近几轮的判定（只按结果文件开头的“判定：”读取）：
  - 第 3 轮：对准 方法质量与可行性；判定 未兑现（未见类别 46%→48%，低于预期的 55%）。
- 主指标：事件 F1（445 对真实开发集，官方评分）；当前最好：11.5（2026-10-22，第 3 轮）
- 八维走势：共 2 次判断；最近一次 2026-10-22（第 3 轮），最卡的一维 数据与评价。
- 最近 14 天的活动量：子代理调用 63 次，上下文压缩 9 次；同期出结果的轮次 1 个（未兑现）。
- 等用户定的事：
  - 是否把 494 对保留集留到最终确认。
```

Shape-only return:

```text
作者：导师

三问：这段时间的实质进展是确认了强对照在真实开发集上的位置；最近的工作主要在修评价，没有检验核心方法；离最终结果还差一个在真实评测上胜过强对照的方法，按现在的做法还要两轮以上，更快的路是先在同协议下跑通任务匹配的强对照。

判定核对：第 3 轮写的成败标准是未见类别到 55%，实际 48%，判定“未兑现”成立。

八维判断：| 2026-10-22 | 第 3 轮 | 3 | 1 | 未知 | 2 | 2 | 2 | 2 | 2 | 数据与评价 |
依据：……

下一轮说明：
Author: mentor（v4；用户来源 2026-10-21）
对准：数据与评价
见分晓：2026-10-25（开始：2026-10-22）
规模：445 对全量……
一句话：……
## 预期结果
……

研究状态：……（约 300 字白话）

导师笔记：
- 上次预测未见类别 55%，实际 48%，没兑现；类别分支这一族放弃，原因是……
- 可迁移：先在真实开发集上对齐最强外部方法，再判断新模块收益。
### 待用户决定
- 是否把 494 对保留集留到最终确认。

实际读过的文件：IDENTITY.md、EVAL.md、rounds/003-brief.md、rounds/003-result.md、src/mapping.py。
```

The main session appends the notes verbatim, copies the research state onto the card and appends the trend row to EVAL. Missing evidence remains unknown, not zero.

## Round result and evaluation row

Hypothetical example:

```markdown
判定：未兑现（未见类别 48%，低于说明里写的 55%）

一句话：共享映射在开发集上保持，但没解决未见类别。
## 改了什么
v3：src/mapping.py 用共享连接映射替换类别分支。
## 测到了什么
开发集 80/100 件，未见类别 48/100 件；artifacts/round-003.json。
## 预期与实际
预期未见类别 55–60%，实际 48%；判断改变：失败不来自类别分支，下一轮转向评价协议本身。离最终结果没有更近。
## 对本轮说明的反驳与事实更正
无。
```

The top of EVAL:

```markdown
主指标：未见类别正确件数（eval.py，dev-unseen 100 件）；当前最好：48/100 件（2026-10-22，第 3 轮）

| 日期 | 轮次 | 问题价值 | 创新 | 机制与理论 | 方法质量与可行性 | 数据与评价 | 实现 | 实验与证据价值 | 表达与交付 | 最卡的一维 |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-22 | 第 3 轮 | 3 | 1 | 未知 | 2 | 2 | 2 | 2 | 2 | 数据与评价 |

| Date | Version/round | Protocol/split | Measurements | Unseen data/train-test gap | Conclusion | Artifacts |
|---|---|---|---|---|---|---|
| 2026-10-22 | v3 / 003 | eval.py / dev-unseen | dev 80/100 件 | unseen 48/100 件；差 32 件 | 未兑现 | [结果](rounds/003-result.md) |
```

Briefs identify their actual author as mentor, user, or external. New core records use `rounds/`, not new `missions/`, `experiments/`, or `claims/` entries. Historical files stay in place; `RESEARCH.md` is only a short history index.

## Status example

Status reads the card, the main metric and trend, recent method versions and the current brief, without running evaluation or filling unknowns. Illustrative, not a template:

```text
主指标还停在 48/100 件（第 3 轮），离用户要的“明显超过最强外部方法”还差一个真实可比的方法。
第 4 轮对准“数据与评价”：在同一协议下跑通任务匹配的强对照，10-25 见分晓。
卡点是评价协议还没和外部方法对齐，第 3 轮的数字只能算开发信号。
```

## Status line

```text
Opus (200K) · ctx 61% · main · 1h12m · 部分可观测重访图像的事件级联合证据推断与描述
第4轮 · 对准 数据与评价 · 10-25 见分晓 · 主指标 事件 F1 11.5（第3轮）
/home/user/project
```

## Stop prompt

When the host ends a turn on a stall, once:

```text
【Dove 引用用户 10-23 的原话】“先整理一下，哪些是我们现在立刻就能做，但之前一直没有做且非常重要的，……”

第 2、3 轮的判定都是未兑现，其间没有方法取舍。请按这句话整理一遍，然后停下来用一页决定备忘问用户：继续当前方法（附理由）、换方法（至少给一个不是从当前方法改出来的方法族，可以来自其他领域解同构问题的做法），还是换方向。……这段话是 Dove 根据记录自动提出的，不是用户刚说的。
```

## Bounded identity and compact/resume

Keep the card short; its research state is about 300 plain-language characters written by the mentor. Point to the current method's existing brief:

```text
Current round: rounds/004-brief.md
Round status: ongoing
Mainline: <用户确认的原话>
Research state: <约300字，讲清当前结果、含义与缺口>
Method design: rounds/003-brief.md
Target tier: <用户要求的会议或期刊档次>
Deployment inputs/outputs: <实际输入输出>
Completion: <用户确认的完成含义>
User restrictions: <原话或转述、日期与来源、长期或本任务范围>
Recent corrections: <近期纠正>
```

Each user message and compact/resume place the recorded research state first, then the bounded card and this round's situation, not a generated summary of old records. Hooks never shorten or rewrite the state.

Startup/clear instead asks the main context to read the user's most frequent sayings. Hooks present context; they do not prove reading, write research, or perform mentor judgment.

## Recurring corrections

The dashboard's 纠正 page groups the user's own words of the last 30 days by topic, with counts per project and recent wording. It is input for Dove's development; the sayings change only with the user's agreement.

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

## Error result

Parser errors preserve exact command/flag names while explaining plainly:

```text
Dove 不能继续：--stop-prompts 只接受 on 或 off。
```

If JSON was requested:

```json
{
  "status": "blocked",
  "message": "--stop-prompts 只接受 on 或 off。"
}
```

Operational errors name the real limit and next step without exposing private transcripts or irrelevant internal fields:

```text
Dove 不能继续：当前项目没有有效的 .dove/install/manifest.json，无法判断 Dove 管理的项目集成。
下一步：确认这是目标项目后，显式运行 dove init --host claude；不要从这里推断或修复其他项目的安装。
```

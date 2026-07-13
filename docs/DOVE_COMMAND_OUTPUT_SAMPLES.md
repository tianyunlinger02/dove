# Dove Command Output Samples

This document shows what each public Dove command is intended to feel like in daily use after the UX pass. It focuses on the operator-facing output shape, not on complete raw JSON dumps.

Validation evidence from the pressure test run before this document was written:

```text
npm run check
1..214
# tests 214
# pass 214
# fail 0
```

## How to read these samples

Dove now separates two kinds of cards:

- Proposal cards are shown before mutation. They should make the conversion or selection clear and require explicit operator confirmation.
- Result cards are shown after confirmed work. They summarize what happened, what was written, what evidence exists, why execution stopped, and what the next suggested action is.

Default human-facing text is Chinese. Machine fields such as `surface`, `command`, `status`, `packetId`, and `presentation` stay in English.

A typical confirmed execution result card looks like this:

```json
{
  "presentation": "compact-result-summary-card",
  "surface": "dove.auto",
  "command": "run_dove_auto",
  "packetId": "sample-auto-run",
  "status": "completed",
  "happened": "已完成一次有证据的前台执行。",
  "durableWrites": [
    ".dove/task-packets/packets/sample-auto-run.json",
    ".dove/task-packets/index.json",
    ".dove/runtime/results.json",
    ".dove/runtime/events.json"
  ],
  "evidence": ["docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"],
  "validation": ["npm run check: pass 214/214"],
  "nextActions": [
    {
      "title": "查看当前状态和下一步",
      "command": "project:dove.status",
      "packetId": "sample-auto-run",
      "proposalOnly": true,
      "noAutoApply": true
    }
  ],
  "foreground": true,
  "background": false,
  "daemon": false,
  "proposalOnly": false,
  "confirmationRequired": false
}
```

## Command samples

### `dove.init`

Purpose: create or refresh the unique level-0 Dove goal for the workspace.

Example invocation:

```text
/dove:init 让 Dove 输出日常命令效果样本
```

Primary MCP tool:

```text
init_dove_goal
```

Representative output excerpt:

```json
{
  "ok": true,
  "task": {
    "id": "sample-init",
    "level": 0,
    "status": "ready",
    "title": "输出样本总目标",
    "domain": "engineering"
  },
  "taskCard": {
    "presentation": "compact-task-card",
    "packetId": "sample-init",
    "title": "输出样本总目标",
    "status": "ready",
    "level": 0
  },
  "writes": [
    ".dove/task-packets/packets/sample-init.json",
    ".dove/task-packets/index.json"
  ]
}
```

Daily effect:

- Establishes the durable root goal.
- Does not create hidden background work.
- Preserves the level-0 init task across later version resets.

### `dove.mission`

Purpose: convert a natural-language demand into one durable task contract, ask for confirmation, materialize it, and hand off to the recommended next workflow.

Example invocation:

```text
/dove:mission 整理一条命令输出样本
```

Primary MCP tools:

```text
create_dove_task
```

Before confirmation, the output is proposal-only:

```json
{
  "ok": true,
  "proposalOnly": true,
  "confirmationRequired": true,
  "writes": [],
  "proposedTask": {
    "id": "sample-mission-pass",
    "title": "整理命令输出样本",
    "stage": "execute",
    "level": 1,
    "status": "pending"
  },
  "taskCard": {
    "presentation": "compact-task-card",
    "packetId": "sample-mission-pass",
    "classification": "execute",
    "autonomousChecklistProposal": []
  },
  "confirmationChoices": [
    "approve and materialize the contract",
    "adjust conversion",
    "cancel"
  ]
}
```

After confirmation, the output reports only materialization and handoff routes:

```json
{
  "ok": true,
  "status": "materialized",
  "workflowMode": "mission-contract",
  "executionMode": "contract-handoff",
  "contractMaterialized": true,
  "foreground": false,
  "background": false,
  "daemon": false,
  "createdTask": {
    "id": "sample-mission-pass",
    "status": "ready"
  },
  "recommendedRoutes": [
    {
      "command": "project:dove.auto",
      "copyableCommand": "project:dove.auto --packet-id sample-mission-pass"
    }
  ],
  "handoffRoutes": [
    {
      "command": "project:dove.auto",
      "copyableCommand": "project:dove.auto --packet-id sample-mission-pass"
    }
  ]
}
```

Daily effect:

- Mission defines and materializes the task contract; it does not execute work or record a result during materialization.
- If later execution stops at a boundary, the execution flow's result card shows `boundary`, `ownerRole`, `nextRole`, required inputs/actions, and a handoff suggestion instead of pretending completion.

### `dove.auto`

Purpose: start from a demand or selected task, confirm the target, and run bounded foreground autonomy for up to the configured iteration budget.

Example invocation:

```text
/dove:auto Continue the current Dove UX improvement task for up to three foreground rounds
```

Primary MCP tool:

```text
run_dove_auto
```

Before confirmation, direct demand intake is proposal-only:

```json
{
  "ok": true,
  "proposalOnly": true,
  "confirmationRequired": true,
  "writes": [],
  "proposedTask": {
    "title": "自动补齐输出样本",
    "classification": "execute"
  },
  "autoCard": {
    "presentation": "compact-auto-card",
    "maxIterations": 3,
    "foregroundOnly": true,
    "hiddenBackgroundWork": false
  }
}
```

After a separate explicit confirmation, a normal evidence-backed completion may look like this. Mission handoff never starts or authorizes this run:

```json
{
  "ok": true,
  "result": {
    "status": "completed",
    "foreground": true,
    "background": false,
    "daemon": false,
    "iterations": [
      {
        "status": "completed",
        "output": {
          "summary": "完成自动样本补齐。",
          "evidenceLinks": ["docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"]
        }
      }
    ]
  },
  "resultCard": {
    "presentation": "compact-result-summary-card",
    "surface": "dove.auto",
    "command": "run_dove_auto",
    "packetId": "sample-auto-task",
    "status": "completed",
    "evidence": ["docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"],
    "nextActions": [
      { "command": "project:dove.status", "proposalOnly": true }
    ]
  }
}
```

Boundary output example:

```json
{
  "ok": true,
  "result": {
    "status": "awaiting-host-pass",
    "stopReason": "awaiting-host-pass-result",
    "boundary": {
      "type": "awaiting-host-pass",
      "ownerRole": "builder",
      "nextRole": "builder",
      "requiredActions": [
        "provide-host-pass-result",
        "provide-explicit-auto-step"
      ]
    }
  },
  "resultCard": {
    "status": "awaiting-host-pass",
    "requiresAction": true,
    "nextActions": [
      {
        "command": "record_dove_mission_pass",
        "boundaryType": "awaiting-host-pass",
        "ownerRole": "builder",
        "nextRole": "builder",
        "requiredActions": [
          "provide-host-pass-result",
          "provide-explicit-auto-step"
        ],
        "handoffSuggestion": {
          "presentation": "dove-handoff-suggestion",
          "boundaryType": "awaiting-host-pass"
        }
      }
    ]
  }
}
```

Daily effect:

- Auto can start directly from a demand; it does not require running `dove.mission` first.
- It never hides continuation in a daemon or scheduler.
- It stops explicitly at completion, step budget exhaustion, blocked state, review/provider boundary, or missing host evidence.

### `dove.status`

Purpose: act as the daily home screen: explain the live situation first, then show actionable Dove task state and optional status adjustments.

Example invocation:

```text
/dove:status
```

Primary MCP tools:

```text
query_dove_status
apply_dove_status_adjustments
```

Status query excerpt. Every query returns `writes: []` and cannot bootstrap, refresh, stage, or apply changes:

```json
{
  "ok": true,
  "proposalOnly": true,
  "noAutoApply": true,
  "writes": [],
  "dailyHome": {
    "presentation": "dove-daily-home",
    "headline": "现在是什么情况",
    "liveContext": {
      "source": "host-visible context",
      "summary": "先说明当前真实开发上下文，不把 .dove/ durable state 当作实时现场。"
    },
    "nextActions": [
      {
        "rank": 1,
        "title": "继续当前可执行任务",
        "command": "project:dove.auto",
        "proposalOnly": true
      }
    ]
  },
  "current": {
    "nextCommand": "project:dove.auto"
  },
  "suggestedNextCommand": "project:dove.auto",
  "adjustableMissions": [
    {
      "packetId": "sample-auto-task",
      "status": "ready",
      "allowedStatuses": [
        "pending",
        "ready",
        "in-progress",
        "blocked",
        "completed",
        "killed"
      ]
    }
  ],
  "boundaryActionCards": []
}
```

Status adjustment preview is proposal-only:

```json
{
  "ok": true,
  "proposalOnly": true,
  "confirmationRequired": true,
  "writes": [],
  "adjustmentCards": [
    {
      "presentation": "compact-status-adjustment-card",
      "packetId": "sample-auto-task",
      "fromStatus": "ready",
      "toStatus": "completed"
    }
  ]
}
```

Confirmed adjustment output:

```json
{
  "ok": true,
  "status": "applied",
  "applied": [
    { "packetId": "sample-auto-task", "status": "completed" }
  ],
  "resultCard": {
    "presentation": "compact-result-summary-card",
    "surface": "dove.status",
    "command": "apply_dove_status_adjustments",
    "status": "applied",
    "durableWrites": [
      ".dove/task-packets/packets/sample-auto-task.json",
      ".dove/task-packets/index.json",
      ".dove/runtime/events.json"
    ],
    "nextActions": [
      { "command": "project:dove.status", "proposalOnly": true }
    ]
  }
}
```

Daily effect:

- Completed and killed missions are not shown as adjustment targets.
- Counts and recent completed/killed recaps are intentionally not part of the user-facing status output.
- Status changes use a single confirmation dialog.

### `dove.operator`

Purpose: preview the queue, then run one confirmed foreground operator pass over safe internal steps and host results supplied only through canonical `taskResults[]`; host-result-required tasks without a matching result stay unchanged.

Example invocation:

```text
/dove:operator
```

Primary MCP tool:

```text
run_dove_operator
```

Preview output:

```json
{
  "ok": true,
  "proposalOnly": true,
  "confirmationRequired": true,
  "writes": [],
  "queueCards": [
    {
      "presentation": "compact-queue-card",
      "packetId": "sample-operator-task",
      "status": "ready",
      "queue": "autoRunnableTasks"
    }
  ],
  "autoRunnableTasks": ["sample-operator-task"],
  "hostPassRequiredTasks": []
}
```

Confirmed output:

```json
{
  "ok": true,
  "result": {
    "status": "completed",
    "updatedTaskIds": ["sample-operator-task"],
    "awaitingResultTaskIds": [],
    "foreground": true,
    "background": false,
    "daemon": false
  },
  "resultCard": {
    "presentation": "compact-result-summary-card",
    "surface": "dove.operator",
    "command": "run_dove_operator",
    "packetIds": ["sample-operator-task"],
    "status": "completed",
    "happened": "updated=1; awaiting-results=0; skipped-host-pass=0; blockers-created=0",
    "evidence": ["docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"],
    "nextActions": [
      { "command": "project:dove.status", "proposalOnly": true }
    ]
  }
}
```

Awaiting host-result output includes handoff metadata but does not change host-pass-required tasks unless a real task result or explicit host-tool-blocked result is supplied:

```json
{
  "resultCard": {
    "status": "awaiting-host-results",
    "nextActions": [
      {
        "command": "project:dove.status",
        "boundaryType": "awaiting-host-pass-result",
        "ownerRole": "builder",
        "nextRole": "builder",
        "requiredActions": ["provide-host-pass-result"],
        "handoffSuggestion": {
          "presentation": "dove-handoff-suggestion",
          "boundaryType": "awaiting-host-pass-result"
        }
      }
    ]
  }
}
```

Daily effect:

- Operator previews before mutation.
- It does not expose planner/builder/reviewer as separate slash commands.
- If it cannot verify host results, it records a boundary instead of claiming completion.

### `dove.lessons`

Purpose: query and record distilled operator lessons, not raw runtime traces.

Example invocation:

```text
/dove:lessons What should we remember from this Dove UX pass?
```

Primary MCP tools:

```text
query_operator_lessons
record_operator_lesson
```

Record output excerpt:

```json
{
  "ok": true,
  "lesson": {
    "id": "sample-lesson",
    "title": "输出卡片要看结果卡",
    "problem": "raw JSON 太难读",
    "decisions": ["展示 resultCard"],
    "pitfalls": ["不要把 resultCard 当确认卡"],
    "validation": ["npm run check: pass 214/214"],
    "nextTime": ["先看 resultCard.nextActions"],
    "status": "active"
  },
  "writes": [".dove/meta/operator-lessons.json"]
}
```

Query output excerpt:

```json
{
  "ok": true,
  "lessons": [
    {
      "id": "sample-lesson",
      "title": "输出卡片要看结果卡",
      "status": "active",
      "tags": ["ux"]
    }
  ]
}
```

Daily effect:

- Lessons are durable, explicit, and filtered by domain/status/tag when requested.
- They do not import hidden chain-of-thought or raw runtime dumps.

### `dove.version`

Purpose: create a direction-change snapshot and clear active non-init tasks while preserving the level-0 init goal and lessons.

Example invocation:

```text
/dove:version Start a clean direction snapshot for the command output UX pass
```

Primary MCP tool:

```text
reset_dove_version
```

Representative output excerpt:

```json
{
  "ok": true,
  "version": {
    "id": "sample-version-reset",
    "title": "命令输出样本方向快照",
    "reason": "展示 version reset 的效果"
  },
  "preserved": {
    "initGoal": "sample-init",
    "lessons": true
  },
  "clearedActiveTasks": [
    "sample-mission-pass",
    "sample-auto-task",
    "sample-operator-task"
  ],
  "writes": [
    ".dove/versions/lineage.json",
    ".dove/task-packets/index.json"
  ]
}
```

Daily effect:

- Version reset is for direction changes, not hidden cleanup.
- It should make the reset visible and preserve durable knowledge that remains valid.

### `dove.source`

Purpose: register provenance-aware external material as a candidate bound to one resolved task packet. Registration cannot issue positive verification.

Example invocation:

```text
/dove:source Register docs/DOVE_COMMAND_OUTPUT_SAMPLES.md as an internal source
```

Primary MCP tool:

```text
register_source
```

Representative output excerpt:

```json
{
  "ok": true,
  "source": {
    "id": "sample-source",
    "citationKey": "sample2026",
    "title": "Dove UX sample source",
    "sourceType": "internal-doc",
    "locator": "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md",
    "lifecycleStatus": "candidate"
  },
  "taskTarget": {
    "packetId": "sample-mission-pass",
    "resolution": "explicit-packet"
  },
  "writes": [
    ".dove/sources/sources.json",
    ".dove/context/packets/sample-mission-pass.json"
  ]
}
```

Daily effect:

- Natural-language targets must resolve to one durable packet before writing.
- If the target is ambiguous, the command returns candidates rather than writing.
- Public `verify_source` can append a rejection decision only. Positive verification requires a trusted internal transition over captured material, hashes, source identity, and packet binding.

### `dove.note`

Purpose: create or update structured notes linked to sources and a resolved task packet.

Example invocation:

```text
/dove:note Summarize what resultCard changed for daily usage
```

Primary MCP tool:

```text
upsert_note
```

Representative output excerpt:

```json
{
  "ok": true,
  "note": {
    "id": "sample-note",
    "title": "命令输出观察",
    "sectionId": "ux",
    "sourceIds": ["sample-source"],
    "summary": "resultCard 让用户更快理解命令结果。",
    "claims": ["结果卡片需要展示 happened/evidence/nextActions。"],
    "openQuestions": ["哪些命令还需要更短输出？"]
  },
  "writes": [
    ".dove/notes/notes.json",
    ".dove/workspace/index.json"
  ]
}
```

Daily effect:

- Notes are durable synthesis objects, not chat-only summaries.
- A note backed only by candidate, rejected, stale, or cross-packet sources remains research context and cannot authorize completion.
- Only packet-bound notes whose sources remain dynamically eligible can support later completion or claims.

### `dove.figure`

Purpose: run the composite figure workflow: figure intent, material discovery, optional provider handoff/import, caption/provenance, and diagnostic QA. `validated` is reserved for current final-SVG proof from an authorized independent Reviewer.

Example invocation:

```text
/dove:figure Draw a simple Dove command flow diagram from status to resultCard
```

Primary MCP tool:

```text
run_figure_workflow
```

Representative output excerpt:

```json
{
  "ok": true,
  "figure": {
    "id": "sample-figure",
    "title": "Dove 命令流示意图",
    "purpose": "说明 Dove 命令输出样式",
    "status": "planned"
  },
  "materialDiscovery": {
    "sourceArtifactPaths": ["docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"],
    "missingMaterials": [],
    "allowMissingMaterials": true
  },
  "generation": {
    "executeProvider": false,
    "providerStatus": "not-run"
  },
  "writes": [
    ".dove/figures/figures.json",
    ".dove/figures/qa.json"
  ]
}
```

Daily effect:

- The public command hides low-level figure tools from daily use.
- Provider output is never claimed unless an explicit generated artifact is imported.
- Lexical coverage, SVG structure, caption checks, and provider self-approval are non-authoritative diagnostics. Importing a new final SVG reopens the review gate; `validated` requires proof covering its exact current hash.

### `dove.experience`

Purpose: plan, record, audit, and bridge an experiment/experience result into claim state after resolving the task packet.

Example invocation:

```text
/dove:experience Check whether resultCard makes command output easier to read
```

Primary MCP tool:

```text
run_experience_workflow
```

Representative output excerpt:

```json
{
  "ok": true,
  "experience": {
    "experimentId": "sample-exp",
    "title": "命令输出可读性检查",
    "goal": "确认 resultCard 是否能降低阅读成本",
    "successMetric": "用户能一眼定位下一步"
  },
  "result": {
    "outcome": "passed",
    "summary": "样本输出包含结果卡和下一步。",
    "evidenceLinks": ["docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"]
  },
  "writes": [
    ".dove/experiments/plans.json",
    ".dove/experiments/results.json",
    ".dove/claims/claims.json"
  ]
}
```

Daily effect:

- Experience work is evidence-backed and task-scoped.
- It does not invent experiment/provider outcomes when no result evidence is supplied.

### `dove.draft`

Purpose: write or update a draft section and optionally set section status, always through a resolved durable task packet.

Example invocation:

```text
/dove:draft Draft the command-output sample section
```

Primary MCP tools:

```text
upsert_draft
set_section_status
```

Draft output excerpt:

```json
{
  "ok": true,
  "draft": {
    "sectionId": "command-output",
    "title": "命令输出样本段落",
    "status": "draft",
    "summary": "创建样本文档草稿段落。"
  },
  "writes": [".dove/drafts/sections/command-output.md"]
}
```

Section status output excerpt:

```json
{
  "ok": true,
  "section": {
    "id": "command-output",
    "status": "review-ready",
    "summary": "样本段落可审阅。"
  },
  "writes": [".dove/drafts/sections.json"]
}
```

Daily effect:

- Draft content and section state are explicit durable artifacts.
- Review readiness is represented as state, not hidden chat context.

### `dove.review`

Purpose: run an evidence-aware structural preflight over selected task or paper-pipeline materials and return concrete findings, action items, missing evidence, or a Reviewer-owned proof boundary.

Example invocation:

```text
/dove:review Check whether the command output sample is clear
```

Primary MCP tool:

```text
run_review_loop
```

Local review output:

```json
{
  "ok": true,
  "verdict": "needs-revision",
  "stage": "review-loop",
  "scope": "command output sample",
  "summary": "The current paper artifacts need another revision pass.",
  "findings": [
    {
      "severity": "medium",
      "summary": "Draft section command-output still has a citation TODO.",
      "responseOwnerRole": "researcher",
      "methodologicalCategory": "citation"
    }
  ],
  "actionItems": ["Resolve the citation TODO before marking the section review-ready."],
  "reviewLogPath": ".dove/reviews/log.md",
  "revisionPlanPath": ".dove/revision-plans/current.md",
  "resultCard": {
    "presentation": "compact-result-summary-card",
    "surface": "dove.review",
    "command": "run_review_loop",
    "status": "needs-revision",
    "outcome": "needs-revision",
    "evidence": ["Found 1 issue and left 1 action item."],
    "nextActions": [
      {
        "title": "Turn the highest-priority issue into revision work",
        "why": "review found gaps, so the next step is repair rather than claiming completion."
      }
    ]
  }
}
```

A clean structural scan without authorized proof stops at a Reviewer-owned boundary instead of claiming `coherent`:

```json
{
  "ok": true,
  "verdict": "needs-evidence",
  "authoritative": false,
  "preflight": {
    "status": "clear",
    "authoritative": false
  },
  "boundary": {
    "type": "review-proof-required",
    "ownerRole": "reviewer",
    "nextRole": "reviewer",
    "requiredActions": ["submit-authoritative-reviewer-runtime-proof"]
  }
}
```

Authoritative `coherent` is allowed only when current independent Reviewer proof covers the exact reviewed artifact set and hashes.

Daily effect:

- Ordinary review performs local evidence-aware preflight; it does not default to isolated/audio handoff.
- A verdict string or clean scan is not authority. Current hash-bound independent Reviewer proof is required for `coherent`.
- Explicit isolated/audio handoff remains available only through lower-level handoff tools when the operator asks for that boundary, and public import proves snapshot integrity but cannot self-issue Reviewer authority.

### `dove.review-loop`

Purpose: run exactly one Reviewer pass over the selected packet. It does not execute Builder revision or a second Reviewer pass.

Example invocation:

```text
/dove:review-loop Run one review loop over the command output sample
```

Primary MCP tool:

```text
run_dove_review_loop
```

Representative output excerpt:

```json
{
  "ok": true,
  "status": "blocked",
  "runId": "sample-review-loop",
  "maxIterations": 1,
  "iterations": [
    {
      "iteration": 1,
      "review": {
        "verdict": "needs-revision",
        "findings": [
          {
            "severity": "medium",
            "summary": "Draft section command-output still has a citation TODO."
          }
        ],
        "actionItems": ["Resolve the citation TODO before the next review pass."]
      },
      "draft": null,
      "experience": null
    }
  ],
  "stopReason": "review-findings-require-repair"
}
```

Daily effect:

- The call is foreground-visible and contains exactly one Reviewer pass.
- It never performs draft or experience repair inside the same call.
- Substantive findings hand work to Builder; a proof-only boundary retains Reviewer ownership. Builder revision and any later review require new explicit calls.

### `dove.rebuttal`

Purpose: normalize reviewer issues, build a rebuttal strategy, and draft evidence-backed responses.

Example invocation:

```text
/dove:rebuttal Normalize reviewer issues and draft the response strategy
```

Primary MCP tools:

```text
normalize_rebuttal_issues
build_rebuttal_strategy
build_rebuttal
```

Issue normalization output excerpt:

```json
{
  "ok": true,
  "issues": [
    {
      "id": "R1",
      "reviewer": "Reviewer 1",
      "summary": "命令输出样本需要说明证据来源",
      "severity": "medium",
      "requestedChange": "补充 validation evidence"
    }
  ],
  "writes": [".dove/rebuttal/issues.json"]
}
```

Strategy output excerpt:

```json
{
  "ok": true,
  "strategy": {
    "packetId": "sample-mission-pass",
    "responseMode": "evidence-backed",
    "issueCount": 1,
    "openEvidenceGaps": ["validation evidence"]
  },
  "writes": [".dove/rebuttal/strategy.json"]
}
```

Draft output excerpt:

```json
{
  "ok": true,
  "rebuttal": {
    "packetId": "sample-mission-pass",
    "responses": [
      {
        "issueId": "R1",
        "stance": "address",
        "evidenceLinks": ["docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"]
      }
    ]
  },
  "writes": [".dove/rebuttal/response-draft.md"]
}
```

Daily effect:

- Rebuttal remains author-side and evidence-backed.
- There is no public manual `rebuttal-lead` role-switch command.

## Practical daily flow

A normal day now reads like this:

1. Run `dove.status` to understand the live development situation and the top recommended next action.
2. Use `dove.mission` when you want Dove to convert a demand, ask for confirmation, and hand off a materialized task contract.
3. Use `dove.auto` when you want bounded foreground multi-round continuation.
4. Use domain commands such as `dove.source`, `dove.note`, `dove.figure`, `dove.experience`, `dove.draft`, `dove.review`, and `dove.rebuttal` for concrete paper/research artifacts.
5. Use `dove.operator` for a confirmed queue pass across existing durable tasks.
6. Use `dove.lessons` to save distilled operating knowledge.
7. Use `dove.version` for explicit direction changes.

## What should not appear in output

The current command surface should not show or reintroduce:

- `dove.paper.*`
- `dove.plan`
- `dove.checklist`
- `dove.audit`
- `dove.return`
- `dove.kill`
- `dove.planner`
- `dove.builder`
- `dove.reviewer`

The output should also avoid:

- mission-count dumps as the main `dove.status` answer;
- recent completed/killed recaps in daily status;
- hidden background continuation claims;
- claims of code, provider, host, experiment, or review work without explicit evidence;
- treating boundary types as task statuses.

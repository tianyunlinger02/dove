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

A typical confirmed result card looks like this:

```json
{
  "presentation": "compact-result-summary-card",
  "surface": "dove.mission",
  "command": "record_dove_mission_pass",
  "packetId": "sample-mission-pass",
  "status": "completed",
  "happened": "已记录一次前台 mission 执行结果。",
  "durableWrites": [
    ".dove/task-packets/packets/sample-mission-pass.json",
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
      "packetId": "sample-mission-pass",
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

Purpose: convert a natural-language demand into one durable task, ask for confirmation, materialize it, and run one bounded foreground pass.

Example invocation:

```text
/dove:mission 整理一条命令输出样本
```

Primary MCP tools:

```text
create_dove_task
record_dove_mission_pass
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
    "approve conversion and run one pass",
    "adjust conversion",
    "cancel"
  ]
}
```

After confirmation and the one foreground pass, the output includes a confirmed result card:

```json
{
  "ok": true,
  "task": {
    "id": "sample-mission-pass",
    "status": "completed"
  },
  "missionPass": {
    "status": "completed",
    "foreground": true,
    "background": false,
    "daemon": false
  },
  "resultCard": {
    "presentation": "compact-result-summary-card",
    "surface": "dove.mission",
    "command": "record_dove_mission_pass",
    "packetId": "sample-mission-pass",
    "status": "completed",
    "happened": "已生成 mission 命令输出样本。",
    "evidence": ["docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"],
    "validation": ["npm run check: pass 214/214"],
    "nextActions": [
      { "command": "project:dove.status", "proposalOnly": true }
    ]
  }
}
```

Daily effect:

- Mission is not just task creation; it also executes exactly one bounded foreground pass after approval.
- If the pass stops at a boundary, the result card shows `boundary`, `ownerRole`, `nextRole`, required inputs/actions, and a handoff suggestion instead of pretending completion.

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

After confirmation, a normal completion looks like this:

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

Status query excerpt:

```json
{
  "ok": true,
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

Purpose: preview the queue, then run one confirmed foreground operator pass across runnable or host-result-required tasks.

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
    "happened": "updated=1; awaiting=0; blockers-created=0",
    "evidence": ["docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"],
    "nextActions": [
      { "command": "project:dove.status", "proposalOnly": true }
    ]
  }
}
```

Awaiting host-result output includes handoff metadata:

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
  "writes": [".dove/lessons/operator-lessons.json"]
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

Purpose: register a provenance-aware source bound to one resolved task packet.

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
    "locator": "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"
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

- Notes are reusable evidence objects, not chat-only summaries.
- They can feed later draft, claim, review, and rebuttal work.

### `dove.figure`

Purpose: run the composite figure workflow: figure intent, material discovery, optional provider handoff/import, caption/provenance, and QA status.

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

Purpose: prepare an isolated audio review bundle, import a completed handoff if present, and never share writer private transcript or reviewer private transcript.

Example invocation:

```text
/dove:review Check whether the command output sample is clear
```

Primary MCP tool:

```text
run_audio_review
```

Prepared-awaiting-review output:

```json
{
  "ok": true,
  "status": "prepared-awaiting-audio",
  "inputPath": ".dove/reviews/audio/sample-audio-review/input.json",
  "handoffPath": ".dove/reviews/audio/sample-audio-review/handoff.json",
  "reportPath": ".dove/reviews/audio/sample-audio-review/report.md",
  "privacyBoundary": {
    "writerPrivateTranscriptShared": false,
    "reviewerPrivateTranscriptImported": false
  },
  "resultCard": {
    "presentation": "compact-result-summary-card",
    "surface": "dove.review",
    "command": "run_audio_review",
    "status": "prepared-awaiting-audio",
    "outcome": "awaiting-audio-review-output",
    "evidence": [
      ".dove/reviews/audio/sample-audio-review/input.json",
      ".dove/reviews/audio/sample-audio-review/handoff.json",
      ".dove/reviews/audio/sample-audio-review/report.md"
    ],
    "nextActions": [
      {
        "command": "import_audio_review",
        "nextRole": "reviewer",
        "requiredActions": ["complete-isolated-review-handoff"],
        "handoffSuggestion": {
          "presentation": "dove-handoff-suggestion",
          "boundaryType": "awaiting-review-output"
        }
      }
    ]
  }
}
```

Imported non-coherent review output routes back to mission:

```json
{
  "ok": true,
  "status": "imported",
  "verdict": "needs-evidence",
  "resultCard": {
    "surface": "dove.review",
    "command": "import_audio_review",
    "outcome": "needs-evidence",
    "nextActions": [
      {
        "command": "project:dove.mission",
        "boundaryType": "audio-review-needs-evidence",
        "ownerRole": "builder",
        "nextRole": "builder",
        "requiredActions": ["Provide validation evidence."],
        "proposalOnly": true
      }
    ]
  }
}
```

Daily effect:

- Review is isolated by explicit artifacts.
- It shows the handoff path and next import action instead of pretending review completed.

### `dove.review-loop`

Purpose: run bounded review/draft/experience iterations using the configured default of 3 unless overridden.

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
  "runId": "sample-review-loop",
  "maxIterations": 1,
  "iterations": [
    {
      "iteration": 1,
      "review": {
        "status": "prepared-awaiting-audio"
      },
      "draft": {
        "sectionId": "command-output",
        "status": "draft"
      },
      "experience": {
        "experimentId": "sample-loop-exp"
      }
    }
  ],
  "stopReason": "awaiting-review-output"
}
```

Daily effect:

- The loop is bounded and foreground-visible.
- It stops at review output or evidence boundaries rather than continuing invisibly.

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
2. Use `dove.mission` when you want Dove to convert a demand, ask for confirmation, and execute one foreground pass.
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

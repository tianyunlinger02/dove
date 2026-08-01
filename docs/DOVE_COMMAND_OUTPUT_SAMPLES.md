# Dove Command Output Samples

These examples show the privacy-safe public result boundary shared by business CLI JSON output and MCP `structuredContent`. Dove exposes 12 direct Skills, 14 canonical MCP tools, and 60 generated adapters. Integration commands such as `init`, `sync`, `doctor`, `mcp serve`, and `hook user-prompt-submit` use direct integration or health output instead.

## Common public envelope

```json
{
  "report": {
    "status": "recorded",
    "message": "The requested current result was recorded."
  },
  "hostControl": {
    "classification": {
      "outcome": "succeeded",
      "category": "success",
      "phase": "execution",
      "blocking": false,
      "userAction": "none",
      "terminal": true,
      "continuation": "terminal",
      "closure": "none",
      "retry": "none"
    },
    "presentation": {
      "mode": "show",
      "reason": "operation-result"
    },
    "closureRequest": null
  }
}
```

Present only `report` when `hostControl.presentation.mode` is `show`. A `silent` result emits no human text. Never render `researchHandoff` or `hostControl`.

## Work ambient route

A clear non-slash work request is classified a second time by hidden `dove-intake`. It selects explicit `ordinary` or `research` mode and calls only `create_ambient_dove_mission` before host execution.

A successful create may return:

```json
{
  "report": {
    "status": "materialized",
    "message": "Dove recorded the work entry; the requested work has not been completed yet."
  },
  "researchHandoff": {
    "action": "Perform one bounded action from current evidence.",
    "rationale": "The action addresses the current Mission goal.",
    "successConditions": ["Return the declared evidence."],
    "stopConditions": ["Stop after this bounded action."],
    "evidenceReturn": ["declared result"]
  },
  "hostControl": {
    "presentation": {
      "mode": "silent",
      "reason": "ambient-create-succeeded"
    },
    "closureRequest": {
      "tool": "record_research_outcome",
      "exactlyOnce": true,
      "boundArgs": {
        "missionNumber": 1,
        "decisionRevision": 1
      },
      "requiredOutcomeFields": [
        "attemptId",
        "status",
        "artifactPaths",
        "validationPaths",
        "facts"
      ],
      "defaults": {}
    }
  }
}
```

The host keeps both machine channels private, resumes the original request after successful creation, and invokes a supplied closure exactly once with `boundArgs` unchanged. Clarification, blocking, or failure presents only its public `report` and stops before host work.

## Lessons ambient route

A natural explicit request to read, remember, or reflect routes to hidden `dove-lessons-intake`. It creates no Mission and calls only `manage_dove_lessons`.

A read returns the complete human Markdown in `report`; its update control stays private:

```json
{
  "report": {
    "status": "ok",
    "markdown": "# Dove Lessons\n\n...complete document...\n"
  },
  "hostControl": {
    "presentation": {
      "mode": "show",
      "reason": "operation-result"
    },
    "lessonsDocument": {
      "binding": "opaque-read-binding"
    },
    "closureRequest": null
  }
}
```

For remember or reflect, the host reads first, preserves the complete Markdown and exact binding, edits the complete document conservatively under the five stable sections, then calls `manage_dove_lessons` once with `operation=update`. Reflection derives only supported reusable guidance from available context.

## Workspace result

`/dove:workspace` inspects the current project and immediately applies one concise mainline. It does not present an evidence list, risk list, or choice card.

```json
{
  "report": {
    "status": "updated",
    "projectBrief": "The project contains a retrieval implementation, evaluation fixtures, and paper artifacts.",
    "mainline": "Evidence-Grounded Evaluation of the Current Retrieval Method"
  },
  "hostControl": {
    "presentation": {
      "mode": "show",
      "reason": "operation-result"
    },
    "closureRequest": null
  }
}
```

## Status result

Status is zero-write. Adapters return `report.briefing` verbatim. Structured clients may also receive bounded fields describing current situation, outputs, evidence, blockers, research judgment, and the next action.

```json
{
  "report": {
    "status": "ok",
    "workStatus": {
      "state": "work-produced",
      "summary": "Current work products exist."
    },
    "evidenceStatus": {
      "state": "current-needs-review",
      "summary": "Current evidence exists, but independent Review is still needed."
    },
    "recommendation": "Run one isolated Review over the declared current artifacts.",
    "briefing": "Current situation\n...\n"
  },
  "hostControl": {
    "presentation": {
      "mode": "show",
      "reason": "operation-result"
    },
    "closureRequest": null
  }
}
```

Public existing-work selection uses the exact visible one-based `missionNumber`. Durable IDs, hashes, paths inside `.dove/`, bindings, and control fields remain private.

## Review scope and archive

`manage_dove_review` with `operation=scope` is zero-write and returns a machine-only request to launch exactly one dedicated fresh read-only native `dove-reviewer`. The host waits synchronously and calls `operation=archive` once with the unchanged scope binding and structured return.

The archived public report may state:

```json
{
  "report": {
    "status": "archived",
    "verdict": "needs-evidence",
    "summary": "The main claim needs one additional current validation result.",
    "findingCount": 1,
    "authority": "not-established"
  },
  "hostControl": {
    "presentation": {
      "mode": "show",
      "reason": "operation-result"
    },
    "closureRequest": null
  }
}
```

Review findings are non-authoritative. They do not establish Reviewer identity, sign-off, acceptance, or scientific endorsement.

## Error result

```json
{
  "report": {
    "status": "blocked",
    "message": "The selected artifact is not current for this Mission."
  },
  "hostControl": {
    "classification": {
      "outcome": "failed",
      "category": "invalid-input",
      "phase": "validation",
      "blocking": true,
      "userAction": "clarify-input",
      "terminal": true,
      "continuation": "terminal",
      "closure": "none",
      "retry": "explicit-request"
    },
    "presentation": {
      "mode": "show",
      "reason": "failure"
    },
    "closureRequest": null
  }
}
```

Schema 18 is the only current state model. Unsupported earlier state is archived and replaced explicitly; it is not migrated, aliased, or opened through a fallback runtime.

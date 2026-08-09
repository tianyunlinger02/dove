# Dove output samples

Dove MCP responses separate natural human text from stable machine fields. Human text does not expose raw exceptions, absolute paths, or private storage details.

## Absent Research Workspace, Chinese

```json
{
  "content": [{
    "type": "text",
    "text": "当前尚未建立 Dove Research Workspace。本次没有写入任何内容；可以先查看普通项目材料，只有明确需要时再初始化研究状态。"
  }],
  "structuredContent": {
    "status": "absent",
    "operation": "query_dove_research",
    "research": {
      "status": "absent",
      "reason": "research-workspace-not-initialized",
      "workspaceState": "absent",
      "zeroWrite": true,
      "query": true,
      "view": "overview",
      "selectedMissionIds": [],
      "inventory": {
        "workspace": 0,
        "missions": 0,
        "sources": 0,
        "experimentPlans": 0,
        "experimentResults": 0,
        "claims": 0,
        "reviews": 0,
        "lessons": 0
      }
    }
  }
}
```

The Research Skill may now use host read-only tools to inspect ordinary project files outside `.dove`. It does not initialize a Workspace or create a Mission automatically.

## Absent Research Workspace, English

```json
{
  "content": [{
    "type": "text",
    "text": "No Dove Research Workspace has been established. Nothing was written; you can first inspect ordinary project materials and initialize research state only if explicitly needed."
  }],
  "structuredContent": {
    "status": "absent",
    "operation": "query_dove_research",
    "research": {
      "status": "absent",
      "reason": "research-workspace-not-initialized",
      "workspaceState": "research-absent",
      "zeroWrite": true
    }
  }
}
```

## Healthy empty Workspace

A healthy Workspace with zero Missions is a successful overview, not an error:

```json
{
  "content": [{"type": "text", "text": "已读取所需研究上下文，没有修改研究状态。"}],
  "structuredContent": {
    "status": "ok",
    "operation": "query_dove_research",
    "research": {
      "status": "ok",
      "zeroWrite": true,
      "view": "overview",
      "selectedMissionIds": [],
      "inventory": {
        "missions": 0,
        "sources": 0,
        "experimentPlans": 0,
        "experimentResults": 0,
        "claims": 0,
        "reviews": 0
      }
    }
  }
}
```

## Invalid input

```json
{
  "content": [{"type": "text", "text": "请求不符合公开 Dove 工具合同，请检查所提供的字段后重试。"}],
  "structuredContent": {
    "status": "error",
    "operation": "manage_dove_claims",
    "research": {"status": "error", "reason": "invalid-input"}
  },
  "isError": true
}
```

The human text deliberately omits JSON paths and validation internals.

## Unknown Mission

```json
{
  "content": [{"type": "text", "text": "当前研究记录中不存在所请求的 Mission。"}],
  "structuredContent": {
    "status": "error",
    "operation": "query_dove_research",
    "research": {"status": "error", "reason": "unknown-mission"}
  },
  "isError": true
}
```

## Experiment workflow

The host performs real work before durable recording:

1. Query hypotheses or experiment options if relevant.
2. Design and execute the experiment with host-native tools.
3. Preserve raw outputs, failures, denominator accounting, deviations, bias, and uncertainty.
4. Freeze and record only when a durable Experiment is needed.
5. Update Claims only within observed evidence.

A successful write returns natural text such as:

```text
已完成所请求的 Experiment 操作。
```

## Review import object

```json
{
  "status": "completed",
  "verdict": "needs-evidence",
  "summary": "The main claim needs a narrower evidence boundary.",
  "rubric": ["Correctness", "Evidence and claim scope"],
  "findings": [{
    "findingId": "claim-scope",
    "severity": "high",
    "summary": "The conclusion exceeds the declared experiment scope.",
    "linkedArtifactPaths": ["paper/results.md"]
  }],
  "actionItems": ["Narrow the conclusion and state the missing replication."],
  "report": "# Review\n\nThe claim should be narrowed.\n",
  "provenance": {"hostKind": "claude", "model": "review-model"},
  "limitations": ["Only paper/results.md was reviewed."],
  "reviewedAt": "2026-08-09T00:00:00.000Z"
}
```

The user obtains this return from a separately managed reviewer exchange. Dove prepares and imports; it does not launch or impersonate the reviewer.

## CLI init

```text
Dove 已在此项目启用

项目  example-project
宿主  Claude Code

✓ 9 个 Dove 工作入口已安装
✓ 项目 MCP 服务已注册并仅为 Dove 批准
✓ 自然语言任务入口已启用
✓ 安全的项目集成记录已建立

Research Workspace 尚未建立也不影响普通项目工作。进入 Claude Code 后可直接处理项目，或按需运行 /dove:research。

下一步  从当前项目进入或重新进入 Claude Code，直接继续项目工作；需要研究路由时可运行 /dove:research。
```

## CLI help inventory

```text
init, sync, upgrade, reinstall, doctor, mcp, hook
```

Research work uses the nine host Skills and eight MCP tools; the runtime CLI does not expose retired business commands.

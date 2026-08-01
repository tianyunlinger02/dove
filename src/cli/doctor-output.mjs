import {
  terminalColorEnabled,
  terminalStyle
} from "./terminal-output.mjs";

function integrationLine(result, color) {
  const integration = result.projectIntegration;
  if (result.legacyCopiedRuntime?.detected) {
    return `${terminalStyle("项目集成", "dim", { color })}  检测到不受支持的旧项目内运行时`;
  }
  if (integration.state === "uninitialized") {
    return `${terminalStyle("项目集成", "dim", { color })}  尚未配置`;
  }
  if (integration.state === "needs-sync") {
    return `${terminalStyle("项目集成", "dim", { color })}  需要更新`;
  }
  if (integration.healthy) {
    return `${terminalStyle("项目集成", "dim", { color })}  已是当前版本`;
  }
  return `${terminalStyle("项目集成", "dim", { color })}  需要人工处理`;
}

function connectionLine(result, color) {
  const readiness = result.readiness;
  if (result.projectIntegration.state === "uninitialized") {
    return `${terminalStyle("Claude Code", "dim", { color })}  等待项目集成`;
  }
  if (result.projectIntegration.state === "needs-sync") {
    return `${terminalStyle("Claude Code", "dim", { color })}  更新项目集成后重新进入会话`;
  }
  if (readiness?.ready) {
    return `${terminalStyle("Claude Code", "dim", { color })}  Dove MCP 已连接`;
  }
  if (result.hostRegistration?.approval?.state === "disabled") {
    return `${terminalStyle("Claude Code", "dim", { color })}  Dove MCP 被项目本地设置显式禁用`;
  }
  if (readiness?.state === "pending-approval") {
    return `${terminalStyle("Claude Code", "dim", { color })}  Dove MCP 批准尚未被 Claude Code 加载`;
  }
  return `${terminalStyle("Claude Code", "dim", { color })}  当前会话尚未加载 Dove MCP`;
}

function workspaceLine(result, color) {
  const workspace = result.workspaceState;
  if (workspace?.mode === "absent") {
    return `${terminalStyle("科研主线", "dim", { color })}  尚未建立`;
  }
  if (workspace?.mode === "current") {
    return `${terminalStyle("科研主线", "dim", { color })}  已建立`;
  }
  if (workspace?.mode === "archive-reset-required" || workspace?.mode === "invalid") {
    return `${terminalStyle("科研主线", "dim", { color })}  需要显式归档重置`;
  }
  return `${terminalStyle("科研主线", "dim", { color })}  当前不可用`;
}

export function recommendedDoveAction(result) {
  if (result.legacyCopiedRuntime?.detected) {
    return {
      kind: "blocked-legacy",
      command: "dove doctor",
      message: "旧项目内运行时阻止安全配置。请先查看诊断，不要直接覆盖。"
    };
  }
  const integration = result.projectIntegration;
  if (integration.state === "uninitialized") {
    return {
      kind: "init",
      command: "dove",
      message: "在交互向导中为当前项目启用 Claude Code 集成。"
    };
  }
  if (integration.state === "needs-sync") {
    return {
      kind: "sync",
      command: "dove",
      message: "在交互向导中更新项目集成，然后重新进入 Claude Code。"
    };
  }
  if (!integration.healthy) {
    return {
      kind: "blocked-integration",
      command: "dove doctor",
      message: "项目集成存在非 Dove 管理的变化，需要先查看诊断。"
    };
  }
  if (!result.readiness?.ready) {
    return {
      kind: "reenter-host",
      command: "claude",
      message: "Dove 已在 Claude 外完成项目配置与精确批准；请从当前项目重新进入 Claude Code。"
    };
  }
  if (result.workspaceState?.mode === "absent") {
    return {
      kind: "workspace",
      command: "/dove:workspace",
      message: "在 Claude Code 中显式建立科研主线。"
    };
  }
  if (result.workspaceState?.mode !== "current") {
    return {
      kind: "workspace-reset",
      command: "/dove:workspace",
      message: "在 Claude Code 中检查并显式决定 Workspace 归档重置。"
    };
  }
  return {
    kind: "ready",
    command: "/dove:status",
    message: "Dove 已可在当前项目中正常使用。"
  };
}

export function renderDoveDoctor(result, options = {}) {
  const stream = options.stream ?? process.stdout;
  const env = options.env ?? process.env;
  const color = terminalColorEnabled(stream, env);
  const action = recommendedDoveAction(result);
  const lines = [
    terminalStyle("Dove 项目检查", "bold", { color }),
    "",
    integrationLine(result, color),
    connectionLine(result, color),
    workspaceLine(result, color),
    "",
    `${terminalStyle("下一步", "bold", { color })}  ${action.command}`,
    action.message
  ];
  if (!result.readiness?.ready && result.projectIntegration.healthy) {
    lines.push("这不是 Workspace 初始化失败，而是当前 Claude Code 会话尚未连接 Dove MCP。");
  }
  return lines.join("\n");
}

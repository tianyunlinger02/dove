import {
  terminalColorEnabled,
  terminalStyle
} from "./terminal-output.mjs";

function userCliLine(result, color) {
  const cli = result.userCli;
  const version = cli?.package?.version ? ` ${cli.package.version}` : "";
  if (!cli?.healthy) {
    return `${terminalStyle("Dove CLI 运行时", "dim", { color })}  需要修复${version}`;
  }
  return `${terminalStyle("Dove CLI 运行时", "dim", { color })}  Dove${version} 可用`;
}

function integrationLine(result, color) {
  const migration = result.migrationInstallation;
  if (migration?.state === "valid-legacy") {
    const version = migration.manifest?.package?.version ? ` ${migration.manifest.package.version}` : "";
    return `${terminalStyle("项目集成", "dim", { color })}  检测到旧版 Dove 项目配置，可升级${version}`;
  }
  if (migration?.state === "conflicting-manifests") {
    return `${terminalStyle("项目集成", "dim", { color })}  当前与旧版 Dove 安装标记冲突`;
  }
  if (migration?.state === "invalid-legacy") {
    return `${terminalStyle("项目集成", "dim", { color })}  旧版 Dove 项目配置无效`;
  }
  if (result.legacyCopiedRuntime?.detected) {
    return `${terminalStyle("项目集成", "dim", { color })}  检测到不受支持的旧项目内运行时`;
  }
  const integration = result.projectIntegration;
  const version = integration.manifest?.package?.version ? ` ${integration.manifest.package.version}` : "";
  if (integration.state === "uninitialized") return `${terminalStyle("项目集成", "dim", { color })}  尚未配置`;
  if (integration.state === "needs-sync") return `${terminalStyle("项目集成", "dim", { color })}  需要更新${version}`;
  if (integration.healthy) return `${terminalStyle("项目集成", "dim", { color })}  已是当前版本${version}`;
  return `${terminalStyle("项目集成", "dim", { color })}  需要人工处理${version}`;
}

function connectionLine(result, color) {
  if (result.mcpProbe?.state === "integration-mismatch") {
    return `${terminalStyle("Dove MCP", "dim", { color })}  项目集成版本不匹配`;
  }
  if (result.runningMcpSelfComparison?.state === "restart-required") {
    return `${terminalStyle("Dove MCP", "dim", { color })}  当前宿主仍在运行旧服务`;
  }
  if (result.runningMcpSelfComparison?.state === "protocol-incompatible") {
    return `${terminalStyle("Dove MCP", "dim", { color })}  协议不兼容`;
  }
  if (result.projectIntegration.state === "uninitialized") return `${terminalStyle("Dove MCP", "dim", { color })}  等待项目集成`;
  if (result.projectIntegration.state === "needs-sync") return `${terminalStyle("Dove MCP", "dim", { color })}  更新项目集成后重新检查`;
  if (result.readiness?.ready) return `${terminalStyle("Dove MCP", "dim", { color })}  已连接`;
  if (result.hostRegistration?.approval?.state === "disabled") return `${terminalStyle("Dove MCP", "dim", { color })}  被项目本地设置禁用`;
  if (result.readiness?.state === "pending-approval") return `${terminalStyle("Dove MCP", "dim", { color })}  等待宿主加载项目批准`;
  return `${terminalStyle("Dove MCP", "dim", { color })}  当前宿主会话尚未连接`;
}

function workspaceLine(result, color) {
  const workspace = result.workspaceState;
  if (workspace?.mode === "absent") return `${terminalStyle("研究状态", "dim", { color })}  尚未建立`;
  if (workspace?.state === "unsupported-legacy-format") {
    const suffix = result.migrationInstallation?.state === "valid-legacy"
      ? "旧格式；Upgrade 将保留但不会迁移"
      : "旧版研究格式，当前版本不会读取或修改";
    return `${terminalStyle("研究状态", "dim", { color })}  ${suffix}`;
  }
  if (workspace?.state === "unsupported-future-format") return `${terminalStyle("研究状态", "dim", { color })}  当前版本不支持`;
  if (workspace?.mode === "current") return `${terminalStyle("研究状态", "dim", { color })}  ${workspace.format ?? "当前格式"} 可读`;
  return `${terminalStyle("研究状态", "dim", { color })}  无法读取`;
}

export function recommendedDoveAction(result) {
  if (result.setup?.mode === "upgrade" && result.setup.reason === "valid-legacy") {
    return { kind: "upgrade-legacy", command: "dove", message: "检测到可升级的旧项目配置；Upgrade 保留旧研究状态但不会迁移其格式。" };
  }
  if (result.setup?.mode === "reinstall") {
    return { kind: "reinstall", command: "dove", message: "当前 Dove 状态只能通过默认 No 的完全重新安装安全处理。" };
  }
  if (result.setup?.mode === "blocked") {
    return { kind: "blocked-setup", command: "dove doctor --json", message: "项目中的 Dove 状态不明确；Doctor 不会覆盖或删除它。" };
  }
  if (result.mcpProbe?.state === "integration-mismatch") {
    return { kind: "sync-integration-version", command: "dove sync", message: "项目集成与当前 Dove 版本不一致；同步后重新进入宿主会话。" };
  }
  if (result.runningMcpSelfComparison?.state === "restart-required") {
    return { kind: "restart-host", command: "claude", message: "退出并重新进入宿主会话以启动当前 Dove MCP 服务。" };
  }
  if (result.runningMcpSelfComparison?.state === "protocol-incompatible") {
    return { kind: "protocol-incompatible", command: "dove doctor", message: "请使用支持当前 Dove MCP 协议的宿主或 Dove 版本。" };
  }
  if (result.workspaceState?.state === "unsupported-legacy-format") {
    return { kind: "unsupported-legacy-format", command: "dove doctor --json", message: "Workspace 使用不受支持的旧格式。Doctor 只报告格式状态，不会改动任何内容。" };
  }
  if (result.workspaceState?.state === "unsupported-future-format") {
    return { kind: "unsupported-future-format", command: "dove doctor --json", message: "Workspace 来自更新的 Dove 版本；请使用兼容版本读取。" };
  }
  if (result.legacyCopiedRuntime?.detected) {
    return { kind: "blocked-legacy", command: "dove doctor --json", message: "旧项目内运行时阻止安全配置；Doctor 不会覆盖它。" };
  }
  const integration = result.projectIntegration;
  if (integration.state === "uninitialized") return { kind: "init", command: "dove", message: "运行交互向导，为当前项目启用 Dove 集成。" };
  if (integration.state === "needs-sync") return { kind: "sync", command: "dove sync", message: "更新 Dove 管理的项目集成，然后重新进入宿主会话。" };
  if (!integration.healthy) return { kind: "blocked-integration", command: "dove doctor --json", message: "项目集成存在缺失或漂移；查看 JSON 诊断后人工处理。" };
  if (!result.readiness?.ready) return { kind: "reenter-host", command: "claude", message: "从当前项目重新进入 Claude Code，使其加载 Dove MCP。" };
  if (result.workspaceState?.mode === "absent") return { kind: "ready-no-workspace", command: "claude", message: "项目集成与 MCP 已就绪；研究工作入口由宿主中的 Dove 命令提供。" };
  if (!result.workspaceState?.healthy) return { kind: "invalid-workspace-format", command: "dove doctor --json", message: "Workspace 格式无法读取；Doctor 不会深入验证或修改研究实体。" };
  return { kind: "ready", command: "claude", message: "Dove 项目集成与 MCP 已可用。" };
}

export function renderDoveDoctor(result, options = {}) {
  const stream = options.stream ?? process.stdout;
  const env = options.env ?? process.env;
  const color = terminalColorEnabled(stream, env);
  const action = recommendedDoveAction(result);
  return [
    terminalStyle("Dove 检查", "bold", { color }),
    "",
    userCliLine(result, color),
    integrationLine(result, color),
    connectionLine(result, color),
    workspaceLine(result, color),
    "",
    `${terminalStyle("下一步", "bold", { color })}  ${action.command}`,
    action.message
  ].join("\n");
}

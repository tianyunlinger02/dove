import { terminalColorEnabled, terminalStyle } from "./terminal-output.mjs";

function softwareLine(result, color) {
  const software = result.userCli;
  const version = software?.package?.version ? ` ${software.package.version}` : "";
  const text = software?.healthy ? `Dove${version} 可用` : `Dove${version} 需要修复`;
  return `${terminalStyle("软件", "dim", { color })}  ${text}`;
}

function projectLine(result, color) {
  const migration = result.migrationInstallation?.state;
  if (migration === "valid-legacy") return `${terminalStyle("项目集成", "dim", { color })}  可从旧版升级`;
  if (migration === "conflicting-manifests") return `${terminalStyle("项目集成", "dim", { color })}  安装标记冲突`;
  const state = result.projectIntegration?.state;
  const text = state === "current" ? "当前" : state === "needs-sync" ? "需要同步" : state === "uninitialized" ? "尚未配置" : state === "drifted" ? "用户字节已漂移" : "需要人工处理";
  return `${terminalStyle("项目集成", "dim", { color })}  ${text}`;
}

function researchLine(result, color) {
  const research = result.workspaceState;
  const text = research?.mode === "absent"
    ? "RESEARCH.md 尚未建立"
    : research?.mode === "previous-research-format"
      ? "发现可显式导出的旧版 JSON 科研记录"
      : research?.healthy
        ? "Markdown 外层可读"
        : "Markdown 外层无法安全读取";
  return `${terminalStyle("研究文档", "dim", { color })}  ${text}`;
}

function retiredRuntimeLine(result, color) {
  const legacy = result.legacyCopiedRuntime;
  const text = legacy?.healthy ? "未发现旧复制运行时" : legacy?.detected ? "发现旧复制运行时" : "无法安全检查";
  return `${terminalStyle("旧复制运行时", "dim", { color })}  ${text}`;
}

export function recommendedDoveAction(result) {
  const first = result.actions?.[0];
  if (first) {
    const messages = {
      upgrade: "显式升级旧项目集成并保留研究文件。",
      init: "为当前项目启用 Dove 集成。",
      sync: "同步 Dove 管理的项目集成。",
      reinstall: "重新安装会在明确确认后删除项目 Dove 集成与研究状态。",
      "export-research": "审阅旧版 JSON 科研记录到 Markdown 的一次性导出预览，并在确认后保留原始归档。",
      inspect: "查看 JSON 诊断并处理不明确状态。"
    };
    return { ...first, message: messages[first.kind] ?? "按提示处理当前 Dove 状态。" };
  }
  return { kind: "ready", command: "claude", message: "Dove 软件、项目集成和研究文档外层检查通过。" };
}

export function renderDoveDoctor(result, options = {}) {
  const stream = options.stream ?? process.stdout;
  const env = options.env ?? process.env;
  const color = terminalColorEnabled(stream, env);
  const action = recommendedDoveAction(result);
  return [
    terminalStyle("Dove 检查", "bold", { color }),
    "检查 Dove 软件、项目集成、Markdown 研究文档外层可读性和旧复制运行时；必要时维护 Dove 问题文档，但不修改项目集成或科研文档，也不判断科研结论、完成度或评审权威。",
    "",
    softwareLine(result, color),
    projectLine(result, color),
    researchLine(result, color),
    retiredRuntimeLine(result, color),
    "外层可读不等于研究内容正确、完整或经过独立审查。",
    "",
    `${terminalStyle("下一步", "bold", { color })}  ${action.command}`,
    action.message
  ].join("\n");
}

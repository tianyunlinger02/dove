import { terminalColorEnabled, terminalStyle } from "./terminal-output.mjs";

function softwareLine(result, color) {
  const software = result.userCli;
  const version = software?.package?.version ? ` ${software.package.version}` : "";
  const text = software?.healthy ? `Dove${version} 可用` : `Dove${version} 需要修复`;
  return `${terminalStyle("软件", "dim", { color })}  ${text}`;
}

function projectLine(result, color) {
  const migration = result.migrationInstallation?.state;
  if (migration === "valid-legacy") return `${terminalStyle("项目接入", "dim", { color })}  旧版安装标记不在当前采用范围`;
  if (migration === "conflicting-manifests") return `${terminalStyle("项目接入", "dim", { color })}  安装标记冲突`;
  if (result.adoption?.state === "adoptable") return `${terminalStyle("项目接入", "dim", { color })}  现有 Markdown 研究树可以通过 update 采用`;
  const state = result.projectIntegration?.state;
  const text = state === "current" ? "当前" : state === "needs-sync" ? "需要更新" : state === "uninitialized" ? "尚未配置" : state === "drifted" ? "用户字节已漂移" : "需要人工处理";
  return `${terminalStyle("项目接入", "dim", { color })}  ${text}`;
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

export function recommendedDoveAction(result) {
  const first = result.actions?.[0];
  if (first) {
    const messages = {
      update: "更新 Dove 管理的项目接入；不会重写、补齐或规范化 .dove/research/**。",
      init: "为当前项目启用 Dove 接入。",
      reinstall: "重新安装会在明确确认后仅刷新项目接入，不会重写或删改 .dove/research/** 与 DOCTOR.md。",
      "export-research": "审阅旧版 JSON 科研记录到 Markdown 的一次性导出预览，并在确认后保留原始归档。",
      inspect: "查看 JSON 诊断并处理不明确状态。"
    };
    return { ...first, message: messages[first.kind] ?? "按提示处理当前 Dove 状态。" };
  }
  if (!result.staticChecksPassed) {
    return { kind: "inspect", command: "dove doctor --json", message: "静态检查仍有未通过项，但没有可安全自动建议的修复动作；请查看 JSON 诊断中的软件、项目接入和研究文档外层状态。" };
  }
  return { kind: "static-checks-passed", command: "无需处理", message: "Dove 软件、package-managed 项目接入和研究文档外层静态检查通过；这不证明当前宿主会话已加载 agent、Skills、Hooks 或 MCP，也不代表运行时或科研就绪。" };
}

export function renderDoveDoctor(result, options = {}) {
  const stream = options.stream ?? process.stdout;
  const env = options.env ?? process.env;
  const color = terminalColorEnabled(stream, env);
  const action = recommendedDoveAction(result);
  return [
    terminalStyle("Dove 检查", "bold", { color }),
    "面向 Dove 开发排查，静态检查软件、package-managed 项目接入、已记录 host 配置和 Markdown 研究文档外层可读性；保持只读，不验证当前会话加载、MCP 批准或连接、运行时工具行为、科研结论、完成度或评审独立性。用户通常无需运行此命令。",
    "",
    softwareLine(result, color),
    projectLine(result, color),
    researchLine(result, color),
    "外层可读不等于研究内容正确、完整或经过独立审查。",
    "",
    `${terminalStyle("下一步", "bold", { color })}  ${action.command}`,
    action.message
  ].join("\n");
}

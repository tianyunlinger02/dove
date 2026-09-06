import { terminalColorEnabled, terminalStyle } from "./terminal-output.mjs";

function softwareLine(result, color) {
  const software = result.userCli;
  const version = software?.package?.version ? ` ${software.package.version}` : "";
  const text = software?.healthy ? `Dove${version} 可用` : `Dove${version} 需要修复`;
  return `${terminalStyle("软件", "dim", { color })}  ${text}`;
}

function projectLine(result, color) {
  const manifest = result.projectIntegration?.manifest ?? result.migrationInstallation?.manifest;
  const version = manifest?.package?.version;
  const recordedVersion = typeof version === "string" && version.trim() ? version : "未知";
  const label = `${terminalStyle("项目接入", "dim", { color })}  manifest 版本 ${recordedVersion}；`;
  const migration = result.migrationInstallation?.state;
  if (migration === "valid-legacy") return `${label}旧版安装标记不在当前采用范围`;
  if (migration === "conflicting-manifests") return `${label}安装标记冲突`;
  if (result.adoption?.state === "adoptable") return `${label}现有 Markdown 研究树可以通过 update 采用`;
  const state = result.projectIntegration?.state;
  const skipped = result.projectIntegration?.skippedLocalEdits?.length ?? 0;
  const text = state === "current" ? "当前" : state === "needs-sync" && skipped > 0 ? `需要更新；${skipped} 个 manifest-owned 本地编辑会由 SessionStart 跳过` : state === "needs-sync" ? "需要更新" : state === "uninitialized" ? "尚未配置" : state === "drifted" ? "Dove 管理的配置已被修改" : "需要人工处理";
  const syncCount = result.projectIntegration?.syncPaths?.length ?? 0;
  return `${label}${text}${syncCount > 0 ? `；${syncCount} 个待同步路径` : ""}`;
}

function retiredHookLines(result) {
  const paths = result.projectIntegration?.retiredHooks?.matchedPaths ?? [];
  if (paths.length === 0) return [];
  return [`退役 Hook 残留（只读）  ${paths.join("、")}；仅精确旧项，不代表自定义或全局配置已清理。`];
}

function researchLine(result, color) {
  const research = result.workspaceState;
  const text = research?.mode === "absent"
    ? "RESEARCH.md 尚未建立"
    : research?.mode === "previous-research-format"
      ? "发现旧版 JSON 科研记录；原地保留，不自动转换或删除"
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
      inspect: result.projectIntegration?.retiredHooks?.matchedPaths?.length > 0
        ? "核对 JSON 诊断中的退役 Hook 路径；精确匹配仅报告残留，不自动清理或扩大删除 ownership。"
        : "查看 JSON 诊断并处理不明确状态；旧版研究数据会原地保留，Dove 不会自动转换或删除。"
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
    ...retiredHookLines(result),
    researchLine(result, color),
    "外层可读不等于研究内容正确、完整或经过独立审查。",
    "",
    `${terminalStyle("下一步", "bold", { color })}  ${action.command}`,
    action.message
  ].join("\n");
}

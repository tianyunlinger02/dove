import path from "node:path";

import { HOST_REGISTRY } from "../core/host-registry.mjs";
import {
  isInteractiveTerminal,
  renderDovePixelArt,
  terminalColorEnabled,
  terminalStyle
} from "./terminal-output.mjs";

const INTERNAL_FIELD_NAMES = new Set([
  "writtenPaths",
  "removedPaths",
  "changedPaths",
  "cleanupWarnings",
  "omittedCleanupWarningCount",
  "manifest"
]);

function assertIntegrationResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Dove project integration result must be an object.");
  }
  if (typeof result.status !== "string" || !result.status) {
    throw new Error("Dove project integration result requires status.");
  }
  if (typeof result.target !== "string" || !result.target) {
    throw new Error("Dove project integration result requires target.");
  }
  if (!Array.isArray(result.hosts) || result.hosts.length === 0) {
    throw new Error("Dove project integration result requires at least one host.");
  }
}

function terminalSafeText(value) {
  return String(value).replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
}

function hostLabels(hosts) {
  return hosts.map((hostId) => HOST_REGISTRY[hostId]?.label ?? terminalSafeText(hostId)).join(", ");
}

function headingFor(command, status) {
  if (command === "init" && status === "initialized") return "Dove 已在此项目启用";
  if (command === "init" && status === "already-initialized") return "Dove 已经在此项目启用";
  if (command === "update" && status === "unchanged") return "Dove 项目集成已是最新";
  if (command === "update" && status === "adopted") return "Dove 已保留现有 Markdown 研究树并建立当前项目接入";
  if (command === "update" && ["synchronized", "updated", "upgraded"].includes(status)) return "Dove 项目集成已刷新";
  throw new Error(`Unsupported Dove integration presentation: ${command}/${status}.`);
}

function setupLines(command, status) {
  if (command === "init" && status === "already-initialized") {
    return ["✓ 现有项目集成保持不变，没有写入任何文件"];
  }
  if (command === "init") {
    return [
      "✓ Dove agent 已安装",
      "✓ Dove 默认科研 agent 与 9 个可选专项入口已安装",
      "✓ Claude 提示钩子、WebFetch 禁用与项目绝对路径状态栏已配置",
      "✓ 按需论文检索 MCP 与普通网页 Exa MCP 已声明",
      "✓ 最小研究入口 RESEARCH.md 已建立",
      "✓ 项目集成记录已建立"
    ];
  }
  if (status === "unchanged") return ["✓ Dove agent、能力入口和宿主接入均已是最新"];
  if (status === "adopted") {
    return [
      "✓ 现有研究 Markdown 保持不变",
      "✓ Dove agent、能力入口、Claude 钩子、WebFetch 禁用、项目绝对路径状态栏和 MCP 声明已采用当前 package 接入",
      "✓ 项目集成记录已建立为 revision 2.0"
    ];
  }
  return ["✓ Dove agent、能力入口、宿主接入和项目绝对路径状态栏已刷新"];
}

export function renderProjectIntegrationResult(command, result, options = {}) {
  assertIntegrationResult(result);
  if (!new Set(["init", "update"]).has(command)) throw new Error(`Unsupported Dove integration command: ${command}.`);
  for (const field of INTERNAL_FIELD_NAMES) {
    if (Object.hasOwn(options, field)) throw new Error(`Dove integration renderer does not accept internal field option: ${field}.`);
  }

  const stream = options.stream ?? process.stdout;
  const env = options.env ?? process.env;
  const interactive = isInteractiveTerminal(stream);
  const color = terminalColorEnabled(stream, env);
  const heading = headingFor(command, result.status);
  const projectName = terminalSafeText(path.basename(result.target) || result.target);
  const lines = [];

  if (command === "init" && ["initialized", "already-initialized"].includes(result.status) && interactive) {
    lines.push(renderDovePixelArt({ color }), "");
  }

  lines.push(terminalStyle(heading, "bold", { color }));
  lines.push("");
  lines.push(`${terminalStyle("项目", "dim", { color })}  ${projectName}`);
  lines.push(`${terminalStyle("宿主", "dim", { color })}  ${hostLabels(result.hosts)}`);
  lines.push("");
  lines.push(...setupLines(command, result.status).map((line) => terminalStyle(line, "green", { color })));
  lines.push("");
  if (command === "init" && result.status === "already-initialized") {
    lines.push("如需刷新项目集成，请运行 dove update。更新不会重写、重连或规范化 .dove/research/**。");
  } else if (command === "update" && result.status === "adopted") {
    lines.push("本次采用只建立 revision 2.0 项目接入记录并安装缺失或完全当前的 package-managed Claude 集成；不会重写 .dove/research/、DOCTOR、archive 或旧工作区 marker。未知漂移会阻止采用。");
  } else {
    lines.push(command === "init"
      ? "最小研究入口已建立；研究 overview 与任何后续主题文档由研究者按需维护。它们不代表科研主线、结论或任务已经完成。"
      : "更新只会刷新项目接入，不会重写、重连或规范化 .dove/research/**；现有研究文档保持不变。"
    );
  }
  lines.push("");
  if (result.hosts.includes("claude")) {
    lines.push("论文检索需要本机已有 uvx；Claude Code 首次使用 `dove-paper-search` 或 `exa` project MCP 时会请求你批准。Dove 未安装依赖、写入凭据或替你批准。WebSearch 保留用于搜索发现，WebFetch 由项目权限禁用。");
    lines.push("");
  }
  lines.push(`${terminalStyle("下一步", "bold", { color })}  从当前项目进入或重新进入 Claude Code，直接告诉 Dove 你的科研目标；/dove:* 只是可选专项快捷入口。`);
  return lines.join("\n");
}

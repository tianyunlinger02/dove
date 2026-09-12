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
  "skippedLocalEdits",
  "replacedLocalEdits",
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

function localEditLabel(item) {
  const relativePath = terminalSafeText(item?.path ?? "unknown");
  const selector = item?.selector === null || item?.selector === undefined ? "" : terminalSafeText(item.selector);
  return selector ? `${relativePath}#${selector}` : relativePath;
}

function replacedLocalEditNotice(result) {
  const replaced = Array.isArray(result.replacedLocalEdits) ? result.replacedLocalEdits : [];
  if (replaced.length === 0) return [];
  const labels = replaced.slice(0, 6).map(localEditLabel);
  const omitted = replaced.length - labels.length;
  return [
    `注意：本次显式 update 已覆盖 ${replaced.length} 个 manifest-owned 本地编辑：${labels.join(", ")}${omitted > 0 ? `，另有 ${omitted} 个未列出` : ""}。`,
    "SessionStart 完全只读，不会修改这些本地编辑；dove update 是显式刷新 package-managed 项目接入的覆盖入口。"
  ];
}

function headingFor(command, status) {
  if (command === "init" && status === "initialized") return "Dove 已在此项目启用";
  if (command === "init" && status === "already-initialized") return "Dove 已经在此项目启用";
  if (command === "update" && status === "unchanged") return "Dove 项目集成已是最新";
  if (command === "update" && status === "updated") return "Dove 项目集成已刷新";
  throw new Error(`Unsupported Dove integration presentation: ${command}/${status}.`);
}

function setupLines(command, { status, hosts, writtenPaths = [] }) {
  const hasClaude = hosts.includes("claude");
  const hasDsh = hosts.includes("dsh");
  const lines = [];
  if (command === "init" && status === "already-initialized") return ["✓ 现有项目集成保持不变，没有写入任何文件"];
  if (hasClaude) {
    lines.push("✓ Dove agent 与 9 个可选专项入口已安装", "✓ Claude SessionStart hook 与 WebFetch 禁用已配置；状态栏空缺时安装 Dove 只读显示", "✓ 按需论文检索 MCP 与普通网页 Exa MCP 已声明");
  }
  if (hasDsh) lines.push("✓ DSH 项目级 filesystem Skills 已安装");
  if (command === "init") lines.push(
    writtenPaths.includes(".dove/research/RESEARCH.md")
      ? "✓ 最小研究入口 RESEARCH.md 已建立"
      : "✓ 现有研究目录保持不变，未创建或补写研究文档",
    "✓ 项目集成记录已建立"
  );
  else if (status === "unchanged") return ["✓ Dove 能力入口和已选宿主接入均已是最新"];
  else lines.push("✓ Dove 能力入口和已选宿主接入已刷新");
  return lines;
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
  lines.push(...setupLines(command, result).map((line) => terminalStyle(line, "green", { color })));
  lines.push("");
  if (command === "init" && result.status === "already-initialized") {
    lines.push("如需刷新项目集成，请运行 dove update。更新不会重写、重连或规范化 .dove/research/**。");
  } else {
    lines.push(command === "init"
      ? "研究 overview 与任何后续主题文档由研究者按需维护；已有研究目录不会被补写。它们不代表科研主线、结论或任务已经完成。"
      : "更新只会刷新项目接入，不会重写、重连或规范化 .dove/research/**；现有研究文档保持不变。"
    );
  }
  lines.push(...replacedLocalEditNotice(result));
  lines.push("");
  if (result.hosts.includes("claude")) {
    lines.push("论文检索需要本机已有 uvx；Claude Code 首次使用 `dove-paper-search` 或 `exa` project MCP 时会请求你批准。Dove 未安装依赖、写入凭据或替你批准。WebSearch 保留用于搜索发现，WebFetch 由项目权限禁用。");
    lines.push("");
  }
  if (result.hosts.includes("claude")) {
    lines.push(`${terminalStyle("下一步", "bold", { color })}  从当前项目进入或重新进入 Claude Code，直接提出科研请求，或用 /dove:* 作为可选专项快捷入口。`);
  } else {
    lines.push(`${terminalStyle("下一步", "bold", { color })}  在 DSH 中使用已安装的项目级 Dove filesystem Skills；DSH 不提供 Claude slash 命令、Hooks 或 MCP 声明。`);
  }
  return lines.join("\n");
}

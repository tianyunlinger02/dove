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
  if (command === "update" && status === "unchanged") return "Dove 项目集成与研究默认文档已是最新";
  if (command === "update" && ["synchronized", "updated", "upgraded"].includes(status)) return "Dove 项目集成与研究默认文档已刷新";
  throw new Error(`Unsupported Dove integration presentation: ${command}/${status}.`);
}

function setupLines(command, status) {
  if (command === "init" && status === "already-initialized") {
    return ["✓ 现有项目集成保持不变，没有写入任何文件"];
  }
  if (command === "init") {
    return [
      "✓ Dove agent 已安装",
      "✓ 10 个 Dove 能力入口已安装",
      "✓ Claude 提示与停止钩子已配置",
      "✓ 按需论文搜索、下载与阅读 MCP 已声明",
      "✓ 完整默认研究目录与通用 Lessons 已建立",
      "✓ 项目集成记录已建立"
    ];
  }
  return status === "unchanged"
    ? ["✓ Dove agent、能力入口、宿主接入和研究默认文档均已是最新"]
    : ["✓ Dove agent、能力入口、宿主接入、汇总导航和内置 Lessons 已刷新"];
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
    lines.push("如需刷新项目集成、研究汇总导航和内置 Lessons，请运行 dove update。六个内置 Lessons 主题会以当前 package 内容整体替换，其他研究文档保持不变。");
  } else {
    lines.push(command === "init"
      ? "默认研究目录已建立；研究 overview 与汇总由研究者维护，六个内置 Lessons 主题由 package 管理。它们不代表科研主线、结论或任务已经完成。"
      : "更新会创建缺失汇总、补齐 RESEARCH.md 与 lessons/LESSONS.md 的当前标准导航，并以当前 package 内容整体替换六个内置 Lessons 主题；其他研究文档保持不变。"
    );
  }
  lines.push("");
  if (result.hosts.includes("claude")) {
    lines.push("论文工具需要本机已有 uvx；Claude Code 首次使用 project MCP 时会请求你批准。Dove 未安装依赖、写入凭据或替你批准。");
    lines.push("");
  }
  lines.push(`${terminalStyle("下一步", "bold", { color })}  从当前项目进入或重新进入 Claude Code，按需要切换到 Dove agent 或使用 /dove:* 能力入口。`);
  return lines.join("\n");
}

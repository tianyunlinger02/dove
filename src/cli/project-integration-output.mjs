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
      "✓ 10 个 Dove Skill 工作入口已安装",
      "✓ Claude 提示与停止钩子已配置",
      "✓ 按需论文搜索、下载与阅读 MCP 已声明",
      "✓ 完整默认研究目录与通用 Lessons 已建立",
      "✓ 项目集成记录已建立"
    ];
  }
  return status === "unchanged"
    ? ["✓ 工作入口、宿主接入和研究默认文档均已是最新"]
    : ["✓ 工作入口、宿主接入和缺失的研究默认内容已刷新"];
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
    lines.push("如需刷新项目集成和研究默认文档，请运行 dove update。项目中已有的研究内容不会被重排或覆盖。");
  } else {
    lines.push(command === "init"
      ? "默认研究目录与通用 Lessons 已建立；它们是可维护的 Markdown 入口，不代表科研主线、结论或任务已经完成。"
      : "更新只创建缺失文件或精确追加缺失的默认段落和导航；项目中已有的研究内容与普通研究文档保持不变。"
    );
  }
  lines.push("");
  if (result.hosts.includes("claude")) {
    lines.push("论文工具需要本机已有 uvx；Claude Code 首次使用 project MCP 时会请求你批准。Dove 未安装依赖、写入凭据或替你批准。");
    lines.push("");
  }
  lines.push(`${terminalStyle("下一步", "bold", { color })}  从当前项目进入或重新进入 Claude Code，然后按需要运行 /dove:research 或其他 Dove Skill。`);
  return lines.join("\n");
}

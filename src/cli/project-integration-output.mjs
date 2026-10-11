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

function authorPreferenceActivationLines(hosts) {
  if (hosts.includes("claude")) return [
    "中文短要点已安装：.dove/install/RESEARCH_QUALITY.md、AUTHOR_PREFERENCES.md；完整内容在对应 _FULL.md，按需查阅。",
    "Claude startup 与 /clear 要求当前主 agent 本人读取两个短要点；现有主 agent 在实质工作前补读尚未读过或已更新的内容。安装本身不代表模型已经读过。",
    "UserPromptSubmit 只读核对集成并呈现身份卡和当前指导，不写研究或决定权限。完整加载新增 agent、hooks 和宿主配置请新开会话；下一条提示不等于宿主热重载。"
  ];
  return [
    "中文短要点已安装：.dove/install/RESEARCH_QUALITY.md、AUTHOR_PREFERENCES.md；对应 _FULL.md 仅按需查阅。",
    "DSH 没有 SessionStart；首次使用作者侧 Dove Skill 时，当前主 agent 若尚未读过，先本人读取两个短要点。安装本身不代表模型已经读过。"
  ];
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

function cleanupWarningNotice(result) {
  const warnings = Array.isArray(result.cleanupWarnings) ? result.cleanupWarnings : [];
  const omitted = Number.isSafeInteger(result.omittedCleanupWarningCount) ? result.omittedCleanupWarningCount : 0;
  if (warnings.length === 0 && omitted <= 0) return [];
  const entries = warnings.slice(0, 6).map((warning) => {
    const pathName = terminalSafeText(warning?.path ?? "unknown");
    const reason = terminalSafeText(warning?.reason ?? "unknown reason");
    return `${pathName}（${reason}）`;
  });
  return [
    `警告：主操作已提交，但事务清理仍有 ${warnings.length + omitted} 项未完成${entries.length > 0 ? `：${entries.join("；")}` : ""}${warnings.length + omitted > entries.length ? "；其余未列出" : ""}。`,
    "这些残留不表示项目集成回滚；请在确认路径安全后检查并清理。"
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
    lines.push("✓ Dove 与 9 个可选专项入口已安装；导师和论文审稿使用原生只读子 agent", "✓ Claude SessionStart 与 UserPromptSubmit 已配置；状态栏空缺时安装只读显示", "✓ 论文检索 MCP、网页 Exa MCP 与项目 WebFetch 禁用已配置");
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
  const showMascot = options.showMascot !== false;
  const color = terminalColorEnabled(stream, env);
  const heading = headingFor(command, result.status);
  const projectName = terminalSafeText(path.basename(result.target) || result.target);
  const lines = [];

  if (showMascot && command === "init" && ["initialized", "already-initialized"].includes(result.status) && interactive) {
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
    lines.push("如需刷新项目集成，请运行 dove update；科研、历史审稿和运行记录保持原地。");
  } else {
    lines.push(command === "init"
      ? "科研记录由主会话维护：IDENTITY.md、EVAL.md、rounds/。已有 missions、experiments、claims 保留原地；安装不代表目标或评测已确认。"
      : "更新只刷新项目集成；科研、历史审稿和运行记录不移动、不删除，已有 missions、experiments、claims 保留原地。"
    );
  }
  lines.push(...replacedLocalEditNotice(result));
  lines.push(...cleanupWarningNotice(result));
  lines.push("");
  if (command === "init" && result.status === "already-initialized") {
    lines.push("本次 init 未刷新短要点或宿主引导，不能据此确认它们已就绪；需要时运行 dove update。安装本身不代表模型已经读过。", "");
  } else {
    lines.push(...authorPreferenceActivationLines(result.hosts), "");
  }
  if (result.hosts.includes("claude")) {
    lines.push("论文检索需要本机已有 uvx；首次使用 dove-paper-search 或 exa 时的宿主批准仍由你决定。Dove 不安装依赖或写凭据；WebSearch 保留，WebFetch 已由项目权限禁用。");
    lines.push("");
  }
  if (result.hosts.includes("claude")) {
    lines.push(`${terminalStyle("下一步", "bold", { color })}  从当前项目进入 Claude Code，直接说明目标；/dove:* 是可选快捷入口。`);
  } else {
    lines.push(`${terminalStyle("下一步", "bold", { color })}  在 DSH 中使用已安装的项目级 Dove filesystem Skills；DSH 不提供 Claude slash 命令、Hooks 或 MCP 声明。`);
  }
  return lines.join("\n");
}

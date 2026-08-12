export const DOVE_PIXEL_ART = Object.freeze([
  "  ██▓▓                          █▓▓▓",
  " ▓█████                      ████▓██",
  " ▓█████▓                   ▓████████",
  " ▓███████▓                ██████████",
  "  █████████▓            ▓██████████",
  "  ████████████▓         ██████████",
  "  ███████████████     ▓█████████",
  "    ▓█████████████▓  ▓████████▓",
  "     ███████████████████████▓",
  "      █████████████████████▓▓████",
  "       ▓██████████████████████████",
  "          ▓███████████████████▓  ▓",
  "        ▓██████████████████▓",
  " ▓▓▓███████████████████▓▓",
  "█████████▓▓▓"
]);

const ANSI = Object.freeze({
  reset: "[0m",
  bold: "[1m",
  cyan: "[36m",
  green: "[32m",
  dim: "[2m"
});

export function isInteractiveTerminal(stream) {
  return stream?.isTTY === true;
}

export function terminalColorEnabled(stream, env = process.env) {
  const noColor = env?.NO_COLOR;
  return isInteractiveTerminal(stream) && !(typeof noColor === "string" && noColor.length > 0);
}

export function terminalStyle(text, style, options = {}) {
  if (options.color !== true) return text;
  const code = ANSI[style];
  if (!code) throw new Error(`Unknown Dove terminal style: ${style}.`);
  return `${code}${text}${ANSI.reset}`;
}

export function renderDovePixelArt(options = {}) {
  const color = options.color === true;
  return DOVE_PIXEL_ART.map((line) => terminalStyle(line, "cyan", { color })).join("\n");
}

export function renderCompleteReinstallInventory(target, options = {}) {
  const color = options.color === true;
  return [
    terminalStyle("完全重新安装项目配置将永久删除", "bold", { color }),
    "",
    `- 当前项目中的 Dove commands、Skills、agents、Hook 与安装记录`,
    `- ${target}/.dove/ 中的项目私有研究状态`,
    `- ${target}/.dove-archive/ 中的旧归档（如存在）`,
    `- 旧的 .dove-install/ 项目安装标记（如存在）`,
    "",
    "用户级 Dove 安装不会被管理；旧项目内服务器配置和复制运行时仅在精确识别后清理。"
  ].join("\n");
}

export function renderDoveLifecycleResult(command, result, options = {}) {
  const stream = options.stream ?? process.stdout;
  const env = options.env ?? process.env;
  const color = terminalColorEnabled(stream, env);
  if (command === "upgrade") return [
    terminalStyle("Dove 项目配置升级完成", "bold", { color }),
    "",
    "✓ 项目集成已刷新到当前版本",
    "✓ 研究状态已保留",
    "✓ Upgrade 仅修改当前项目，不管理用户级 npm 安装"
  ].join("\n");
  if (command === "reinstall") return [
    terminalStyle("Dove 项目配置完全重新安装完成", "bold", { color }),
    "",
    "✓ 旧 Dove 集成和研究状态已按确认删除",
    "✓ 新项目私有状态仅从 .dove/install/ 开始",
    "✓ 用户级 Dove 安装未被管理"
  ].join("\n");
  throw new Error(`Unsupported Dove lifecycle presentation: ${command}/${result?.status ?? "unknown"}.`);
}

export function renderDoveHome(options = {}) {
  const stream = options.stream ?? process.stdout;
  const env = options.env ?? process.env;
  const interactive = isInteractiveTerminal(stream);
  const color = terminalColorEnabled(stream, env);
  const state = options.state ?? (options.projectInitialized === true ? "current" : "uninitialized");
  const nextCommand = options.nextCommand ?? (
    state === "uninitialized"
      ? "dove"
      : state === "upgrade"
        ? "dove upgrade"
        : state === "needs-sync"
          ? "进入 Claude Code 时自动更新；dove doctor 可查看详情"
          : state === "blocked"
            ? "dove doctor"
            : "/dove:research"
  );
  const stateLabel = {
    uninitialized: "尚未配置 Dove",
    upgrade: "Dove 项目集成可从 1.0 升级",
    "needs-sync": "Dove 项目集成需要更新",
    current: "Dove 项目集成已是当前版本",
    blocked: "Dove 项目集成需要人工处理"
  }[state] ?? "Dove 项目状态未知";
  const lines = [];

  if (interactive) lines.push(renderDovePixelArt({ color }), "");
  lines.push(terminalStyle("Dove", "bold", { color }));
  lines.push("围绕科研主线探索，带回证据与经验。", "");
  lines.push(`${terminalStyle("当前项目", "dim", { color })}  ${stateLabel}`);
  const issues = Array.isArray(options.issues) ? options.issues : [];
  if (issues.length > 0) {
    const priority = { error: 0, warning: 1, info: 2 };
    const top = [...issues].sort((left, right) => priority[left.severity] - priority[right.severity])[0];
    lines.push(`${terminalStyle("Dove 问题", "dim", { color })}  ${top.summary}`);
    lines.push(`${terminalStyle("建议", "dim", { color })}  ${top.action}`);
  }
  lines.push("");
  lines.push(`${terminalStyle(interactive ? "选择" : "下一步", "bold", { color })}  ${nextCommand}`);
  lines.push(`${terminalStyle("帮助", "bold", { color })}  dove --help`);
  return lines.join("\n");
}

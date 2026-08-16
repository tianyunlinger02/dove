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

function terminalSafeText(value) {
  return String(value).replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
}

export function renderCompleteReinstallInventory(preview, options = {}) {
  if (!preview || preview.action !== "reinstall" || typeof preview.target !== "string" || !Array.isArray(preview.removedPaths) || !Array.isArray(preview.replacedPaths)) {
    throw new Error("Complete Reinstall inventory is invalid.");
  }
  const color = options.color === true;
  const removed = preview.removedPaths.length > 0
    ? preview.removedPaths.map((relativePath) => `- ${terminalSafeText(relativePath)}`)
    : ["- 无"];
  const replaced = preview.replacedPaths.length > 0
    ? preview.replacedPaths.map((relativePath) => `- ${terminalSafeText(relativePath)}`)
    : ["- 无"];
  return [
    terminalStyle("完全重新安装将永久重置以下 Dove 项目内容", "bold", { color }),
    "",
    `项目：${terminalSafeText(preview.target)}`,
    "",
    terminalStyle("将删除", "bold", { color }),
    ...removed,
    "",
    terminalStyle("将以当前默认内容替换", "bold", { color }),
    ...replaced,
    "",
    "确认后会重建当前项目集成和完整默认研究树。普通项目文件与用户级 Dove 安装不受管理。"
  ].join("\n");
}

export function renderDoveLifecycleResult(command, result, options = {}) {
  if (command !== "reinstall" || result?.status !== "reinstalled") {
    throw new Error(`Unsupported Dove lifecycle presentation: ${command}/${result?.status ?? "unknown"}.`);
  }
  const stream = options.stream ?? process.stdout;
  const env = options.env ?? process.env;
  const color = terminalColorEnabled(stream, env);
  return [
    terminalStyle("Dove 项目配置完全重新安装完成", "bold", { color }),
    "",
    "✓ 已按确认时重新读取的当前范围删除旧 Dove 项目内容",
    "✓ 当前项目集成和完整默认研究树已重建",
    "✓ 普通项目文件与用户级 Dove 安装未被管理",
    "",
    "默认研究文档只是可维护入口，不代表科研工作、结论或验证已经完成。"
  ].join("\n");
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
      : state === "needs-sync"
        ? "dove update"
        : state === "blocked"
          ? "dove doctor"
          : "/dove:research"
  );
  const stateLabel = {
    uninitialized: "尚未配置 Dove",
    "needs-sync": "Dove 项目集成需要更新",
    current: "Dove 项目集成已是当前版本",
    blocked: "Dove 项目集成需要人工处理"
  }[state] ?? "Dove 项目状态未知";
  const lines = [];

  if (interactive) lines.push(renderDovePixelArt({ color }), "");
  lines.push(terminalStyle("Dove", "bold", { color }));
  lines.push("围绕科研主线探索，带回证据与经验。", "");
  lines.push(`${terminalStyle("当前项目", "dim", { color })}  ${stateLabel}`);
  lines.push("");
  lines.push(`${terminalStyle(interactive ? "选择" : "下一步", "bold", { color })}  ${nextCommand}`);
  lines.push(`${terminalStyle("帮助", "bold", { color })}  dove --help`);
  return lines.join("\n");
}

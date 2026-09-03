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
    terminalStyle("将以当前 package 接入重建", "bold", { color }),
    ...replaced,
    "",
    "确认后会重建当前项目集成；.dove/research/**、.dove/reviews/**、.dove/runs/**、DOCTOR.md、普通项目文件与用户级 Dove 安装不受管理。"
  ].join("\n");
}

export function renderUninstallInventory(preview, options = {}) {
  if (!preview || preview.action !== "uninstall" || typeof preview.target !== "string" || !Array.isArray(preview.removedPaths)) {
    throw new Error("Dove uninstall inventory is invalid.");
  }
  const color = options.color === true;
  const removed = preview.removedPaths.length > 0 ? preview.removedPaths.map((item) => `- ${terminalSafeText(item)}`) : ["- 无"];
  return [
    terminalStyle("卸载 Dove 项目接入", "bold", { color }),
    "",
    `项目：${terminalSafeText(preview.target)}`,
    "",
    terminalStyle("将删除或移除", "bold", { color }),
    ...removed,
    "",
    terminalStyle("将保留", "bold", { color }),
    "- .dove/research/**",
    "- .dove/reviews/**",
    "- .dove/runs/**",
    "- .dove/install/DOCTOR.md",
    "- 其他未由 Dove 管理的项目文件、设置、Hooks 与 MCP",
    "",
    "确认后才会执行；取消不会修改任何文件。"
  ].join("\n");
}

export function renderDoveLifecycleResult(command, result, options = {}) {
  if (command === "uninstall" && result?.status === "uninstalled") {
    return [
      terminalStyle("Dove 已从当前项目卸载", "bold", { color: options.color === true }),
      "",
      "✓ Dove 项目接入、命令、agent、Hooks、MCP 声明和安装记录已移除",
      "✓ .dove/research/**、.dove/reviews/**、.dove/runs/** 与 .dove/install/DOCTOR.md 已保留",
      "✓ 未管理的项目文件未被修改"
    ].join("\n");
  }
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
    "✓ 当前项目集成已重建",
    "✓ .dove/research/**、.dove/reviews/**、.dove/runs/** 与 .dove/install/DOCTOR.md 已保留",
    "✓ 普通项目文件与用户级 Dove 安装未被管理",
    "",
    "研究文档只是研究者维护的普通入口，不代表科研工作、结论或验证已经完成。"
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
          : "进入支持的宿主后直接提出科研请求；Claude Code 中的 /dove:* 只是可选专项快捷入口"
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
  lines.push("完整科研 agent，围绕主线判断推进真实工作。", "");
  lines.push(`${terminalStyle("当前项目", "dim", { color })}  ${stateLabel}`);
  lines.push("");
  lines.push(`${terminalStyle(interactive ? "选择" : "下一步", "bold", { color })}  ${nextCommand}`);
  lines.push(`${terminalStyle("帮助", "bold", { color })}  dove --help`);
  return lines.join("\n");
}

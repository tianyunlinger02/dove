import path from "node:path";

import { confirm, select } from "@inquirer/prompts";

import { renderDoveDoctor } from "./doctor-output.mjs";
import {
  renderCompleteReinstallInventory,
  renderDoveLifecycleResult,
  renderDovePixelArt,
  terminalColorEnabled,
  terminalStyle
} from "./terminal-output.mjs";

function safeProjectName(target) {
  return path.basename(target || process.cwd()).replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
}

function setupCompleteLines(result, color) {
  const workspaceAbsent = result.workspaceState?.mode === "absent";
  const researchLine = workspaceAbsent ? "✓ Workspace 仍保持未建立" : "✓ 现有科研状态未被修改";
  return [
    "",
    terminalStyle("项目配置完成", "bold", { color }),
    "",
    "✓ Dove 项目集成已是当前版本",
    "✓ Dove MCP 已注册并仅在当前项目为你批准",
    "✓ Claude Code 自然语言入口已配置",
    researchLine,
    "",
    `${terminalStyle("下一步", "bold", { color })}  从当前项目进入或重新进入 Claude Code`,
    "进入后直接使用 Dove 项目入口。"
  ].join("\n");
}

function blockedMessage(result, color, stream, env) {
  return [
    renderDoveDoctor(result, { stream, env }),
    "",
    terminalStyle("Dove 检测到项目集成需要人工处理，未进行修改。", "bold", { color })
  ].join("\n");
}

function lifecycleTarget(result, fallback) {
  return result?.target ?? fallback;
}

async function runUpgrade({ target, upgrade, stream, env }) {
  if (typeof upgrade !== "function") {
    throw new Error("Dove 项目配置升级核心尚未接入。");
  }
  const result = await upgrade(target);
  stream.write(`\n${renderDoveLifecycleResult("upgrade", {
    ...result,
    target: lifecycleTarget(result, target)
  }, { stream, env })}\n`);
  return { status: "upgraded", action: "upgrade", result };
}

async function runCompleteReinstall({ target, completeReinstall, promptConfirm, stream, env, color }) {
  stream.write(`\n${renderCompleteReinstallInventory(target, { color })}\n\n`);
  const approved = await promptConfirm({
    message: "警告：这会永久删除当前项目中的全部 Dove 配置、研究状态和旧归档。确认完全重新安装项目配置？",
    default: false
  });
  if (!approved) {
    stream.write("未修改任何文件。\n");
    return { status: "cancelled", action: "reinstall", result: null };
  }
  if (typeof completeReinstall !== "function") {
    throw new Error("Dove 项目配置完全重装核心尚未接入。");
  }
  const result = await completeReinstall(target);
  stream.write(`\n${renderDoveLifecycleResult("reinstall", {
    ...result,
    target: lifecycleTarget(result, target)
  }, { stream, env })}\n`);
  return { status: "reinstalled", action: "reinstall", result };
}

export async function runInteractiveDoveSetup(options) {
  const {
    inspect,
    initialize,
    upgrade,
    completeReinstall,
    target = process.cwd(),
    promptConfirm = confirm,
    promptSelect = select,
    stream = process.stdout,
    env = process.env
  } = options;
  const color = terminalColorEnabled(stream, env);
  const initial = await inspect(target);
  const setupTarget = initial.target ?? target;
  const projectName = safeProjectName(setupTarget);

  stream.write(`${renderDovePixelArt({ color })}\n\n`);
  stream.write(`${terminalStyle("Dove", "bold", { color })}\n`);
  stream.write("围绕科研主线探索，带回证据与经验。\n\n");
  stream.write(`${terminalStyle("项目", "dim", { color })}  ${projectName}\n\n`);

  const setup = initial.setup ?? (
    ["invalid", "drifted"].includes(initial.projectIntegration?.state) || initial.legacyCopiedRuntime?.detected
      ? { mode: "blocked", reason: initial.projectIntegration?.state ?? "legacy-copied-runtime", allowedActions: ["exit"] }
      : {
        mode: initial.projectIntegration?.state === "uninitialized" ? "init" : "upgrade",
        reason: initial.projectIntegration?.state ?? "unknown",
        allowedActions: initial.projectIntegration?.state === "uninitialized" ? ["init", "exit"] : ["upgrade", "reinstall", "exit"]
      }
  );
  if (setup.mode === "blocked") {
    stream.write(`${blockedMessage(initial, color, stream, env)}\n`);
    return { status: "blocked", action: null, result: initial };
  }

  if (setup.allowedActions.includes("init")) {
    const action = await promptSelect({
      message: "当前项目尚未配置 Dove。请选择：",
      choices: [
        { name: "初始化项目配置", value: "init" },
        { name: "退出", value: "exit" }
      ]
    });
    if (action === "exit") {
      stream.write("未修改任何文件。\n");
      return { status: "exited", action: "exit", result: initial };
    }
    await initialize(setupTarget);
    const current = await inspect(setupTarget);
    stream.write(`${setupCompleteLines(current, color)}\n`);
    return { status: "initialized", action: "init", result: current };
  }

  const legacy = setup.reason === "valid-legacy";
  const action = await promptSelect({
    message: setup.allowedActions.includes("upgrade")
      ? legacy ? "检测到旧版 Dove 项目配置。请选择：" : "当前项目已配置 Dove。请选择："
      : "当前项目中的 Dove 状态需要完全重新安装。请选择：",
    choices: [
      ...(setup.allowedActions.includes("upgrade") ? [{ name: "升级项目配置", value: "upgrade" }] : []),
      ...(setup.allowedActions.includes("reinstall") ? [{ name: "完全重新安装项目配置", value: "reinstall" }] : []),
      { name: "退出", value: "exit" }
    ]
  });

  if (action === "upgrade") {
    return runUpgrade({ target: setupTarget, upgrade, stream, env });
  }
  if (action === "reinstall") {
    return runCompleteReinstall({
      target: setupTarget,
      completeReinstall,
      promptConfirm,
      stream,
      env,
      color
    });
  }
  stream.write("未修改任何文件。\n");
  return { status: "exited", action: "exit", result: initial };
}

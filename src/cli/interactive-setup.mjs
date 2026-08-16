import path from "node:path";

import { confirm, select } from "@inquirer/prompts";

import { renderDoveDoctor } from "./doctor-output.mjs";
import { renderProjectIntegrationResult } from "./project-integration-output.mjs";
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

function setupCompleteLines(_result, color) {
  return [
    "",
    terminalStyle("项目配置完成", "bold", { color }),
    "",
    "✓ Dove 项目集成已是当前版本",
    "✓ Claude Code 自然语言入口已配置",
    "✓ Prompt Hook 与 Skills 已安装",
    "✓ 按需论文搜索、下载与阅读 MCP 已声明",
    "✓ 完整默认研究目录与通用 Lessons 已建立",
    "",
    "论文工具需要本机已有 uvx，并在 Claude Code 首次使用时由你批准；Dove 未安装依赖、写入凭据或替你批准。",
    "默认研究文档是可维护的 Markdown 入口，不代表科研主线、结论或任务已经完成。",
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

async function runCompleteReinstall({ target, previewCompleteReinstall, completeReinstall, promptConfirm, stream, env, color }) {
  if (typeof previewCompleteReinstall !== "function") throw new Error("Dove 项目配置重装预览核心尚未接入。");
  const preview = await previewCompleteReinstall(target);
  stream.write(`\n${renderCompleteReinstallInventory(preview, { color })}\n\n`);
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
  const result = await completeReinstall(target, { confirmed: true });
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
    update,
    previewCompleteReinstall,
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
    ["invalid", "drifted"].includes(initial.projectIntegration?.state)
      ? { mode: "blocked", reason: initial.projectIntegration?.state, allowedActions: ["exit"] }
      : {
        mode: initial.projectIntegration?.state === "uninitialized" ? "init" : "reinstall",
        reason: initial.projectIntegration?.state ?? "unknown",
        allowedActions: initial.projectIntegration?.state === "uninitialized" ? ["init", "exit"] : ["reinstall", "exit"]
      }
  );
  if (setup.mode === "blocked") {
    stream.write(`${blockedMessage(initial, color, stream, env)}\n`);
    return { status: "blocked", action: null, result: initial };
  }

  if (setup.mode === "update") {
    const action = await promptSelect({
      message: "检测到 Dove 项目接入需要更新。请选择：",
      choices: [
        { name: "更新项目接入", value: "update" },
        ...(setup.allowedActions.includes("reinstall") ? [{ name: "重新安装", value: "reinstall" }] : []),
        { name: "退出", value: "exit" }
      ]
    });
    if (action === "exit") {
      stream.write("未修改任何文件。\n");
      return { status: "exited", action: "exit", result: initial };
    }
    if (action === "reinstall") {
      return runCompleteReinstall({
        target: setupTarget,
        previewCompleteReinstall,
        completeReinstall,
        promptConfirm,
        stream,
        env,
        color
      });
    }
    if (typeof update !== "function") throw new Error("Dove 项目接入更新核心尚未接入。");
    const result = await update(setupTarget);
    stream.write(`\n${renderProjectIntegrationResult("update", {
      ...result,
      target: lifecycleTarget(result, setupTarget)
    }, { stream, env })}\n`);
    return { status: result.status, action: "update", result };
  }

  if (setup.allowedActions.includes("init")) {
    const action = await promptSelect({
      message: "当前项目尚未配置 Dove。请选择：",
      choices: [
        { name: "安装", value: "init" },
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

  const action = await promptSelect({
    message: "当前项目已配置 Dove。请选择：",
    choices: [
      ...(setup.allowedActions.includes("reinstall") ? [{ name: "重新安装", value: "reinstall" }] : []),
      { name: "退出", value: "exit" }
    ]
  });

  if (action === "reinstall") {
    return runCompleteReinstall({
      target: setupTarget,
      previewCompleteReinstall,
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

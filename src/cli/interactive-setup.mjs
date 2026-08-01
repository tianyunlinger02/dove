import path from "node:path";

import { confirm, select } from "@inquirer/prompts";

import { renderDoveDoctor } from "./doctor-output.mjs";
import {
  renderDovePixelArt,
  terminalColorEnabled,
  terminalStyle
} from "./terminal-output.mjs";

function safeProjectName(target) {
  return path.basename(target || process.cwd()).replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
}

function setupCompleteLines(result, color, options = {}) {
  const workspaceAbsent = result.workspaceState?.mode === "absent";
  const researchLine = options.overlayUpgrade
    ? options.archiveTarget
      ? "✓ 当前科研状态已归档并重置"
      : "✓ 科研主线仍保持未建立"
    : workspaceAbsent ? "✓ 科研主线仍保持未建立" : "✓ 现有科研状态未被修改";
  const lines = [
    "",
    terminalStyle("项目配置完成", "bold", { color }),
    "",
    "✓ Dove 项目集成已是当前版本",
    "✓ Dove MCP 已注册并仅在当前项目为你批准",
    "✓ Claude Code 自然语言入口已配置",
    researchLine
  ];
  if (options.overlayUpgrade) lines.push("✓ 项目文件和已有归档均已保留");
  const hostAction = options.overlayUpgrade ? "重新进入" : "进入或重新进入";
  lines.push(
    "",
    `${terminalStyle("下一步", "bold", { color })}  从当前项目${hostAction} Claude Code`,
    "进入后直接运行 /dove:workspace。"
  );
  return lines.join("\n");
}

function blockedMessage(result, color, stream, env, options = {}) {
  const lines = [renderDoveDoctor(result, { stream, env }), ""];
  if (options.overlayPreviewFailed) {
    lines.push(terminalStyle("Dove 无法明确判定覆盖升级是否安全，未进行覆盖。", "bold", { color }));
    if (options.previewErrorMessage) lines.push(options.previewErrorMessage);
  } else if (result.legacyCopiedRuntime?.detected) {
    lines.push(terminalStyle("Dove 不会自动覆盖旧项目内运行时或科研状态。", "bold", { color }));
  } else {
    lines.push(terminalStyle("Dove 检测到项目文件已被修改，未进行覆盖。", "bold", { color }));
  }
  return lines.join("\n");
}

function safePreviewErrorMessage(error) {
  const candidates = [error?.publicMessage, error?.report?.message];
  return candidates.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? null;
}

async function confirmAction(message, promptConfirm, defaultValue = true) {
  return promptConfirm({ message, default: defaultValue });
}

export async function runInteractiveDoveSetup(options) {
  const {
    inspect,
    initialize,
    synchronize,
    previewOverlayUpgrade,
    overlayUpgrade,
    target = process.cwd(),
    promptConfirm = confirm,
    promptSelect = select,
    stream = process.stdout,
    env = process.env
  } = options;
  const color = terminalColorEnabled(stream, env);
  const initial = await inspect(target);
  const projectName = safeProjectName(initial.target ?? target);

  stream.write(`${renderDovePixelArt({ color })}\n\n`);
  stream.write(`${terminalStyle("Dove", "bold", { color })}\n`);
  stream.write(`围绕科研主线探索，带回证据与经验。\n\n`);
  stream.write(`${terminalStyle("项目", "dim", { color })}  ${projectName}\n\n`);

  const overlayEligibleState = initial.legacyCopiedRuntime?.detected
    || ["invalid", "drifted"].includes(initial.projectIntegration?.state);
  let overlayPreview = null;
  let overlayPreviewFailed = false;
  let previewErrorMessage = null;
  if (overlayEligibleState) {
    try {
      overlayPreview = await previewOverlayUpgrade(target);
    } catch (error) {
      overlayPreviewFailed = true;
      previewErrorMessage = safePreviewErrorMessage(error);
    }
  }
  const canOverlayUpgrade = overlayPreview?.status === "ready" && overlayPreviewFailed === false;

  if (overlayEligibleState) {
    stream.write(`${blockedMessage(initial, color, stream, env, {
      overlayPreviewFailed: !canOverlayUpgrade,
      previewErrorMessage
    })}\n`);
    if (!canOverlayUpgrade) {
      return { status: "blocked", action: null, result: initial, preview: null };
    }
    const blockedAction = await promptSelect({
      message: "请选择如何继续：",
      choices: [
        { name: "覆盖升级 Dove（归档当前科研状态）", value: "overlay" },
        { name: "退出", value: "exit" }
      ]
    });
    if (blockedAction === "exit") {
      stream.write("未修改任何文件。\n");
      return { status: "exited", action: "exit", result: initial, preview: overlayPreview };
    }
  }

  async function runOverlay(preview = null) {
    let currentPreview = preview;
    if (currentPreview === null) {
      try {
        currentPreview = await previewOverlayUpgrade(target);
      } catch (error) {
        stream.write(`${blockedMessage(initial, color, stream, env, {
          overlayPreviewFailed: true,
          previewErrorMessage: safePreviewErrorMessage(error)
        })}\n`);
        return { status: "blocked", action: "overlay", result: initial, preview: null };
      }
    }
    if (currentPreview?.status !== "ready") {
      stream.write(`${blockedMessage(initial, color, stream, env, { overlayPreviewFailed: true })}\n`);
      return { status: "blocked", action: "overlay", result: initial, preview: null };
    }
    const confirmed = await confirmAction(
      "覆盖升级会替换项目集成的本地修改，归档并重置当前科研状态；项目文件和已有归档会保留。继续？",
      promptConfirm,
      false
    );
    if (!confirmed) {
      stream.write("未修改任何文件。\n");
      return { status: "cancelled", action: "overlay", result: initial, preview: currentPreview };
    }
    const upgrade = await overlayUpgrade(target, currentPreview);
    const current = await inspect(target);
    stream.write(`${setupCompleteLines(current, color, {
      overlayUpgrade: true,
      archiveTarget: upgrade?.archiveTarget ?? null
    })}\n`);
    return { status: "overlay-upgraded", action: "overlay", result: current, preview: currentPreview, upgrade };
  }

  if (overlayEligibleState) return runOverlay(overlayPreview);

  if (initial.projectIntegration?.state === "uninitialized") {
    const confirmed = await confirmAction("为当前项目启用 Dove 的 Claude Code 集成？", promptConfirm);
    if (!confirmed) {
      stream.write("未修改任何文件。\n");
      return { status: "cancelled", action: "init", result: initial };
    }
    await initialize(target);
    const current = await inspect(target);
    stream.write(`${setupCompleteLines(current, color)}\n`);
    return { status: "initialized", action: "init", result: current };
  }

  if (initial.projectIntegration?.state === "needs-sync") {
    const confirmed = await confirmAction("检测到旧版 Dove 项目集成。现在安全更新？", promptConfirm);
    if (!confirmed) {
      stream.write("未修改任何文件。下次输入 dove 可以继续更新。\n");
      return { status: "cancelled", action: "sync", result: initial };
    }
    await synchronize(target);
    const current = await inspect(target);
    stream.write(`${setupCompleteLines(current, color)}\n`);
    return { status: "synchronized", action: "sync", result: current };
  }

  const action = await promptSelect({
    message: "Dove 已在当前项目配置。请选择：",
    choices: [
      { name: "检查连接与科研主线", value: "doctor" },
      { name: "重新同步项目集成", value: "sync" },
      { name: "覆盖升级 Dove（归档当前科研状态）", value: "overlay" },
      { name: "退出", value: "exit" }
    ]
  });

  if (action === "sync") {
    await synchronize(target);
    const current = await inspect(target);
    stream.write(`${setupCompleteLines(current, color)}\n`);
    return { status: "synchronized", action: "sync", result: current };
  }
  if (action === "overlay") return runOverlay();
  if (action === "doctor") {
    const current = await inspect(target);
    stream.write(`\n${renderDoveDoctor(current, { stream, env })}\n`);
    return { status: "inspected", action: "doctor", result: current };
  }
  stream.write("未修改任何文件。\n");
  return { status: "exited", action: "exit", result: initial };
}

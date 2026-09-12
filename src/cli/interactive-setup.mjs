import path from "node:path";

import { checkbox, confirm, select } from "@inquirer/prompts";

import {
  DEFAULT_INITIALIZABLE_HOSTS,
  HOST_REGISTRY,
  PROJECT_HOST_IDS
} from "../core/host-registry.mjs";
import { renderDoveDoctor } from "./doctor-output.mjs";
import { renderProjectIntegrationResult } from "./project-integration-output.mjs";
import {
  renderCompleteReinstallInventory,
  renderDoveLifecycleResult,
  renderDovePixelArt,
  renderUninstallInventory,
  terminalColorEnabled,
  terminalStyle
} from "./terminal-output.mjs";

function safeProjectName(target) {
  return path.basename(target || process.cwd()).replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
}

function resultHosts(result) {
  return result.hosts ?? result.projectIntegration?.manifest?.hosts ?? [];
}

function lifecycleTarget(result, fallback) {
  return result?.target ?? fallback;
}

function hostChoices(selectedHosts = DEFAULT_INITIALIZABLE_HOSTS) {
  return PROJECT_HOST_IDS.map((hostId) => ({
    name: HOST_REGISTRY[hostId].label,
    value: hostId,
    checked: selectedHosts.includes(hostId)
  }));
}

async function selectHosts(promptCheckbox, selectedHosts, message = "选择要安装 Dove 的平台：") {
  return promptCheckbox({
    message,
    choices: hostChoices(selectedHosts),
    required: true
  });
}

function setupSummary(result, color) {
  const state = result.projectIntegration?.state;
  if (state === "blocked" || result.setup?.mode === "blocked") {
    return [
      terminalStyle("项目接入需要处理", "bold", { color }),
      "Dove 无法安全确认当前项目接入状态，因此没有自动修改文件。"
    ].join("\n");
  }
  if (result.setup?.mode === "needs-update") return "Dove 项目接入可以安全更新。";
  if (result.setup?.mode === "current") return "Dove 项目接入已是当前版本。";
  return "当前项目尚未配置 Dove。";
}

function menuMessage(setup) {
  if (setup.mode === "uninitialized") return "当前项目尚未配置 Dove。请选择：";
  if (setup.mode === "needs-update") return "Dove 项目接入需要更新。请选择：";
  if (setup.mode === "current") return "Dove 已在当前项目配置。请选择：";
  return "Dove 项目接入需要处理。请选择：";
}

function actionChoices(setup) {
  const allowed = new Set(setup.allowedActions ?? []);
  const choices = [];
  if (allowed.has("init")) choices.push({ name: "安装项目接入", value: "init" });
  if (allowed.has("update")) choices.push({ name: "更新当前平台", value: "update" });
  if (allowed.has("change-hosts")) choices.push({ name: setup.mode === "current" ? "更改安装平台" : "更改平台并更新", value: "change-hosts" });
  if (allowed.has("reinstall")) choices.push({ name: "完全重新安装项目接入", value: "reinstall" });
  if (allowed.has("uninstall")) choices.push({ name: "卸载 Dove 项目接入", value: "uninstall" });
  if (allowed.has("details")) choices.push({ name: "查看详情", value: "details" });
  choices.push({ name: "退出", value: "exit" });
  return choices;
}

async function runUninstall({ target, previewUninstall, uninstall, promptConfirm, stream, env, color }) {
  if (typeof previewUninstall !== "function" || typeof uninstall !== "function") throw new Error("Dove 项目卸载核心尚未接入。");
  const preview = await previewUninstall(target);
  stream.write(`\n${renderUninstallInventory(preview, { color })}\n\n`);
  const approved = await promptConfirm({
    message: "确认从当前项目卸载 Dove？研究 Markdown 与 DOCTOR.md 会保留。",
    default: false
  });
  if (!approved) {
    stream.write("未修改任何文件。\n");
    return { status: "cancelled", action: "uninstall", result: null };
  }
  const result = await uninstall(target, { confirmed: true, preview });
  stream.write(`\n${renderDoveLifecycleResult("uninstall", result, { stream, env })}\n`);
  return { status: "uninstalled", action: "uninstall", result };
}

async function runCompleteReinstall({ target, hosts, previewCompleteReinstall, completeReinstall, promptConfirm, stream, env, color }) {
  if (typeof previewCompleteReinstall !== "function") throw new Error("Dove 项目配置重装预览核心尚未接入。");
  const lifecycleOptions = hosts?.length > 0 ? { hosts } : {};
  const preview = await previewCompleteReinstall(target, lifecycleOptions);
  stream.write(`\n${renderCompleteReinstallInventory(preview, { color })}\n\n`);
  const approved = await promptConfirm({
    message: "警告：这会按上方范围重建 Dove 管理的项目接入；研究 Markdown 与 DOCTOR.md 会保留。确认重新安装？",
    default: false
  });
  if (!approved) {
    stream.write("未修改任何文件。\n");
    return { status: "cancelled", action: "reinstall", result: null };
  }
  if (typeof completeReinstall !== "function") throw new Error("Dove 项目配置完全重装核心尚未接入。");
  const result = await completeReinstall(target, { ...lifecycleOptions, confirmed: true, preview });
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
    previewUninstall,
    uninstall,
    target = process.cwd(),
    promptCheckbox = checkbox,
    promptConfirm = confirm,
    promptSelect = select,
    stream = process.stdout,
    env = process.env
  } = options;
  const color = terminalColorEnabled(stream, env);
  const initial = await inspect(target);
  const setupTarget = initial.target ?? target;
  const projectName = safeProjectName(setupTarget);
  const setup = initial.setup;
  if (!setup || !Array.isArray(setup.allowedActions)) throw new Error("Dove 项目状态缺少可用的交互操作。");

  stream.write(`${renderDovePixelArt({ color })}\n\n`);
  stream.write(`${terminalStyle("Dove", "bold", { color })}\n`);
  stream.write("完整科研 agent，围绕主线判断推进真实工作。\n\n");
  stream.write(`${terminalStyle("项目", "dim", { color })}  ${projectName}\n\n`);
  stream.write(`${setupSummary(initial, color)}\n\n`);

  while (true) {
    const action = await promptSelect({
      message: menuMessage(setup),
      choices: actionChoices(setup)
    });

    if (action === "exit") {
      stream.write("未修改任何文件。\n");
      return { status: "exited", action: "exit", result: initial };
    }
    if (action === "details") {
      stream.write(`\n${renderDoveDoctor(initial, { stream, env })}\n\n`);
      continue;
    }
    if (action === "init") {
      const hosts = await selectHosts(promptCheckbox, DEFAULT_INITIALIZABLE_HOSTS);
      const result = await initialize(setupTarget, { hosts });
      const current = await inspect(setupTarget);
      stream.write(`\n${renderProjectIntegrationResult("init", result, { stream, env })}\n`);
      return { status: "initialized", action: "init", result: current };
    }
    if (action === "update") {
      if (typeof update !== "function") throw new Error("Dove 项目接入更新核心尚未接入。");
      const result = await update(setupTarget);
      stream.write(`\n${renderProjectIntegrationResult("update", {
        ...result,
        target: lifecycleTarget(result, setupTarget)
      }, { stream, env })}\n`);
      return { status: result.status, action: "update", result };
    }
    if (action === "change-hosts") {
      if (typeof update !== "function") throw new Error("Dove 项目平台更新核心尚未接入。");
      const hosts = await selectHosts(promptCheckbox, resultHosts(initial), "选择要保留的 Dove 安装平台：");
      const result = await update(setupTarget, { hosts });
      stream.write(`\n${renderProjectIntegrationResult("update", {
        ...result,
        target: lifecycleTarget(result, setupTarget)
      }, { stream, env })}\n`);
      return { status: result.status, action: "change-hosts", result };
    }
    if (action === "reinstall") {
      return runCompleteReinstall({
        target: setupTarget,
        hosts: resultHosts(initial),
        previewCompleteReinstall,
        completeReinstall,
        promptConfirm,
        stream,
        env,
        color
      });
    }
    if (action === "uninstall") {
      return runUninstall({
        target: setupTarget,
        previewUninstall,
        uninstall,
        promptConfirm,
        stream,
        env,
        color
      });
    }
    throw new Error(`Dove 交互菜单不支持操作：${String(action)}。`);
  }
}

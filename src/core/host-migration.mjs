import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PACKAGE_VERSION } from "./package-metadata.mjs";
import { openRootedFilesystem } from "./rooted-filesystem.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";

export const HOST_MIGRATION_PENDING_PATH = ".dove/install/MIGRATION_PENDING.md";
export const HOST_MIGRATION_REGISTERED_PATH = ".dove/install/migration-registered.json";

// Carry forward record normalization for consumers skipping earlier releases.
// Leave empty in a release that has no host-side migration work.
export const HOST_MIGRATION_TASK = `整理 3.4.0 起已有的研究记录，只处理已有内容，不为迁移另开研究任务：

1. 身份卡保留主线、核心能力和用户原话，研究状态改约300字白话并放前面。Method design 指向已有三段论证的 brief；没有就留空，不补造设计或用户确认。限制附原话、日期来源和适用范围；缺目标档次且没问过就问一次。
2. .dove/research/EVAL.md 改为一个方法版本一行，单元格写已有数字加一句话（约 200 字符）；旧的长内容原样移到同目录历史文件并链接，结论和结果保持原样。
3. MENTOR_NOTES.md 超过约 6000 字符时，下次正常导师调用请导师合并成约 3000 字符的全文。
4. watch/config.json 仍是 draft 时，下次正常导师调用请导师给出追踪修正建议，主会话写回并标 source: mentor。要等下次调用的事项在已有记录里留一句提醒，这一项就算完成。
5. 选题仍一轮交有来源的候选供用户选，不等方法闭合。已定主线接下来先打通真实评测；新方法的三段论证让用户看过，连续两轮无新科研结果就问用户继续、换方法还是换方向。只改后续安排，不重跑、不改进行中材料或用户标准。
6. 核对当前身份卡和说明里的限制：必须指到用户原话，不把宿主自加的单卡、绑卡或验证要求当授权边界。验证跟决策相称，结果无争议不做哈希、指纹、逐位等价或释放核验。
7. 当前记录用自然中文讲做了什么、真实结果、含义和下一步，去掉无解释代号和套话。说明补“一句话：”和“## 预期结果”，结果补“一句话：”和“## 预期与实际”，旧轮次不回改。
8. 身份卡加“Core capability（核心能力）”一栏：从用户历史原话里找这个研究必须体现的能力并附原话；找不到就问用户一次。若当前做法已不再体现它，用大白话说明一次拿掉了什么、原路线为何停下，按用户回答执行并记录，不重复提。`;

function settingsPath(options) {
  const env = options.env ?? process.env;
  const base = env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), ".config");
  if (!path.isAbsolute(base)) throw new Error("Dove user configuration root must be absolute.");
  return path.join(base, "dove/settings.json");
}

function hostSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || (value.hostMigration !== undefined && typeof value.hostMigration !== "boolean")) {
    throw new Error("Dove host settings require a boolean hostMigration value.");
  }
  return { ...value, hostMigration: value.hostMigration ?? false };
}

export function readHostSettings(options = {}) {
  const fsOps = options.fsOps ?? fs;
  try {
    return hostSettings(parseJsonWithoutDuplicateKeys(fsOps.readFileSync(settingsPath(options), "utf8"), "Dove host settings"));
  } catch (error) {
    if (error?.code === "ENOENT") return { hostMigration: false };
    throw error;
  }
}

export function writeHostSettings(value, options = {}) {
  hostSettings(value);
  const settings = hostSettings({ ...readHostSettings(options), ...value });
  const fsOps = options.fsOps ?? fs;
  const file = settingsPath(options);
  fsOps.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  fsOps.writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  fsOps.renameSync(temporary, file);
  return settings;
}

function migrationFile(project, relativePath, options) {
  const root = openRootedFilesystem(project, options);
  if (!root.exists(relativePath)) return null;
  return root.readFile(relativePath).toString("utf8");
}

export function renderHostMigrationPending(version = PACKAGE_VERSION, now = new Date()) {
  const timestamp = new Date(now).toISOString();
  return `# Dove ${version} 宿主迁移待办\n\n登记时间：${timestamp}\n\nDove 已更新到 ${version}。请在当前工作告一段落时完成以下迁移，不打断当前在跑的任务，不暂停或重启训练/评测，不改动研究结论和用户原话，不重算任何结果。完成后删除 ${HOST_MIGRATION_PENDING_PATH}，并在回复中用一句话说明做了什么；不适用的事项说明一句原因也算完成。此待办不取代用户当前请求或其写入限制。\n\n${HOST_MIGRATION_TASK}\n`;
}

export function prepareHostMigration(project, options = {}) {
  const version = options.packageVersion ?? PACKAGE_VERSION;
  if (!HOST_MIGRATION_TASK || version !== PACKAGE_VERSION || !migrationEnabled(options)) return [];
  const registered = migrationFile(project, HOST_MIGRATION_REGISTERED_PATH, options);
  const prior = registered ? parseJsonWithoutDuplicateKeys(registered, HOST_MIGRATION_REGISTERED_PATH) : null;
  // Register only when the migration content itself changed; a release that
  // keeps the same task leaves completed projects alone. Records written
  // before the task was stored compare by version, as they did then.
  if (prior && (prior.task === undefined ? prior.version === version : prior.task === HOST_MIGRATION_TASK)) return [];
  // The current task already contains every earlier item, so it replaces any
  // unfinished notice instead of stacking another copy after it.
  return [
    { root: project, relativePath: HOST_MIGRATION_PENDING_PATH, content: renderHostMigrationPending(version, options.now), force: true },
    { root: project, relativePath: HOST_MIGRATION_REGISTERED_PATH, content: `${JSON.stringify({ version, task: HOST_MIGRATION_TASK })}\n`, force: true }
  ];
}

// A settings file that does not parse (for example after a hand edit) turns
// migration off instead of taking install or the hooks down.
function migrationEnabled(options) {
  try {
    return readHostSettings(options).hostMigration === true;
  } catch {
    return false;
  }
}

export function hostMigrationContext(project, options = {}) {
  if (!project || !migrationEnabled(options)) return "";
  const pending = migrationFile(project, HOST_MIGRATION_PENDING_PATH, options);
  return pending?.trim() ? `\n\n${pending.trim()}` : "";
}

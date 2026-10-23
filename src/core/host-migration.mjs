import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PACKAGE_VERSION } from "./package-metadata.mjs";
import { openRootedFilesystem } from "./rooted-filesystem.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";

export const HOST_MIGRATION_PENDING_PATH = ".dove/install/MIGRATION_PENDING.md";
export const HOST_MIGRATION_REGISTERED_PATH = ".dove/install/migration-registered.json";

// What a running project changes once to use this release's records. A new
// task replaces an unfinished earlier notice, so items still worth doing from
// the previous task are carried in it.
// Leave empty in a release that has no host-side migration work.
export const HOST_MIGRATION_TASK = `把研究记录接到新的记录格式上：只补格式和缺的字段，不重跑、不改结论和用户原话，旧轮次不回改。

1. EVAL 开头补一行主指标：\`主指标：<名称>（<数据与协议>）；当前最好：<值>（<日期>，第 N 轮）\`。主指标是真实任务上最能代表最终目标的那个数；你按完成标准起草，然后问用户确认一次。
2. EVAL 的八维部分改成走势表，列为日期、轮次、八个等级、最卡的一维；从现有的最近一次判断记第一行，表下保留它的详细依据。方法版本表一个版本一行，数字写成“数值/分母+单位”，每行链接结果文件；放不进表格的旧长内容原样移到同目录的历史文件并链接。
3. 进行中的这一轮，在说明开头补上三行：\`对准：<八维中的一维>\`（取最近一次导师判断里最卡的那一维）、\`见分晓：YYYY-MM-DD（开始：YYYY-MM-DD）\`、\`规模：<样本数、训练量和算力，以及为什么足以分出结果>\`。
4. 研究状态以后由导师写：下次请导师判断时，把导师返回的研究状态原样更新到身份卡。
5. 上一版迁移里还没做的两项：身份卡没有 Core capability（核心能力）一栏的，从用户历史原话里找出处补上，找不到就问用户一次；User restrictions 里没附用户原话的限制，找到原话补上，找不到就删去。`;

function settingsPath(options) {
  const env = options.env ?? process.env;
  const base = env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), ".config");
  if (!path.isAbsolute(base)) throw new Error("Dove user configuration root must be absolute.");
  return path.join(base, "dove/settings.json");
}

function hostSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || (value.hostMigration !== undefined && typeof value.hostMigration !== "boolean")
    || (value.stopPrompts !== undefined && typeof value.stopPrompts !== "boolean")) {
    throw new Error("Dove host settings require boolean hostMigration and stopPrompts values.");
  }
  // stopPrompts stays absent until the user sets it; absent means on.
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

// Dove's Stop prompts are on unless the user turned them off; an unreadable
// settings file keeps the default.
export function stopPromptsEnabled(options = {}) {
  try {
    return readHostSettings(options).stopPrompts !== false;
  } catch {
    return true;
  }
}

export function hostMigrationContext(project, options = {}) {
  if (!project || !migrationEnabled(options)) return "";
  const pending = migrationFile(project, HOST_MIGRATION_PENDING_PATH, options);
  return pending?.trim() ? `\n\n${pending.trim()}` : "";
}

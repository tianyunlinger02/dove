import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PACKAGE_VERSION } from "./package-metadata.mjs";
import { openRootedFilesystem } from "./rooted-filesystem.mjs";

export const HOST_MIGRATION_PENDING_PATH = ".dove/install/MIGRATION_PENDING.md";
export const HOST_MIGRATION_REGISTERED_PATH = ".dove/install/migration-registered.json";

// Carry forward record normalization for consumers skipping earlier releases.
// Leave empty in a release that has no host-side migration work.
export const HOST_MIGRATION_TASK = `整理 3.4.0 起已有的研究记录，只处理已有内容，不为迁移另开研究任务：

1. .dove/research/IDENTITY.md 改为规则里的固定栏目，篇幅一眼能读完（约 1200 字符）；未变的 Mainline 和用户原话保留，过长的原文移到同目录历史文件并链接；缺 Target tier 且没问过就问一次；每条限制注明引文、来源、原话还是转述、长期还是单次任务。
2. .dove/research/EVAL.md 改为一个方法版本一行，单元格写已有数字加一句话（约 200 字符）；旧的长内容原样移到同目录历史文件并链接，结论和结果保持原样。
3. MENTOR_NOTES.md 超过约 6000 字符时，下次正常导师调用请导师合并成约 3000 字符的全文。
4. watch/config.json 仍是 draft 时，下次正常导师调用请导师给出追踪修正建议，主会话写回并标 source: mentor。要等下次调用的事项在已有记录里留一句提醒，这一项就算完成。
5. 仍在选题时，下次正常回复按质量摘要一轮交候选、近邻及最佳 2–3 个方向，不足给 1 个，不重跑。推荐供定主线，不等方法闭合，正式产物门槛不扣住推荐；标准矛盾或禁取证据卡住时，说明一次仍给方向，请用户选或调标准，不静态打磨。确认后结束选题期限制，缺的独立资源／跑模型授权合并问一次，再诊断、设计、实验、写开题；已有主线续做。不改项目及用户级标准、进行中选题材料，只改后续安排。
6. 清理自设限制：看 IDENTITY 的 User restrictions、当前 brief 和在用的执行协议，执行者或导师自己加的限制与检查（哈希、冻结、等价门禁、只读清单等）逐条写一句它保护什么；说不出保护对象的删掉或改为一句说明，用户原话定的限制原样保留。`;

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
  return { hostMigration: value.hostMigration ?? false };
}

export function readHostSettings(options = {}) {
  const fsOps = options.fsOps ?? fs;
  try {
    return hostSettings(JSON.parse(fsOps.readFileSync(settingsPath(options), "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") return { hostMigration: false };
    throw error;
  }
}

export function writeHostSettings(value, options = {}) {
  const settings = hostSettings(value);
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
  if (!HOST_MIGRATION_TASK || version !== PACKAGE_VERSION || !readHostSettings(options).hostMigration) return [];
  const registered = migrationFile(project, HOST_MIGRATION_REGISTERED_PATH, options);
  const prior = registered ? JSON.parse(registered) : null;
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

export function hostMigrationContext(project, options = {}) {
  if (!project || !readHostSettings(options).hostMigration) return "";
  const pending = migrationFile(project, HOST_MIGRATION_PENDING_PATH, options);
  return pending?.trim() ? `\n\n${pending.trim()}` : "";
}

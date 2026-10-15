import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PACKAGE_VERSION } from "./package-metadata.mjs";
import { openRootedFilesystem } from "./rooted-filesystem.mjs";

export const HOST_MIGRATION_PENDING_PATH = ".dove/install/MIGRATION_PENDING.md";
export const HOST_MIGRATION_REGISTERED_PATH = ".dove/install/migration-registered.json";

// This release also brings existing 3.4.0 records into the current format.
// Leave empty in a release that has no host-side migration work.
export const HOST_MIGRATION_TASK = `整理 3.4.0 起已有的研究记录，只处理已有内容，不为迁移另开研究任务：

1. 将 .dove/research/IDENTITY.md 整理为不超过 1200 字符的固定栏目，顺序为 Current round、Round status、Mainline、Target tier、Deployment inputs/outputs、Completion、User restrictions、Recent corrections、Research state。保留未变的 Mainline 和用户原话；过长的原始内容原样留在同目录历史文件并链接，不丢弃。Target tier 缺失且尚未询问时，问用户一次，不自行推定。限制条目注明原话、日期/来源、原话还是转述、长期还是本次任务适用。
2. 将 .dove/research/EVAL.md 整理为一个方法版本一行，保留完成标准引用，列为 Date、Version/round、Protocol/split、Measurements、Unseen data/train-test gap、Conclusion、Artifacts；单元格以已有数字和至多一句短句为主，不超过 200 字符。旧的长内容原样移到同目录的历史文件并链接，不删除、不改研究结论、不补造或重算任何结果。
3. 若 .dove/research/MENTOR_NOTES.md 超过 6000 字符，在下一次正常导师调用时请导师合并为不超过 3000 字符的全文，保留关键原因和未解决担忧；不要由执行者代写，不为此中断当前工作或另开导师调用。
4. 若 .dove/research/watch/config.json 的 source 仍为 draft，在下一次正常导师调用时一并请导师给出针对当前问题的追踪修正建议，由主会话写回并标为 source: mentor。缺少的研究记录无需为迁移创建。等待下一次导师调用的事项应在已有工作记录中留下简短提醒后完成本次待办，不抢跑导师调用。`;

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
  if (registered && JSON.parse(registered).version === version) return [];
  const pending = migrationFile(project, HOST_MIGRATION_PENDING_PATH, options);
  const content = renderHostMigrationPending(version, options.now);
  return [
    { root: project, relativePath: HOST_MIGRATION_PENDING_PATH, content: pending ? `${pending.trimEnd()}\n\n${content}` : content, force: true },
    { root: project, relativePath: HOST_MIGRATION_REGISTERED_PATH, content: `${JSON.stringify({ version })}\n`, force: true }
  ];
}

export function hostMigrationContext(project, options = {}) {
  if (!project || !readHostSettings(options).hostMigration) return "";
  const pending = migrationFile(project, HOST_MIGRATION_PENDING_PATH, options);
  return pending?.trim() ? `\n\n${pending.trim()}` : "";
}

import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { normalizeWatchConfig, readWatchConfig, writeWatchConfig } from "./paper-watch.mjs";
import { resolveInstalledProjectRoot } from "./project-root.mjs";
import { openRootedFilesystem } from "./rooted-filesystem.mjs";

const CONFIG_PATH = ".dove/research/watch/config.json";
const MENTOR_FIELDS = new Set(["keywords", "authors", "venues", "institutions", "seedPapers"]);

function readSuggestion(file, fsOps) {
  let value;
  try {
    if (!fsOps.statSync(file).isFile()) throw new Error("必须指向普通 JSON 文件。");
    value = JSON.parse(fsOps.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`无法读取 --mentor 建议 JSON 文件 ${file}：${error.message}`, { cause: error });
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("导师追踪建议必须是 JSON 对象。");
  const fields = Object.keys(value);
  const unknown = fields.filter((field) => !MENTOR_FIELDS.has(field));
  if (unknown.length) throw new Error(`导师追踪建议不接受字段：${unknown.join("、")}；未写入配置。`);
  if (!fields.length) throw new Error(`导师追踪建议至少需要一个字段：${[...MENTOR_FIELDS].join("、")}；未写入配置。`);
  for (const field of fields) {
    if (!Array.isArray(value[field]) || value[field].some((item) => typeof item !== "string")) {
      throw new Error(`导师追踪建议的 ${field} 必须是字符串数组（可用 [] 清空）；未写入配置。`);
    }
  }
  return { value, fields };
}

function readExistingConfig(rooted) {
  let value;
  try {
    value = JSON.parse(rooted.readFile(CONFIG_PATH).toString("utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw new Error(`无法读取已有追踪配置 ${rooted.displayPath(CONFIG_PATH)}；未覆盖：${error.message}`, { cause: error });
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("已有追踪配置必须是 JSON 对象；未覆盖。");
  return value;
}

/** Explicitly save a mentor suggestion file for one installed project, without retrieval or model calls.
 * fsOps injects filesystem checks; persistence uses the shared watch writer.
 */
export function configureWatchFromMentor(project, mentorFile, options = {}) {
  if (typeof project !== "string" || !project.trim()) throw new Error("dove watch configure 需要 --project <root>，只保存这个项目的配置。");
  if (typeof mentorFile !== "string" || !mentorFile.trim()) throw new Error("dove watch configure 需要 --mentor <json-file>（建议 JSON 文件路径，不是内联 JSON 或导师说明文本）。");
  const fsOps = options.fsOps ?? fs;
  const root = resolveInstalledProjectRoot(project, options);
  const file = path.resolve(options.cwd ?? process.cwd(), mentorFile);
  const { value: suggestion, fields } = readSuggestion(file, fsOps);
  const rooted = openRootedFilesystem(root, { fsOps });
  const previous = readExistingConfig(rooted);
  const config = normalizeWatchConfig({ ...previous, ...suggestion, source: "mentor" });
  for (const field of Object.keys(previous)) {
    if (field !== "source" && !Object.hasOwn(suggestion, field) && !isDeepStrictEqual(previous[field], config[field])) {
      throw new Error(`已有追踪配置的 ${field} 无法原样保留；请先修正该字段，未覆盖。`);
    }
  }
  const configPath = rooted.displayPath(CONFIG_PATH);
  // The shared writer stages in this same directory before atomically renaming.
  if (rooted.tryLstat(`${CONFIG_PATH}.${process.pid}.tmp`)) throw new Error(`追踪配置临时路径已存在；未覆盖：${configPath}.${process.pid}.tmp`);
  writeWatchConfig(root, config);
  try {
    const stored = JSON.parse(rooted.readFile(CONFIG_PATH).toString("utf8"));
    const saved = readWatchConfig(root);
    if (!isDeepStrictEqual(stored, config) || !isDeepStrictEqual(saved, config)) throw new Error("保存内容与预期不同");
    return { status: "configured", root, configPath, updatedFields: fields, config: saved };
  } catch (error) {
    throw new Error(`追踪配置已尝试保存，但回读确认失败；请检查 ${configPath}：${error.message}`, { cause: error });
  }
}

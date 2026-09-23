import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { comparePackageVersions } from "./package-metadata.mjs";

const REGISTRY_NAME = "projects.json";
const REPORT_NAME = "last-sync.json";
const LOCK_NAME = ".registry-lock";

function configDirectory(env = process.env) {
  const base = env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), ".config");
  if (!path.isAbsolute(base)) throw new Error("Dove user configuration root must be absolute.");
  return path.join(base, "dove");
}

function inspectFile(file, fsOps = fs) {
  try {
    const stat = fsOps.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Dove user registry requires a regular file: ${file}.`);
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) throw new Error(`Dove user registry is not owned by the current user: ${file}.`);
    if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) throw new Error(`Dove user registry permissions are too broad: ${file}.`);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function inspectDirectory(directory, fsOps = fs, privateDirectory = false) {
  try {
    const stat = fsOps.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Dove user registry directory must be real: ${directory}.`);
    if (privateDirectory && typeof process.getuid === "function" && stat.uid !== process.getuid()) throw new Error(`Dove user registry directory is not owned by the current user: ${directory}.`);
    if (privateDirectory && process.platform !== "win32" && (stat.mode & 0o077) !== 0) throw new Error(`Dove user registry directory permissions are too broad: ${directory}.`);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function registryDirectory(options = {}, create = false) {
  const fsOps = options.fsOps ?? fs;
  const directory = configDirectory(options.env);
  const base = path.dirname(directory);
  if (!inspectDirectory(base, fsOps)) {
    if (!create) return null;
    fsOps.mkdirSync(base, { recursive: true, mode: 0o700 });
  }
  const baseStat = fsOps.lstatSync(base);
  if (typeof process.getuid === "function" && baseStat.uid !== process.getuid()) throw new Error(`Dove user configuration root is not owned by the current user: ${base}.`);
  if (process.platform !== "win32" && (baseStat.mode & 0o002) !== 0) throw new Error(`Dove user configuration root is publicly writable: ${base}.`);
  if (!inspectDirectory(directory, fsOps, true)) {
    if (!create) return null;
    fsOps.mkdirSync(directory, { mode: 0o700 });
  }
  return directory;
}

function validateProjects(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== "projects,revision"
    || value.revision !== 1 || !Array.isArray(value.projects)) throw new Error("Dove user project registry is invalid.");
  const seen = new Set();
  for (const root of value.projects) {
    if (typeof root !== "string" || !path.isAbsolute(root) || root !== path.normalize(root) || root.includes("\0") || seen.has(root)) throw new Error("Dove user project registry contains an invalid project root.");
    seen.add(root);
  }
  return value.projects;
}

function readJson(file, options = {}) {
  const fsOps = options.fsOps ?? fs;
  if (!inspectFile(file, fsOps)) return null;
  return JSON.parse(fsOps.readFileSync(file, "utf8"));
}

function writeJson(file, data, options = {}) {
  const fsOps = options.fsOps ?? fs;
  inspectFile(file, fsOps);
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  try {
    fsOps.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    fsOps.renameSync(temporary, file);
  } finally {
    if (fsOps.existsSync(temporary)) fsOps.unlinkSync(temporary);
  }
}

function lockedRegistry(options, operation) {
  const fsOps = options.fsOps ?? fs;
  const directory = registryDirectory(options, true);
  const lock = path.join(directory, LOCK_NAME);
  let acquired = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      fsOps.mkdirSync(lock, { mode: 0o700 });
      acquired = true;
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  if (!acquired) throw new Error(`Dove project registry is locked at ${lock}; another operation may be active, or a prior operation was interrupted. Inspect it before retrying.`);
  try {
    return operation(path.join(directory, REGISTRY_NAME));
  } finally {
    fsOps.rmdirSync(lock);
  }
}

export function readRegisteredProjects(options = {}) {
  const directory = registryDirectory(options);
  if (!directory) return [];
  const value = readJson(path.join(directory, REGISTRY_NAME), options);
  return value === null ? [] : [...validateProjects(value)];
}

export function changeRegisteredProjects(add, remove = [], options = {}) {
  return lockedRegistry(options, (file) => {
    const existing = readJson(file, options);
    const roots = existing === null ? [] : validateProjects(existing);
    for (const root of [...add, ...remove]) {
      if (typeof root !== "string" || !path.isAbsolute(root) || root !== path.normalize(root)) throw new Error("Dove project registration requires an absolute canonical root.");
    }
    const next = [...new Set([...roots, ...add])].filter((root) => !remove.includes(root)).sort();
    if (existing === null || JSON.stringify(roots) !== JSON.stringify(next)) writeJson(file, { revision: 1, projects: next }, options);
    return next;
  });
}

export function readLastProjectSync(options = {}) {
  const directory = registryDirectory(options);
  if (!directory) return null;
  const report = readJson(path.join(directory, REPORT_NAME), options);
  if (report === null) return null;
  if (!report || report.revision !== 1 || !Array.isArray(report.projects) || typeof report.packageVersion !== "string") throw new Error("Dove last project sync report is invalid.");
  return report;
}

export function writeLastProjectSync(report, options = {}) {
  return lockedRegistry(options, () => {
    const directory = registryDirectory(options);
    const file = path.join(directory, REPORT_NAME);
    const prior = readLastProjectSync(options);
    if (prior) {
      const order = comparePackageVersions(prior.packageVersion, report.packageVersion);
      if (order === null) throw new Error("Dove last project sync report has an invalid package version.");
      if (order > 0) return false;
    }
    writeJson(file, { revision: 1, ...report }, options);
    return true;
  });
}

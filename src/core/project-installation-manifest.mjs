import fs from "node:fs";
import path from "node:path";

import { ARTIFACT_PATHS } from "./schema.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";

export const INSTALLATION_MANIFEST_PATH = ARTIFACT_PATHS.installationManifest;
export const LEGACY_INSTALLATION_MANIFEST_PATH = ".dove-install/manifest.json";
export const INSTALLATION_MANIFEST_REVISION = "2.0";
export const PREVIOUS_INSTALLATION_MANIFEST_REVISION = "1.0";

const MANIFEST_FIELDS = new Set(["revision", "package", "runtime", "hosts", "managed", "createdAt", "updatedAt"]);
const PACKAGE_FIELDS = new Set(["name", "version"]);
const RUNTIME_FIELDS = new Set(["mode"]);
const MANAGED_FIELDS = new Set(["path", "kind", "selector", "digest"]);
const MANAGED_KINDS = new Set(["exclusive-file", "json-fragment", "text-block"]);
const SHA256 = /^[a-f0-9]{64}$/u;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertPlainObject(value, label) {
  if (!plainObject(value)) throw new Error(`${label} must be a plain object.`);
}

function assertFields(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
  const missing = [...fields].filter((field) => !Object.hasOwn(value, field));
  if (missing.length > 0) throw new Error(`${label} is missing required fields: ${missing.join(", ")}.`);
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value || value !== value.trim() || value.includes("\0")) {
    throw new Error(`${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function exactIsoTimestamp(value, label) {
  nonEmptyString(value, label);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO timestamp.`);
  }
  return value;
}

function canonicalProjectRelativePath(value, label) {
  nonEmptyString(value, label);
  if (value.includes("\\") || path.posix.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value)) {
    throw new Error(`${label} must be a project-relative path without backslashes: ${value}`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized === ".." || normalized.startsWith("../") || value.includes("//") || value.endsWith("/")) {
    throw new Error(`${label} must be one canonical project-relative path: ${value}`);
  }
  if (value === ".dove" || value.startsWith(".dove/")) {
    throw new Error(`${label} must not manage Dove research or installation state: ${value}`);
  }
  return value;
}

function normalizeAllowedHosts(options) {
  const allowed = options.hostIds;
  if (!Array.isArray(allowed) || allowed.length === 0 || allowed.some((hostId) => typeof hostId !== "string" || !hostId || hostId === "all")) {
    throw new Error("Project installation manifest validation requires concrete hostIds in registry order.");
  }
  if (new Set(allowed).size !== allowed.length) throw new Error("Project installation manifest hostIds must be unique.");
  return allowed;
}

function validateHosts(hosts, allowedHosts) {
  if (!Array.isArray(hosts) || hosts.length === 0) throw new Error("Project installation manifest hosts must be a non-empty array.");
  for (const hostId of hosts) {
    nonEmptyString(hostId, "Project installation manifest host");
    if (hostId === "all" || !allowedHosts.includes(hostId)) throw new Error(`Project installation manifest contains unknown host: ${hostId}.`);
  }
  if (new Set(hosts).size !== hosts.length) throw new Error("Project installation manifest hosts must be unique.");
  return hosts;
}

function validateManagedEntry(entry, index) {
  const label = `Project installation manifest managed[${index}]`;
  assertFields(entry, MANAGED_FIELDS, label);
  canonicalProjectRelativePath(entry.path, `${label}.path`);
  if (!MANAGED_KINDS.has(entry.kind)) throw new Error(`${label}.kind is unsupported: ${entry.kind}.`);
  if (entry.kind === "exclusive-file") {
    if (entry.selector !== null) throw new Error(`${label}.selector must be null for exclusive-file ownership.`);
  } else {
    nonEmptyString(entry.selector, `${label}.selector`);
  }
  if (typeof entry.digest !== "string" || !SHA256.test(entry.digest)) {
    throw new Error(`${label}.digest must be a lowercase 64-character SHA-256 digest.`);
  }
  return entry;
}

function managedKey(entry) {
  return `${entry.path}\0${entry.kind}\0${entry.selector ?? ""}`;
}

function compareManaged(left, right) {
  return left.path.localeCompare(right.path)
    || left.kind.localeCompare(right.kind)
    || String(left.selector ?? "").localeCompare(String(right.selector ?? ""));
}

function validateManaged(managed) {
  if (!Array.isArray(managed)) throw new Error("Project installation manifest managed must be an array.");
  managed.forEach(validateManagedEntry);
  const keys = managed.map(managedKey);
  if (new Set(keys).size !== keys.length) throw new Error("Project installation manifest managed entries must be unique.");
  return managed;
}

function normalizeTimestamp(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return exactIsoTimestamp(value, "Project installation manifest timestamp");
  if (value === undefined) return new Date().toISOString();
  throw new Error("Project installation manifest timestamp must be a Date or exact ISO timestamp.");
}

function normalizeManaged(rawManaged = []) {
  const byKey = new Map();
  for (const rawEntry of rawManaged) {
    const entry = {
      path: rawEntry.path,
      kind: rawEntry.kind,
      selector: rawEntry.selector ?? null,
      digest: rawEntry.digest
    };
    validateManagedEntry(entry, byKey.size);
    const key = managedKey(entry);
    const previous = byKey.get(key);
    if (previous && previous.digest !== entry.digest) throw new Error(`Conflicting project installation manifest entry: ${entry.path}.`);
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort(compareManaged);
}

export function validateProjectInstallationManifest(value, options = {}) {
  const allowedHosts = normalizeAllowedHosts(options);
  assertFields(value, MANIFEST_FIELDS, "Project installation manifest");
  if (value.revision !== INSTALLATION_MANIFEST_REVISION) {
    throw new Error(`Project installation manifest revision must equal ${INSTALLATION_MANIFEST_REVISION}.`);
  }
  assertFields(value.package, PACKAGE_FIELDS, "Project installation manifest package");
  nonEmptyString(value.package.name, "Project installation manifest package.name");
  nonEmptyString(value.package.version, "Project installation manifest package.version");
  if (!SEMVER.test(value.package.version)) throw new Error("Project installation manifest package.version must be a semantic version.");
  assertFields(value.runtime, RUNTIME_FIELDS, "Project installation manifest runtime");
  if (value.runtime.mode !== "user-cli") throw new Error("Project installation manifest runtime.mode must be user-cli.");
  validateHosts(value.hosts, allowedHosts);
  validateManaged(value.managed);
  const createdAt = exactIsoTimestamp(value.createdAt, "Project installation manifest createdAt");
  const updatedAt = exactIsoTimestamp(value.updatedAt, "Project installation manifest updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Project installation manifest updatedAt must not precede createdAt.");
  return value;
}

export function createProjectInstallationManifest(input = {}, options = {}) {
  const allowedHosts = normalizeAllowedHosts(options);
  const requestedHosts = input.hosts ?? [];
  if (!Array.isArray(requestedHosts) || requestedHosts.some((hostId) => hostId === "all" || !allowedHosts.includes(hostId))) {
    throw new Error("Project installation manifest hosts must contain only concrete known host ids.");
  }
  const hosts = allowedHosts.filter((hostId) => requestedHosts.includes(hostId));
  const createdAt = normalizeTimestamp(input.createdAt ?? input.now);
  const updatedAt = normalizeTimestamp(input.updatedAt ?? createdAt);
  const manifest = {
    revision: INSTALLATION_MANIFEST_REVISION,
    package: { name: input.package?.name, version: input.package?.version },
    runtime: { mode: "user-cli" },
    hosts,
    managed: normalizeManaged(input.managed),
    createdAt,
    updatedAt
  };
  validateProjectInstallationManifest(manifest, { hostIds: allowedHosts });
  return manifest;
}

export function serializeProjectInstallationManifest(value, options = {}) {
  validateProjectInstallationManifest(value, options);
  return `${JSON.stringify(value, null, 2)}\n`;
}

function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function inspectManifestFile(root, fsOps, manifestRelativePath) {
  const installationDirectory = path.join(root, path.posix.dirname(manifestRelativePath));
  const directoryStat = lstatOrNull(fsOps, installationDirectory);
  if (directoryStat === null) throw new Error(`Dove project installation manifest is missing: ${manifestRelativePath}.`);
  if (directoryStat.isSymbolicLink()) throw new Error(`Dove project installation directory must not be a symbolic link: ${installationDirectory}.`);
  if (!directoryStat.isDirectory()) throw new Error(`Dove project installation path must be a directory: ${installationDirectory}.`);
  const manifestPath = path.join(root, manifestRelativePath);
  const stat = lstatOrNull(fsOps, manifestPath);
  if (stat === null) throw new Error(`Dove project installation manifest is missing: ${manifestRelativePath}.`);
  if (stat.isSymbolicLink()) throw new Error(`Dove project installation manifest must not be a symbolic link: ${manifestRelativePath}.`);
  if (!stat.isFile()) throw new Error(`Dove project installation manifest must be a regular file: ${manifestRelativePath}.`);
  return manifestPath;
}

export function readProjectInstallationManifest(root, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const manifestPath = inspectManifestFile(root, fsOps, INSTALLATION_MANIFEST_PATH);
  try {
    const parsed = parseJsonWithoutDuplicateKeys(fsOps.readFileSync(manifestPath, "utf8"), "Dove project installation manifest");
    validateProjectInstallationManifest(parsed, options);
    return parsed;
  } catch (error) {
    throw new Error(`Invalid Dove project installation manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

function validatePreviousManagedEntry(entry, index) {
  const label = `Dove 1.0 installation manifest managed[${index}]`;
  assertPlainObject(entry, label);
  const kind = entry.kind ?? entry.mode;
  const normalized = { path: entry.path, kind, selector: entry.selector ?? null, digest: entry.digest };
  validateManagedEntry(normalized, index);
  return normalized;
}

function normalizePreviousManifest(value, manifestPath, options) {
  assertPlainObject(value, "Dove 1.0 installation manifest");
  const recognizedRevision = value.revision === PREVIOUS_INSTALLATION_MANIFEST_REVISION;
  const recognizedReleasedShape = value.schemaVersion === 1
    && value.integrationVersion === 4
    && value.ownershipVersion === 4
    && value.runtime?.protocolVersion === 3;
  if (!recognizedRevision && !recognizedReleasedShape) {
    throw new Error(`Dove migration accepts only installation revision ${PREVIOUS_INSTALLATION_MANIFEST_REVISION}.`);
  }
  const allowedHosts = normalizeAllowedHosts(options);
  assertPlainObject(value.package, "Dove 1.0 installation manifest package");
  nonEmptyString(value.package.name, "Dove 1.0 installation manifest package.name");
  nonEmptyString(value.package.version, "Dove 1.0 installation manifest package.version");
  if (!SEMVER.test(value.package.version)) throw new Error("Dove 1.0 installation manifest package.version must be a semantic version.");
  if (value.runtime?.mode !== "user-cli") throw new Error("Dove 1.0 installation manifest runtime.mode must be user-cli.");
  validateHosts(value.hosts, allowedHosts);
  if (!Array.isArray(value.managed)) throw new Error("Dove 1.0 installation manifest managed must be an array.");
  const managed = value.managed.map(validatePreviousManagedEntry);
  if (new Set(managed.map(managedKey)).size !== managed.length) throw new Error("Dove 1.0 installation manifest managed entries must be unique.");
  const createdAt = exactIsoTimestamp(value.createdAt, "Dove 1.0 installation manifest createdAt");
  const updatedAt = exactIsoTimestamp(value.updatedAt, "Dove 1.0 installation manifest updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Dove 1.0 installation manifest updatedAt must not precede createdAt.");
  return {
    revision: PREVIOUS_INSTALLATION_MANIFEST_REVISION,
    package: { name: value.package.name, version: value.package.version },
    runtime: { mode: "user-cli" },
    hosts: [...value.hosts],
    managed,
    createdAt,
    updatedAt,
    sourcePath: manifestPath
  };
}

export function readProjectInstallationManifestForMigration(root, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const relativePath = options.manifestPath ?? INSTALLATION_MANIFEST_PATH;
  if (![INSTALLATION_MANIFEST_PATH, LEGACY_INSTALLATION_MANIFEST_PATH].includes(relativePath)) {
    throw new Error(`Unsupported Dove installation migration manifest path: ${relativePath}.`);
  }
  const manifestPath = inspectManifestFile(root, fsOps, relativePath);
  try {
    const parsed = parseJsonWithoutDuplicateKeys(fsOps.readFileSync(manifestPath, "utf8"), "Dove 1.0 installation manifest");
    return normalizePreviousManifest(parsed, relativePath, options);
  } catch (error) {
    throw new Error(`Invalid Dove 1.0 installation manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

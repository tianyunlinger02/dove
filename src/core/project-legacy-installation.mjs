import fs from "node:fs";
import path from "node:path";

import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";

export const LEGACY_PROJECT_MARKER_PATHS = Object.freeze(["mcp/dove-claude-project.json"]);
export const LEGACY_PROJECT_BUNDLE_PROBES = Object.freeze([
  { path: "bin/dove-package.mjs", signatures: ["dove-state-server-package.mjs", "DOVE_MCP_SERVER_NAME", "create_ambient_dove_mission"] },
  { path: "dist/index.mjs", signatures: ["DOVE_WORKSPACE_SCHEMA_VERSION", "createDoveMission", "queryDoveStatus"] },
  { path: "mcp/dove-state-server-package.mjs", signatures: ["create_ambient_dove_mission", "query_dove_status", "Dove MCP"] },
  { path: "scripts/doctor-mcp-probe-package.mjs", signatures: ["hasCreateAmbientDoveMission", "checkpointStatus", "ambientHookBundle"] },
  { path: "scripts/dove-user-prompt-submit-package.mjs", signatures: ["create_ambient_dove_mission", "UserPromptSubmit", "closureRequest"] }
]);
const DOVE_HOOK_COMMAND = /(?:^|[\s"'])node(?:[\s"']+)[^"'\s]*dove-user-prompt-submit-package\.mjs\b/u;
const DOVE_MCP_BUNDLE_PATH = /(?:^|[/\\])mcp[/\\]dove-state-server-package\.mjs$/u;

function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function readSmallRegularFile(root, relativePath, fsOps, maxBytes = 2 * 1024 * 1024) {
  const absolutePath = path.join(root, relativePath);
  const stat = lstatOrNull(fsOps, absolutePath);
  if (stat === null || stat.isSymbolicLink() || !stat.isFile() || stat.size > maxBytes) return null;
  return fsOps.readFileSync(absolutePath, "utf8");
}

function legacyMarkerHits(root, fsOps) {
  return LEGACY_PROJECT_MARKER_PATHS.filter((relativePath) => {
    const content = readSmallRegularFile(root, relativePath, fsOps, 64 * 1024);
    if (content === null) return false;
    try {
      const value = parseJsonWithoutDuplicateKeys(content, `Legacy Dove marker ${relativePath}`);
      return value !== null && typeof value === "object" && !Array.isArray(value) && value.host === "claude";
    } catch {
      return false;
    }
  });
}

function registrationHits(root, fsOps) {
  const hits = [];
  const mcp = readSmallRegularFile(root, ".mcp.json", fsOps, 512 * 1024);
  if (mcp !== null) {
    try {
      const value = parseJsonWithoutDuplicateKeys(mcp, "Legacy Dove MCP configuration");
      const dove = value?.mcpServers?.dove;
      const args = Array.isArray(dove?.args) ? dove.args : [];
      if (dove?.command === "node" && args.some((argument) => typeof argument === "string" && DOVE_MCP_BUNDLE_PATH.test(argument))) {
        hits.push(".mcp.json#/mcpServers/dove");
      }
    } catch {
      // Malformed shared configuration is not affirmative legacy evidence.
    }
  }
  const settings = readSmallRegularFile(root, ".claude/settings.json", fsOps, 512 * 1024);
  if (settings !== null) {
    try {
      const value = parseJsonWithoutDuplicateKeys(settings, "Legacy Dove Claude settings");
      if (DOVE_HOOK_COMMAND.test(JSON.stringify(value?.hooks?.UserPromptSubmit ?? null))) hits.push(".claude/settings.json#/hooks/UserPromptSubmit");
    } catch {
      // Malformed shared configuration is not affirmative legacy evidence.
    }
  }
  return hits;
}

function bundleHits(root, fsOps) {
  return LEGACY_PROJECT_BUNDLE_PROBES.flatMap((probe) => {
    const content = readSmallRegularFile(root, probe.path, fsOps);
    if (content === null) return [];
    const signatureMatched = probe.signatures.some((signature) => content.includes(signature));
    return [{ path: probe.path, signatureMatched }];
  });
}

function deepFreeze(result) {
  Object.freeze(result.markerHits);
  Object.freeze(result.registrationHits);
  result.bundleHits.forEach(Object.freeze);
  Object.freeze(result.bundleHits);
  Object.freeze(result.evidence);
  return Object.freeze(result);
}

export function inspectLegacyProjectInstallation(root, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const canonicalRoot = path.resolve(root);
  const markerHits = legacyMarkerHits(canonicalRoot, fsOps);
  const registrationHitsFound = registrationHits(canonicalRoot, fsOps);
  const bundles = bundleHits(canonicalRoot, fsOps);
  const reliableBundleCombination = bundles.length >= 2;
  const detected = markerHits.length > 0 || registrationHitsFound.length > 0 || reliableBundleCombination;
  const evidence = [
    ...markerHits.map((entry) => `marker:${entry}`),
    ...registrationHitsFound.map((entry) => `registration:${entry}`),
    ...(reliableBundleCombination ? bundles.map((entry) => `bundle:${entry.path}${entry.signatureMatched ? ":signature" : ""}`) : [])
  ];
  return deepFreeze({
    state: detected ? "unsupported-legacy" : "absent",
    detected,
    root: canonicalRoot,
    markerHits: [...markerHits],
    registrationHits: [...registrationHitsFound],
    bundleHits: bundles.map((entry) => ({ ...entry })),
    evidence
  });
}

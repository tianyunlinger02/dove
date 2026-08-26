import fs from "node:fs";
import path from "node:path";

import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";

const MARKER_FIELDS = new Set([
  "schemaVersion",
  "manifestVersion",
  "workspaceId",
  "createdAt",
  "packageVersion"
]);
const RETIRED_SCHEMA_VERSIONS = new Set([7, 8, 9, 18]);
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function assertMarker(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Dove legacy workspace marker must be a plain object.");
  }
  const unknown = Object.keys(value).filter((key) => !MARKER_FIELDS.has(key));
  if (unknown.length > 0) throw new Error(`Dove legacy workspace marker has unknown fields: ${unknown.join(", ")}.`);
  if (!RETIRED_SCHEMA_VERSIONS.has(value.schemaVersion)) throw new Error("Dove legacy workspace marker schema is unsupported.");
  if (value.manifestVersion !== 1) throw new Error("Dove legacy workspace marker manifest version is unsupported.");
  if (typeof value.workspaceId !== "string" || !SAFE_ID.test(value.workspaceId)) throw new Error("Dove legacy workspace marker workspaceId is invalid.");
  if (typeof value.createdAt !== "string" || !ISO_TIMESTAMP.test(value.createdAt) || new Date(value.createdAt).toISOString() !== value.createdAt) {
    throw new Error("Dove legacy workspace marker createdAt is invalid.");
  }
  if (typeof value.packageVersion !== "string" || !value.packageVersion.trim()) throw new Error("Dove legacy workspace marker packageVersion is invalid.");
  return value;
}

export function readLegacyWorkspaceMarker(root, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const markerPath = options.markerPath ?? ".dove/manifest.json";
  const absolutePath = path.join(root, markerPath);
  const stat = lstatOrNull(fsOps, absolutePath);
  if (stat === null) return null;
  try {
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Dove legacy workspace marker must be a regular file: ${markerPath}.`);
    let text;
    try {
      text = fsOps.readFileSync(absolutePath, "utf8");
    } catch (error) {
      throw new Error(`Dove legacy workspace marker cannot be read: ${markerPath}.`, { cause: error });
    }
    return assertMarker(parseJsonWithoutDuplicateKeys(text, markerPath));
  } catch (error) {
    if (options.strict === false) return null;
    throw error;
  }
}

export const LEGACY_WORKSPACE_MARKER_PATH = ".dove/manifest.json";

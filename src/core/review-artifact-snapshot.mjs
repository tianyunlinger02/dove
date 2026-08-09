import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { normalizedRelativePath } from "./research-records.mjs";

const HASH_PATTERN = /^[a-f0-9]{64}$/u;

function sha256Buffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalRoot(root) {
  return fs.realpathSync.native(path.resolve(root));
}

function containedFile(root, relativePath, label) {
  const normalized = normalizedRelativePath(relativePath, label);
  const canonical = canonicalRoot(root);
  let current = canonical;
  for (const segment of normalized.split("/")) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`${label} must not contain symbolic links: ${normalized}.`);
  }
  const stat = fs.lstatSync(current);
  if (!stat.isFile() || stat.size === 0) throw new Error(`${label} must be an existing non-empty regular file: ${normalized}.`);
  const real = fs.realpathSync.native(current);
  const relative = path.relative(canonical, real);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${label} must stay inside the project: ${normalized}.`);
  if (relative.split(path.sep).join("/") !== normalized) throw new Error(`${label} must use its canonical project-relative path: ${normalized}.`);
  return { fullPath: real, path: normalized, sizeBytes: stat.size };
}

export function sha256File(fullPath) {
  return sha256Buffer(fs.readFileSync(fullPath));
}

export function stableSnapshotSetHash(snapshots = []) {
  const canonical = [...snapshots]
    .map(({ path: artifactPath, sizeBytes, sha256 }) => ({ path: artifactPath, sizeBytes, sha256 }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return sha256Buffer(`${JSON.stringify(canonical)}\n`);
}

export function snapshotReviewedArtifacts(root, relativePaths, label = "reviewed artifacts") {
  if (!Array.isArray(relativePaths) || relativePaths.length === 0) throw new Error(`${label} requires at least one project-relative path.`);
  const snapshots = [];
  const seen = new Set();
  for (const [index, relativePath] of relativePaths.entries()) {
    const file = containedFile(root, relativePath, `${label}[${index}]`);
    if (seen.has(file.path)) continue;
    seen.add(file.path);
    snapshots.push({ path: file.path, sizeBytes: file.sizeBytes, sha256: sha256File(file.fullPath) });
  }
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { reviewedArtifacts: snapshots, reviewedArtifactSetSha256: stableSnapshotSetHash(snapshots) };
}

export function normalizeReviewSnapshots(value, label = "reviewedArtifacts") {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, snapshots: [], reason: `${label} must contain artifact snapshots` };
  const snapshots = [];
  const seen = new Set();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, snapshots: [], reason: `${label}[${index}] must be an object` };
    if (Object.keys(item).some((field) => !["path", "sizeBytes", "sha256"].includes(field))) return { ok: false, snapshots: [], reason: `${label}[${index}] has unknown fields` };
    let artifactPath;
    try { artifactPath = normalizedRelativePath(item.path, `${label}[${index}].path`); }
    catch (error) { return { ok: false, snapshots: [], reason: error instanceof Error ? error.message : String(error) }; }
    if (!Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !HASH_PATTERN.test(String(item.sha256 ?? ""))) return { ok: false, snapshots: [], reason: `${label}[${index}] is invalid` };
    if (seen.has(artifactPath)) return { ok: false, snapshots: [], reason: `${label} contains duplicate paths` };
    seen.add(artifactPath);
    snapshots.push({ path: artifactPath, sizeBytes: item.sizeBytes, sha256: item.sha256 });
  }
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { ok: true, snapshots, reason: null };
}

export function verifyReviewSnapshotSet(root, preparedSnapshots, expectedSetHash) {
  const normalized = normalizeReviewSnapshots(preparedSnapshots);
  if (!normalized.ok) return { ok: false, failures: [normalized.reason], reviewedArtifacts: [], reviewedArtifactSetSha256: null };
  const failures = [];
  const setHash = stableSnapshotSetHash(normalized.snapshots);
  if (setHash !== expectedSetHash) failures.push("reviewed-artifact-set-hash-mismatch");
  for (const prepared of normalized.snapshots) {
    try {
      const current = snapshotReviewedArtifacts(root, [prepared.path]).reviewedArtifacts[0];
      if (JSON.stringify(current) !== JSON.stringify(prepared)) failures.push(`reviewed-artifact-changed:${prepared.path}`);
    } catch {
      failures.push(`reviewed-artifact-unavailable:${prepared.path}`);
    }
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)], reviewedArtifacts: normalized.snapshots, reviewedArtifactSetSha256: setHash };
}

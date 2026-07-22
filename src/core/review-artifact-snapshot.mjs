import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { inspectDeclaredPath, normalizeProjectRelativePath } from "./artifact-integrity.mjs";
import { readArtifactOwnership } from "./artifact-lineage.mjs";
import { currentMutationContext } from "./mutation-backend.mjs";

const HASH_PATTERN = /^[a-f0-9]{64}$/u;

function sha256Buffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function sha256File(fullPath) {
  return sha256Buffer(fs.readFileSync(fullPath));
}

export function snapshotArtifactBuffer(root, relativePath, label = "artifact") {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (!normalized.ok) throw new Error(`${label} has an unsafe path ${relativePath}: ${normalized.reason}.`);
  const suppliedPath = String(relativePath).trim().replace(/\\/gu, "/");
  if (normalized.normalizedPath !== suppliedPath) throw new Error(`${label} must use a normalized project-relative path.`);
  const inspection = inspectDeclaredPath(root, suppliedPath, { requireNonEmpty: true });
  if (inspection.status !== "existing") throw new Error(`${label} is not a usable file at ${suppliedPath}: ${inspection.reason ?? inspection.status}.`);
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath !== suppliedPath) throw new Error(`${label} must use its canonical realpath and cannot use an internal alias.`);

  const mutationContext = currentMutationContext(root);
  let content;
  if (mutationContext && typeof mutationContext.readFileSnapshot === "function") {
    const snapshot = mutationContext.readFileSnapshot(canonicalPath);
    if (!snapshot.exists || snapshot.type !== "file" || !snapshot.buffer) throw new Error(`${label} must be an existing regular file.`);
    content = Buffer.from(snapshot.buffer);
  } else {
    if (mutationContext) mutationContext.requireCommitPrecondition(canonicalPath);
    content = fs.readFileSync(path.resolve(root, canonicalPath));
  }
  if (content.byteLength === 0) throw new Error(`${label} must be a non-empty regular file.`);
  return { path: canonicalPath, content, sizeBytes: content.byteLength, sha256: sha256Buffer(content) };
}

export function stableSnapshotSetHash(snapshots = []) {
  const canonical = [...snapshots]
    .map(({ path: artifactPath, sizeBytes, sha256 }) => ({ path: artifactPath, sizeBytes, sha256 }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return sha256Buffer(`${JSON.stringify(canonical)}\n`);
}

export function canonicalReviewArtifactPath(root, relativePath, label = "review artifact") {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (!normalized.ok) throw new Error(`${label} has an unsafe path ${relativePath}: ${normalized.reason}.`);
  const suppliedPath = String(relativePath).trim().replace(/\\/gu, "/");
  if (normalized.normalizedPath !== suppliedPath) throw new Error(`${label} must use a normalized project-relative path.`);
  const inspection = inspectDeclaredPath(root, normalized.normalizedPath, { requireNonEmpty: true, rejectBookkeeping: true });
  if (inspection.status !== "existing") throw new Error(`${label} is not a usable file at ${normalized.normalizedPath}: ${inspection.reason ?? inspection.status}.`);
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath !== normalized.normalizedPath) throw new Error(`${label} must use its canonical realpath and cannot use an internal alias.`);
  return canonicalPath;
}

export function resolveReviewArtifactSnapshots(root, missionId, relativePaths, label = "reviewed artifacts", options = {}) {
  if (!Array.isArray(relativePaths)) throw new Error(`${label} must be an array of project-relative paths.`);
  const ownership = readArtifactOwnership(root);
  const ownerByPath = new Map(ownership.artifacts.map((item) => [item.path, item]));
  const snapshots = [];
  const seen = new Set();
  for (const [index, relativePath] of relativePaths.entries()) {
    if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error(`${label}[${index}] must be a non-empty path.`);
    const canonicalPath = canonicalReviewArtifactPath(root, relativePath, `${label}[${index}]`);
    if (seen.has(canonicalPath)) continue;
    seen.add(canonicalPath);
    const owner = ownerByPath.get(canonicalPath);
    if (!owner) throw new Error(`${label}[${index}] is not a registered schema 9 artifact: ${canonicalPath}.`);
    if (owner.missionId !== missionId) throw new Error(`${label}[${index}] belongs to mission ${owner.missionId}, not ${missionId}.`);
    const inspection = inspectDeclaredPath(root, canonicalPath, { requireNonEmpty: true, rejectBookkeeping: true });
    const snapshot = {
      path: canonicalPath,
      sizeBytes: inspection.sizeBytes,
      sha256: sha256File(path.resolve(root, canonicalPath))
    };
    if (options.requireOwnershipCurrent !== false && snapshot.sha256 !== owner.sha256) {
      throw new Error(`${label}[${index}] has changed since its latest ownership receipt: ${canonicalPath}.`);
    }
    snapshots.push(snapshot);
  }
  if (snapshots.length === 0) throw new Error(`${label} requires at least one existing non-empty non-bookkeeping mission-owned artifact.`);
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { reviewedArtifacts: snapshots, reviewedArtifactSetSha256: stableSnapshotSetHash(snapshots) };
}

export function snapshotReviewedArtifacts(root, relativePaths, label = "reviewed artifacts") {
  const snapshots = [];
  const seen = new Set();
  for (const relativePath of relativePaths ?? []) {
    const canonicalPath = canonicalReviewArtifactPath(root, relativePath, label);
    if (seen.has(canonicalPath)) continue;
    seen.add(canonicalPath);
    const inspection = inspectDeclaredPath(root, canonicalPath, { requireNonEmpty: true, rejectBookkeeping: true });
    snapshots.push({ path: canonicalPath, sizeBytes: inspection.sizeBytes, sha256: sha256File(path.resolve(root, canonicalPath)) });
  }
  if (snapshots.length === 0) throw new Error(`${label} requires at least one existing non-empty non-bookkeeping reviewed artifact.`);
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
    const normalized = normalizeProjectRelativePath(item.path);
    if (!normalized.ok || normalized.normalizedPath !== item.path || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !HASH_PATTERN.test(String(item.sha256 ?? ""))) {
      return { ok: false, snapshots: [], reason: `${label}[${index}] is invalid` };
    }
    if (seen.has(item.path)) return { ok: false, snapshots: [], reason: `${label} contains duplicate paths` };
    seen.add(item.path);
    snapshots.push({ path: item.path, sizeBytes: item.sizeBytes, sha256: item.sha256 });
  }
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { ok: true, snapshots, reason: null };
}

export function verifyReviewSnapshotSet(root, preparedSnapshots, expectedSetHash) {
  const normalized = normalizeReviewSnapshots(preparedSnapshots);
  const failures = [];
  if (!normalized.ok) return { ok: false, failures: [normalized.reason], reviewedArtifacts: [], reviewedArtifactSetSha256: null };
  const setHash = stableSnapshotSetHash(normalized.snapshots);
  if (setHash !== expectedSetHash) failures.push("reviewed-artifact-set-hash-mismatch");
  for (const prepared of normalized.snapshots) {
    const inspection = inspectDeclaredPath(root, prepared.path, { requireNonEmpty: true, rejectBookkeeping: true });
    if (inspection.status !== "existing") {
      failures.push(`reviewed-artifact-${inspection.status}:${prepared.path}`);
      continue;
    }
    const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
    if (inspection.normalizedPath !== prepared.path || canonicalPath !== prepared.path) {
      failures.push(`reviewed-artifact-path-changed:${prepared.path}`);
      continue;
    }
    const current = { path: canonicalPath, sizeBytes: inspection.sizeBytes, sha256: sha256File(path.resolve(root, canonicalPath)) };
    if (JSON.stringify(current) !== JSON.stringify(prepared)) failures.push(`reviewed-artifact-changed:${prepared.path}`);
  }
  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
    reviewedArtifacts: normalized.snapshots,
    reviewedArtifactSetSha256: setHash
  };
}

export function verifyPreparedReviewSnapshot(root, { manifest, input, inputPath, actualInputSha256, handoffInputPath, handoffInputSha256, handoffReviewedArtifactPaths }) {
  const failures = [];
  if (manifest.inputPath !== inputPath || handoffInputPath !== inputPath) failures.push("input-path-mismatch");
  if (manifest.inputSha256 !== actualInputSha256 || handoffInputSha256 !== actualInputSha256) failures.push("input-hash-mismatch");
  const manifestSnapshots = normalizeReviewSnapshots(manifest.reviewedArtifacts, "manifest.reviewedArtifacts");
  const inputSnapshots = normalizeReviewSnapshots(input.reviewedArtifacts, "input.reviewedArtifacts");
  if (!manifestSnapshots.ok) failures.push(manifestSnapshots.reason);
  if (!inputSnapshots.ok) failures.push(inputSnapshots.reason);
  if (manifestSnapshots.ok && inputSnapshots.ok && JSON.stringify(manifestSnapshots.snapshots) !== JSON.stringify(inputSnapshots.snapshots)) failures.push("manifest-input-snapshot-mismatch");
  const snapshots = manifestSnapshots.ok ? manifestSnapshots.snapshots : [];
  const setHash = snapshots.length ? stableSnapshotSetHash(snapshots) : null;
  if (!setHash || manifest.reviewedArtifactSetSha256 !== setHash || input.reviewedArtifactSetSha256 !== setHash) failures.push("reviewed-artifact-set-hash-mismatch");
  const returnedPaths = Array.isArray(handoffReviewedArtifactPaths) ? handoffReviewedArtifactPaths : [];
  if (JSON.stringify([...returnedPaths].sort()) !== JSON.stringify(snapshots.map((item) => item.path).sort())) failures.push("handoff-reviewed-artifact-set-mismatch");
  const current = verifyReviewSnapshotSet(root, snapshots, setHash);
  failures.push(...current.failures);
  return { ok: failures.length === 0, failures: [...new Set(failures)], reviewedArtifacts: snapshots, reviewedArtifactSetSha256: setHash };
}

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { inspectDeclaredPath, normalizeProjectRelativePath } from "./artifact-integrity.mjs";

function sha256Buffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
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

export function canonicalReviewArtifactPath(root, relativePath, label = "review artifact") {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (!normalized.ok) {
    throw new Error(`${label} has an unsafe path ${relativePath}: ${normalized.reason}.`);
  }
  const inspection = inspectDeclaredPath(root, normalized.normalizedPath, {
    requireNonEmpty: true,
    rejectBookkeeping: true
  });
  if (inspection.status !== "existing") {
    throw new Error(`${label} is not a usable file at ${normalized.normalizedPath}: ${inspection.reason ?? inspection.status}.`);
  }
  return inspection.canonicalRelativePath ?? inspection.normalizedPath;
}

export function snapshotReviewedArtifacts(root, relativePaths, label = "reviewed artifacts") {
  const snapshots = [];
  const seen = new Set();
  for (const relativePath of relativePaths ?? []) {
    const canonicalPath = canonicalReviewArtifactPath(root, relativePath, label);
    if (seen.has(canonicalPath)) {
      continue;
    }
    seen.add(canonicalPath);
    const inspection = inspectDeclaredPath(root, canonicalPath, {
      requireNonEmpty: true,
      rejectBookkeeping: true
    });
    snapshots.push({
      path: canonicalPath,
      sizeBytes: inspection.sizeBytes,
      sha256: sha256File(path.resolve(root, canonicalPath))
    });
  }
  if (snapshots.length === 0) {
    throw new Error(`${label} requires at least one existing non-empty non-bookkeeping reviewed artifact.`);
  }
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return {
    reviewedArtifacts: snapshots,
    reviewedArtifactSetSha256: stableSnapshotSetHash(snapshots)
  };
}

function normalizedSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const normalized = normalizeProjectRelativePath(value.path);
  if (
    !normalized.ok
    || !Number.isSafeInteger(value.sizeBytes)
    || value.sizeBytes <= 0
    || typeof value.sha256 !== "string"
    || !/^[a-f0-9]{64}$/u.test(value.sha256)
  ) {
    return null;
  }
  return {
    path: normalized.normalizedPath,
    sizeBytes: value.sizeBytes,
    sha256: value.sha256
  };
}

function normalizeSnapshotArray(value) {
  if (!Array.isArray(value)) {
    return { ok: false, snapshots: [], reason: "reviewedArtifacts must be an array" };
  }
  const snapshots = value.map(normalizedSnapshot);
  if (snapshots.some((item) => item === null) || snapshots.length === 0) {
    return { ok: false, snapshots: [], reason: "reviewedArtifacts must contain valid non-empty artifact snapshots" };
  }
  const paths = snapshots.map((item) => item.path);
  if (new Set(paths).size !== paths.length) {
    return { ok: false, snapshots: [], reason: "reviewedArtifacts contains duplicate canonical paths" };
  }
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { ok: true, snapshots, reason: null };
}

function snapshotsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function verifyPreparedReviewSnapshot(root, {
  manifest,
  input,
  inputPath,
  actualInputSha256,
  handoffInputPath,
  handoffInputSha256,
  handoffReviewedArtifactPaths
}) {
  const failures = [];
  if (manifest.inputPath !== inputPath || handoffInputPath !== inputPath) {
    failures.push("input-path-mismatch");
  }
  if (manifest.inputSha256 !== actualInputSha256 || handoffInputSha256 !== actualInputSha256) {
    failures.push("input-hash-mismatch");
  }

  const manifestSnapshots = normalizeSnapshotArray(manifest.reviewedArtifacts);
  const inputSnapshots = normalizeSnapshotArray(input.reviewedArtifacts);
  if (!manifestSnapshots.ok) failures.push(`manifest-${manifestSnapshots.reason}`);
  if (!inputSnapshots.ok) failures.push(`input-${inputSnapshots.reason}`);
  if (manifestSnapshots.ok && inputSnapshots.ok && !snapshotsEqual(manifestSnapshots.snapshots, inputSnapshots.snapshots)) {
    failures.push("manifest-input-snapshot-mismatch");
  }

  const preparedSnapshots = manifestSnapshots.ok ? manifestSnapshots.snapshots : [];
  const expectedSetHash = preparedSnapshots.length > 0 ? stableSnapshotSetHash(preparedSnapshots) : null;
  if (
    !expectedSetHash
    || manifest.reviewedArtifactSetSha256 !== expectedSetHash
    || input.reviewedArtifactSetSha256 !== expectedSetHash
  ) {
    failures.push("reviewed-artifact-set-hash-mismatch");
  }

  const handoffPaths = [];
  for (const rawPath of Array.isArray(handoffReviewedArtifactPaths) ? handoffReviewedArtifactPaths : []) {
    const normalized = normalizeProjectRelativePath(rawPath);
    if (!normalized.ok) {
      failures.push("handoff-unsafe-reviewed-artifact-path");
      continue;
    }
    let canonicalPath = normalized.normalizedPath;
    try {
      canonicalPath = canonicalReviewArtifactPath(root, normalized.normalizedPath, "review handoff artifact");
    } catch {
      // Current-file verification below reports the concrete missing/empty/directory failure.
    }
    handoffPaths.push(canonicalPath);
  }
  if (handoffPaths.length === 0) {
    failures.push("handoff-reviewed-artifacts-missing");
  }
  if (new Set(handoffPaths).size !== handoffPaths.length) {
    failures.push("handoff-duplicate-reviewed-artifact-path");
  }
  const preparedPaths = preparedSnapshots.map((item) => item.path).sort();
  const returnedPaths = [...handoffPaths].sort();
  if (JSON.stringify(preparedPaths) !== JSON.stringify(returnedPaths)) {
    failures.push("handoff-reviewed-artifact-set-mismatch");
  }

  for (const prepared of preparedSnapshots) {
    const inspection = inspectDeclaredPath(root, prepared.path, {
      requireNonEmpty: true,
      rejectBookkeeping: true
    });
    if (inspection.status !== "existing") {
      failures.push(`reviewed-artifact-${inspection.status}:${prepared.path}`);
      continue;
    }
    const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
    const current = {
      path: canonicalPath,
      sizeBytes: inspection.sizeBytes,
      sha256: sha256File(path.resolve(root, canonicalPath))
    };
    if (!snapshotsEqual([prepared], [current])) {
      failures.push(`reviewed-artifact-changed:${prepared.path}`);
    }
  }

  return {
    ok: failures.length === 0,
    failures: Array.from(new Set(failures)),
    reviewedArtifacts: preparedSnapshots,
    reviewedArtifactSetSha256: expectedSetHash
  };
}

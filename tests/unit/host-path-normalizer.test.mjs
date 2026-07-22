import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { normalizeHostWorkspaceArtifactPath, normalizeHostWorkspaceFilePath, normalizeHostWorkspacePath } from "../../src/core/host-path-normalizer.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

test("host path normalizer accepts canonical relative and workspace absolute files", () => {
  const root = createTempRoot("dove-host-path-");
  try {
    fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
    const absolute = path.join(root, "outputs", "result.md");
    fs.writeFileSync(absolute, "result\n");
    assert.equal(normalizeHostWorkspaceFilePath(root, "outputs/result.md"), "outputs/result.md");
    assert.equal(normalizeHostWorkspaceFilePath(root, absolute), "outputs/result.md");
  } finally {
    cleanupTempRoot(root);
  }
});

test("host lexical path normalizer accepts contained missing paths without inspecting files", () => {
  const root = createTempRoot("dove-host-lexical-path-");
  try {
    assert.equal(normalizeHostWorkspacePath(root, "outputs/missing.md"), "outputs/missing.md");
    assert.equal(normalizeHostWorkspacePath(root, path.join(root, "outputs", "missing.md")), "outputs/missing.md");
    assert.throws(() => normalizeHostWorkspacePath(root, "../outside.md"), /canonical path inside the workspace/u);
  } finally {
    cleanupTempRoot(root);
  }
});

test("host artifact path normalizer accepts future files and rejects existing non-files", () => {
  const root = createTempRoot("dove-host-artifact-path-");
  try {
    fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
    fs.writeFileSync(path.join(root, "outputs", "existing.md"), "result\n");
    fs.symlinkSync(path.join(root, "outputs", "existing.md"), path.join(root, "linked.md"));
    assert.equal(normalizeHostWorkspaceArtifactPath(root, "outputs/future.md"), "outputs/future.md");
    assert.equal(normalizeHostWorkspaceArtifactPath(root, path.join(root, "outputs", "future.md")), "outputs/future.md");
    assert.equal(normalizeHostWorkspaceArtifactPath(root, "outputs/existing.md"), "outputs/existing.md");
    for (const value of ["outputs", "linked.md", "../outside.md"]) {
      assert.throws(() => normalizeHostWorkspaceArtifactPath(root, value), /canonical regular file or future file inside the workspace/u, value);
    }
  } finally {
    cleanupTempRoot(root);
  }
});

test("host path normalizer rejects special files without blocking", () => {
  const root = createTempRoot("dove-host-path-special-");
  try {
    const fifoPath = path.join(root, "input.pipe");
    const created = spawnSync("mkfifo", [fifoPath], { encoding: "utf8" });
    assert.equal(created.status, 0, created.stderr);
    const startedAt = Date.now();
    assert.throws(() => normalizeHostWorkspaceFilePath(root, fifoPath), /canonical regular file inside the workspace/u);
    assert.ok(Date.now() - startedAt < 1000, "FIFO inspection must fail without waiting for a writer");
  } finally {
    cleanupTempRoot(root);
  }
});

test("host path normalizer rejects aliases, outside paths, directories, missing files, and symlinks", () => {
  const root = createTempRoot("dove-host-path-reject-");
  const outside = createTempRoot("dove-host-path-outside-");
  try {
    fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
    fs.writeFileSync(path.join(root, "outputs", "result.md"), "result\n");
    fs.writeFileSync(path.join(outside, "outside.md"), "outside\n");
    fs.symlinkSync(path.join(root, "outputs", "result.md"), path.join(root, "linked.md"));
    for (const value of [
      "", " ", " outputs/result.md", "./outputs/result.md", "outputs//result.md", "outputs/../outputs/result.md",
      "outputs/", "missing.md", "outputs", path.join(outside, "outside.md"), `${root}/./outputs/result.md`, "linked.md"
    ]) {
      assert.throws(() => normalizeHostWorkspaceFilePath(root, value), /canonical regular file inside the workspace/u, value);
    }
  } finally {
    cleanupTempRoot(root);
    cleanupTempRoot(outside);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  ensureWorkspace,
  readText,
} from "../../src/core/index.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { appendText, writeJson, writeText } from "../../src/core/workspace.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function exists(root, relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

test("patch-plan mutations do not write to disk", () => {
  const root = createTempRoot("dove-mutation-patch-");

  const result = runWithMutationContext(root, { actionId: "unit-test", mutationMode: "patch-plan", hostId: "test-host" }, () => {
    writeJson(root, ".dove/state.json", { ok: true });
    writeText(root, ".dove/notes/example.md", "hello\n");
    return { ok: true };
  });

  assert.equal(result.ok, true);
  assert.equal(result.mutationMode, "patch-plan");
  assert.equal(result.mutationModeSource, "explicit");
  assert.equal(result.writesApplied, false);
  assert.equal(result.hostRollbackEligible, true);
  assert.equal(result.hostRollbackIneligibleReason, null);
  assert.equal(result.recommendedMutationMode, null);
  assert.equal(result.mutationPlan.hostTrackedFileEditsRequired, true);
  assert.equal(result.mutationPlan.workspaceRealpath, fs.realpathSync.native(root));
  assert.deepEqual(result.mutationPlan.operations.filter((operation) => operation.relativePath !== ARTIFACT_PATHS.mutationsIndex).map((operation) => operation.relativePath), [".dove/state.json", ".dove/notes/example.md"]);
  assert.ok(result.mutationPlan.operations.some((operation) => operation.relativePath === ARTIFACT_PATHS.mutationsIndex));
  assert.equal(exists(root, ".dove/state.json"), false);
  assert.equal(exists(root, ".dove/notes/example.md"), false);
});

test("explicit invalid mutationMode is rejected before callback or writes", () => {
  const root = createTempRoot("dove-mutation-invalid-mode-");
  let callbackRan = false;

  assert.throws(
    () => runWithMutationContext(root, { actionId: "unit-test", mutationMode: "invalid-mode" }, () => {
      callbackRan = true;
      writeText(root, ".dove/notes/invalid.md", "must not write\n");
    }),
    /mutationMode must be either patch-plan or direct-process/
  );
  assert.equal(callbackRan, false);
  assert.equal(exists(root, ".dove/notes/invalid.md"), false);
});

test("direct-process mutations write the same final content", () => {
  const root = createTempRoot("dove-mutation-direct-");

  const result = runWithMutationContext(root, { actionId: "unit-test", mutationMode: "direct-process" }, () => {
    writeJson(root, ".dove/state.json", { ok: true });
    writeText(root, ".dove/notes/example.md", "hello\n");
    return { ok: true };
  });

  assert.equal(result.mutationMode, "direct-process");
  assert.equal(result.mutationModeSource, "explicit");
  assert.equal(result.writesApplied, true);
  assert.equal(result.hostRollbackEligible, false);
  assert.match(result.hostRollbackIneligibleReason, /direct-process writes are performed by the Dove process/);
  assert.equal(result.recommendedMutationMode, "patch-plan");
  assert.match(result.rollbackAdvice, /mutationMode: patch-plan/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, ".dove/state.json"), "utf8")).ok, true);
  assert.equal(fs.readFileSync(path.join(root, ".dove/notes/example.md"), "utf8"), "hello\n");
  const provenance = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.mutationsIndex), "utf8"));
  assert.equal(provenance.entries[0].mutationMode, "direct-process");
  assert.equal(provenance.entries[0].mutationModeSource, "explicit");
  assert.equal(provenance.entries[0].hostRollbackEligible, false);
  assert.match(provenance.entries[0].hostRollbackIneligibleReason, /direct-process/);
  assert.equal(provenance.summary.recommendedMutationMode, "patch-plan");
});

test("default direct-process mutations report rollback limits", () => {
  const root = createTempRoot("dove-mutation-default-direct-");

  const result = runWithMutationContext(root, { actionId: "unit-test-default" }, () => {
    writeText(root, ".dove/notes/default.md", "default direct write\n");
    return { ok: true };
  });

  assert.equal(result.ok, true);
  assert.equal(result.mutationMode, "direct-process");
  assert.equal(result.mutationModeSource, "default");
  assert.equal(result.hostRollbackEligible, false);
  assert.match(result.hostRollbackIneligibleReason, /not by host-tracked file edits/);
  assert.equal(result.recommendedMutationMode, "patch-plan");
  assert.match(result.mutationSummary.rollbackAdvice, /host-tracked file edits/);
  assert.equal(fs.readFileSync(path.join(root, ".dove/notes/default.md"), "utf8"), "default direct write\n");
});


test("patch-plan overlay reads staged writes and appends as full writes", () => {
  const root = createTempRoot("dove-mutation-overlay-");

  const result = runWithMutationContext(root, { actionId: "unit-test", mutationMode: "patch-plan" }, () => {
    writeText(root, ".dove/reviews/log.md", "first\n");
    appendText(root, ".dove/reviews/log.md", "second\n");
    return { stagedText: readText(root, ".dove/reviews/log.md") };
  });

  const logOperation = result.mutationPlan.operations.find((operation) => operation.relativePath === ".dove/reviews/log.md");
  assert.equal(result.stagedText, "first\nsecond\n");
  assert.equal(logOperation.kind, "append-as-write");
  assert.equal(logOperation.content, "first\nsecond\n");
  assert.equal(exists(root, ".dove/reviews/log.md"), false);
});

test("mutation paths must stay inside the project", () => {
  const root = createTempRoot("dove-mutation-path-");

  assert.throws(
    () => runWithMutationContext(root, { actionId: "unit-test", mutationMode: "patch-plan" }, () => writeText(root, "../outside.md", "bad")),
    /Mutation path must stay inside the project/
  );
});

test("ensureWorkspace can be represented as a patch plan without creating .dove", () => {
  const root = createTempRoot("dove-mutation-workspace-");

  const result = runWithMutationContext(root, { actionId: "ensure-workspace", mutationMode: "patch-plan" }, () => ensureWorkspace(root));

  assert.equal(exists(root, ARTIFACT_PATHS.doveRoot), false);
  assert.equal(result.writesApplied, false);
  assert.ok(result.created.includes(ARTIFACT_PATHS.state));
  assert.ok(result.mutationPlan.operations.some((operation) => operation.relativePath === ARTIFACT_PATHS.state));
  assert.ok(result.mutationPlan.operations.every((operation) => operation.scope === ".dove"));
});

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { preparePlan } from "../src/core/project-installation-plan.mjs";
import { sha256 } from "../src/core/project-installation-resources.mjs";
import { prepareResearchDefaults } from "../src/core/research-defaults.mjs";
import { inspectResearchDocuments } from "../src/core/research-documents.mjs";
import { renderDoveStatusLine } from "../src/core/statusline.mjs";

function virtualFiles(entries) {
  const root = "/virtual-project";
  const files = new Map(Object.entries(entries).map(([relative, content]) => [path.join(root, relative), Buffer.from(content)]));
  const directories = new Set([root]);
  for (const file of files.keys()) {
    for (let parent = path.dirname(file); parent.startsWith(root); parent = path.dirname(parent)) directories.add(parent);
  }
  const reads = [];
  const fsOps = {
    realpathSync: (value) => value,
    lstatSync(target) {
      if (!files.has(target) && !directories.has(target)) throw Object.assign(new Error("absent"), { code: "ENOENT" });
      return { mode: 0o644, isSymbolicLink: () => false, isDirectory: () => directories.has(target), isFile: () => files.has(target) };
    },
    readFileSync(target) { reads.push(target); return files.get(target); }
  };
  return { root, files, reads, fsOps };
}

test("update retires only the owned reviewer and preserves mentor memory and research history", () => {
  const oldPath = ".claude/agents/dove-reviewer.md";
  const content = "old managed reviewer\n";
  const fixture = virtualFiles({
    [oldPath]: content,
    ".dove/research/MENTOR_NOTES.md": "Mentor-authored prediction and open concerns\n",
    ".dove/research/watch/impact-2026-10-15.md": "Paper impact outside any round\n",
    ".dove/research/watch/scan-2026-10-15.md": "Dated field scan\n",
    ".dove/research/missions/old.md": "history",
    ".dove/research/experiments/old.md": "results"
  });
  const manifest = {
    package: { name: "dove", version: "3.2.27" }, hosts: ["claude"],
    managed: [{ path: oldPath, kind: "exclusive-file", selector: null, digest: sha256(content) }],
    createdAt: "2026-01-01T00:00:00.000Z"
  };
  const plan = preparePlan({ ...fixture, manifest, hosts: manifest.hosts, packageName: "dove", packageVersion: "3.3.0", now: "2026-10-05T00:00:00.000Z" });
  assert.deepEqual(plan.entries.filter((entry) => entry.delete).map((entry) => entry.relativePath), [oldPath]);
  assert.ok(plan.manifest.managed.some((entry) => entry.path === ".claude/agents/dove-mentor.md"));
  assert.ok(plan.manifest.managed.some((entry) => entry.path === ".claude/agents/dove-review.md"));
  assert.equal(plan.entries.some((entry) => entry.relativePath.startsWith(".dove/research/")), false);
  assert.equal(fixture.reads.some((target) => target.includes("/research/")), false);
  assert.deepEqual(prepareResearchDefaults(fixture.root, fixture).entries, [], "existing history receives no bootstrap or migration");
});

test("doctor reads core documents without requiring or inspecting historical summaries", () => {
  const fixture = virtualFiles({
    ".dove/research/IDENTITY.md": "Mainline: unchanged\n",
    ".dove/research/EVAL.md": "| round | unseen |\n",
    ".dove/research/rounds/001-brief.md": "作者：用户\n",
    ".dove/research/MENTOR_NOTES.md": "Mentor memory is not a required installation summary\n",
    ".dove/research/watch/impact-2026-10-15.md": "Not an installation diagnostic\n",
    ".dove/research/missions/old.md": "not inspected"
  });
  const result = inspectResearchDocuments(fixture.root, fixture);
  assert.equal(result.healthy, true);
  assert.equal(result.rounds.path, ".dove/research/rounds");
  assert.equal(result.evaluation.path, ".dove/research/EVAL.md");
  assert.deepEqual(fixture.reads.map((target) => path.relative(fixture.root, target)).sort(), [".dove/research/EVAL.md", ".dove/research/IDENTITY.md"]);
});

test("statusline shows the round number from the card without scanning round contents", () => {
  const fixture = virtualFiles({ ".dove/research/IDENTITY.md": "Current round: rounds/007-brief.md\nRound status: ongoing\nMainline: stable goal\n" });
  const output = renderDoveStatusLine({}, { projectRoot: fixture.root, fsOps: fixture.fsOps, branch: null, env: { NO_COLOR: "1" } });
  assert.equal(output, "stable goal · 第7轮\n/virtual-project");
  assert.equal(fixture.reads.length, 1);
  assert.ok(fixture.reads.every((target) => target.endsWith("/IDENTITY.md")));
});

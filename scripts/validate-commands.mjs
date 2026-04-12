import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const requiredCommands = [
  "paper.init.md",
  "paper.orchestrate.md",
  "paper.research.md",
  "paper.source.md",
  "paper.note.md",
  "paper.claim-gate.md",
  "paper.outline.md",
  "paper.plan.md",
  "paper.draft.md",
  "paper.experiment-plan.md",
  "paper.experiment-audit.md",
  "paper.review.md",
  "paper.review-loop.md",
  "paper.result-bridge.md",
  "paper.revise.md",
  "paper.rebuttal-strategy.md",
  "paper.version-snapshot.md",
  "paper.version-compare.md",
  "paper.task-graph.md",
  "paper.open-questions.md",
  "paper.decisions.md",
  "paper.lineage.md",
  "paper.wiki.md",
  "paper.checklist.md",
  "paper.citations.md",
  "paper.figure.md",
  "paper.pipeline.md",
  "paper.rebuttal.md"
];

const requiredSkills = [
  "paper-factory-pipeline/SKILL.md",
  "paper-factory-planner/SKILL.md",
  "paper-factory-researcher/SKILL.md",
  "paper-factory-reviewer/SKILL.md",
  "paper-factory-rebuttal-strategist/SKILL.md",
  "paper-factory-experiment-planning/SKILL.md",
  "paper-factory-version-analyst/SKILL.md",
  "paper-factory-claim-gate/SKILL.md",
  "paper-factory-review-loop/SKILL.md",
  "paper-factory-citation-discipline/SKILL.md",
  "paper-factory-rebuttal/SKILL.md"
];

for (const fileName of requiredCommands) {
  assert.ok(fs.existsSync(path.join(ROOT, ".opencode", "commands", fileName)), `Missing command: ${fileName}`);
}

for (const relativePath of requiredSkills) {
  assert.ok(fs.existsSync(path.join(ROOT, ".opencode", "skills", relativePath)), `Missing skill: ${relativePath}`);
}

const opencodeConfig = JSON.parse(fs.readFileSync(path.join(ROOT, ".opencode.json"), "utf8"));
assert.equal(opencodeConfig.mcpServers["paper-factory"].command, "node");
assert.equal(Object.hasOwn(opencodeConfig, "$schema"), false);
console.log("Command and skill validation passed.");

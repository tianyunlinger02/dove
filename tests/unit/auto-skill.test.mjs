import test from "node:test";
import assert from "node:assert/strict";

import { COMMAND_SURFACE_BY_ID, COMMAND_SURFACES } from "../../src/core/command-manifest.mjs";

function text(value) {
  return JSON.stringify(value);
}

test("Auto is the tenth flat Skill and has no database tool dependency", () => {
  assert.equal(COMMAND_SURFACES.length, 10);
  assert.equal(COMMAND_SURFACES.at(-1)?.id, "dove.auto");
  const auto = COMMAND_SURFACE_BY_ID["dove.auto"];
  assert.equal(auto.workflow.status, "explicit-multi-round-autonomy");
  assert.deepEqual(auto.requiredTools, []);
  assert.doesNotMatch(text(auto), /query_dove|manage_dove|sessionId|lease|receipt|control plane/iu);
});

test("Auto regrounds from human research documents and real project evidence", () => {
  const auto = text(COMMAND_SURFACE_BY_ID["dove.auto"]);
  assert.match(auto, /Require an existing.*\.dove\/research\/RESEARCH\.md/isu);
  assert.match(auto, /Read.*LESSONS\.md.*fallible guidance.*never as evidence or authority/isu);
  assert.match(auto, /code, data, results, drafts, figures, constraints, and external sources/iu);
  assert.match(auto, /competing explanations, counterfactuals, baselines, discriminating actions, and current claim boundaries/iu);
  assert.match(auto, /highest expected research value/iu);
});

test("Auto writes each prospective experiment plan before execution and appends results to the same document", () => {
  const steps = COMMAND_SURFACE_BY_ID["dove.auto"].workflow.modes[0].steps;
  const experimentIndex = steps.findIndex((step) => step.capability === "experiment-work");
  assert.ok(experimentIndex >= 0);
  assert.match(steps[experimentIndex].instruction, /write or extend one experiment Markdown document with the prospective plan before execution/iu);
  assert.match(steps[experimentIndex].instruction, /Then execute.*append.*results.*same document/isu);
  assert.match(steps[experimentIndex].instruction, /failures.*denominator accounting.*deviations.*limitations.*uncertainty/isu);
});

test("Auto treats the documented mainline as a blocking boundary", () => {
  const auto = text(COMMAND_SURFACE_BY_ID["dove.auto"]);
  assert.match(auto, /overview is absent, materially incomplete, or evidence says the mainline must change/iu);
  assert.match(auto, /write a recommendation as an ordinary project artifact, report the block, and stop/iu);
  assert.doesNotMatch(auto, /create.*Workspace|change.*Mission/iu);
});

test("Auto keeps review user-managed and stops when a required return is unavailable", () => {
  const auto = text(COMMAND_SURFACE_BY_ID["dove.auto"]);
  assert.match(auto, /separate reviewer they manage/iu);
  assert.match(auto, /Do not launch, impersonate, or fabricate the reviewer/iu);
  assert.match(auto, /stop if the unavailable return blocks progress/iu);
});

test("Auto has no default round count and ends with evidence-bounded synthesis", () => {
  const auto = COMMAND_SURFACE_BY_ID["dove.auto"];
  const serialized = text(auto);
  assert.match(serialized, /without a default round count/iu);
  assert.match(serialized, /no feasible action has positive expected research value/iu);
  const finalStep = auto.workflow.modes[0].steps.at(-1);
  assert.equal(finalStep.capability, "research-synthesis");
  assert.match(finalStep.instruction, /evidence-bounded result.*without claiming scientific authority/isu);
});

test("Research remains one bounded pass rather than implicit Auto", () => {
  const research = COMMAND_SURFACE_BY_ID["dove.research"];
  assert.equal(research.workflow.status, "single-bounded-pass");
  assert.match(text(research), /Complete exactly one bounded research or project pass/iu);
  assert.match(text(research), /rather than turning Research into multi-round autonomy/iu);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_SURFACE_BY_ID,
  COMMAND_SURFACES,
  PROJECT_HOST_IDS,
  allGeneratedCommandAdapterPaths,
  adapterPathForCommand,
  commandAdapterPathsForHost,
  commandIdToSlug,
  hostCommandSlug
} from "../../src/core/command-manifest.mjs";
import { renderClaudeDoveAgent } from "../../src/core/dove-agent-definition.mjs";
import { renderDoveAgentInstructions } from "../../src/core/dove-agent-persona.mjs";
import {
  DOVE_RESEARCH_ACTION_SPINE,
  DOVE_RESEARCH_CLARIFICATION,
  DOVE_RESEARCH_EXPERIMENT_ITERATION,
  DOVE_RESEARCH_MAINLINE_ANCHORING,
  DOVE_RESEARCH_RESULT_ADOPTION
} from "../../src/core/dove-research-contract.mjs";
import { resourcesForHosts } from "../../src/core/project-installation-resources.mjs";
import { USER_RESPONSE_POLICY } from "../../src/core/user-response-policy.mjs";
import { renderHostMigrationPending } from "../../src/core/host-migration.mjs";
import { renderMentorBrief } from "../../src/core/mentor-brief.mjs";
import { generatedDoveAgentSurfaceEntries } from "../../scripts/generate-command-adapters.mjs";

const SKILLS = ["research", "status", "source", "experiment", "draft", "figure", "review", "rebuttal", "lessons"];

function work(slug) {
  const contract = COMMAND_SURFACE_BY_ID[`dove.${slug}`].contract;
  return [contract.purpose, ...(contract.responsibilities ?? []), ...contract.actions, ...contract.boundaries, ...(contract.nonGoals ?? [])].join("\n");
}

test("public Dove capability, host and path helpers retain the nine flat Skills", () => {
  const ids = SKILLS.map((slug) => `dove.${slug}`);
  assert.deepEqual(COMMAND_SURFACES.map(({ id }) => id), ids);
  assert.deepEqual(Object.keys(COMMAND_SURFACE_BY_ID), ids);
  assert.deepEqual(PROJECT_HOST_IDS, ["claude", "dsh"]);
  for (const [index, command] of COMMAND_SURFACES.entries()) {
    assert.equal(COMMAND_SURFACE_BY_ID[command.id], command);
    assert.equal(commandIdToSlug(command.id), SKILLS[index]);
    assert.equal(hostCommandSlug(command.id), SKILLS[index]);
    assert.ok(command.summary.trim());
    assert.ok(command.contract.actions.length);
    assert.ok(command.contract.boundaries.length);
  }
  const paths = {
    claude: SKILLS.map((slug) => `.claude/commands/dove/${slug}.md`),
    dsh: SKILLS.map((slug) => `.dsh/skills/dove-${slug}/SKILL.md`)
  };
  for (const host of PROJECT_HOST_IDS) {
    assert.deepEqual(commandAdapterPathsForHost(host), paths[host]);
    for (const [index, command] of COMMAND_SURFACES.entries()) {
      assert.equal(adapterPathForCommand(host, command), paths[host][index]);
      assert.equal(adapterPathForCommand(host, command.id), paths[host][index]);
    }
  }
  assert.deepEqual(allGeneratedCommandAdapterPaths(), [...paths.claude, ...paths.dsh]);
  assert.throws(() => adapterPathForCommand("unknown", "dove.research"), /Unknown host/u);
});

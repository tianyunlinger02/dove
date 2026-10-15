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

test("aggregate rule and Skill guidance and all installed guidance do not grow beyond 3.3.13", (t) => {
  // Released 3.3.13 projections, counting Unicode code points and UTF-8 bytes.
  // Aggregate budgets allow readable redistribution, including into references,
  // agents or tool support, without a per-rule compression target.
  const baseline = {
    claude: { primary: { characters: 60_197, bytes: 60_335 }, all: { characters: 111_703, bytes: 167_757 } },
    dsh: { primary: { characters: 106_456, bytes: 106_978 }, all: { characters: 143_288, bytes: 192_160 } }
  };
  const totals = { primary: { characters: 0, bytes: 0 }, all: { characters: 0, bytes: 0 } };
  for (const host of PROJECT_HOST_IDS) {
    const all = resourcesForHosts([host]).filter(({ kind, path }) => kind === "exclusive-file" && path.endsWith(".md"));
    const primaryPaths = new Set(commandAdapterPathsForHost(host));
    if (host === "claude") primaryPaths.add(".claude/rules/dove.md");
    const primary = all.filter(({ path }) => primaryPaths.has(path));
    assert.equal(primary.length, primaryPaths.size);
    for (const [scope, resources] of Object.entries({ primary, all })) {
      const total = resources.reduce((sum, { content }) => ({
        characters: sum.characters + [...content].length,
        bytes: sum.bytes + Buffer.byteLength(content, "utf8")
      }), { characters: 0, bytes: 0 });
      t.diagnostic(`${host} ${scope}: ${total.characters} Unicode characters / ${total.bytes} UTF-8 bytes`);
      for (const unit of ["characters", "bytes"]) totals[scope][unit] += total[unit];
    }
  }
  for (const scope of ["primary", "all"]) {
    for (const unit of ["characters", "bytes"]) {
      const previous = PROJECT_HOST_IDS.reduce((sum, host) => sum + baseline[host][scope][unit], 0);
      assert.ok(totals[scope][unit] <= previous, `${scope}: ${totals[scope][unit]} ${unit} exceeds the 3.3.13 aggregate of ${previous}`);
    }
  }
});

test("topic selection belongs to the user and implementation scale answers the research question", () => {
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /read existing.*CRITERIA\.md.*standards/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /broad parallel candidate pool.*without pruning.*searches.*expand/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /2–3.*user to choose.*before.*do not implement/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /scale and change.*answer the question.*expand or redesign/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /pipeline is not.*core mechanism/iu);
  assert.match(DOVE_RESEARCH_MAINLINE_ANCHORING, /user's confirmed Mainline.*card entry is not confirmation/iu);
  assert.match(DOVE_RESEARCH_MAINLINE_ANCHORING, /old route, new route and reason/iu);
  assert.match(DOVE_RESEARCH_CLARIFICATION, /Without a reply.*authorized work.*not assume consent/iu);
});

test("experiments separate development, method versions and one-use final confirmation", () => {
  assert.match(DOVE_RESEARCH_EXPERIMENT_ITERATION, /ground truth and reruns.*without per-run registration/iu);
  assert.match(DOVE_RESEARCH_EXPERIMENT_ITERATION, /code changes.*new version.*full applicable evaluation/iu);
  assert.match(DOVE_RESEARCH_EXPERIMENT_ITERATION, /After test use.*unused in development or previous tests.*same-set baselines/iu);
  assert.match(DOVE_RESEARCH_EXPERIMENT_ITERATION, /final confirmation.*claim.*controls.*data.*metrics.*heldout once/iu);
  assert.match(work("experiment"), /Read-only or design-only.*do not execute/iu);
  assert.match(work("experiment"), /Heldout.*used for tuning.*no longer independent/iu);
});

test("Status stays read-only and judgment replies lead with an evidence-bounded conclusion", () => {
  const status = work("status");
  assert.match(status, /IDENTITY\.md.*EVAL\.md.*current round brief/iu);
  assert.match(status, /what we have made.*core.*demonstrated.*blocks.*round/iu);
  assert.match(status, /read-only.*does not run research or update documents/iu);
  const response = USER_RESPONSE_POLICY.join("\n");
  assert.match(response, /first sentence only the conclusion.*达到.*没达到.*能.*不能.*还不知道/iu);
  assert.match(response, /one or two sentences of evidence.*at most one sentence on evidence limits/iu);
});

test("artifact Skills preserve source grounding, delivery and author-side ownership", () => {
  assert.match(work("source"), /direct DOI lookup before fuzzy title search/iu);
  assert.match(work("source"), /supported, contradicted, or uncovered/iu);
  assert.match(work("draft"), /authoritative.*(?:build|export).*inspect the actual/isu);
  assert.match(work("draft"), /assessment-only.*without edits/iu);
  assert.match(work("figure"), /real data with reproducible code/iu);
  assert.match(work("figure"), /(?:view|inspect).*rendered figure.*caption.*editable source/isu);
  assert.match(work("rebuttal"), /same root cause/iu);
  assert.match(work("rebuttal"), /Preserve original reviewer returns.*do not overwrite/iu);
  assert.match(work("lessons"), /fallible guidance/iu);
  assert.match(work("lessons"), /content-bearing.*LESSONS\.md.*not an empty index during reading/iu);
});

test("optional Dove agent delegates bounded work without duplicating the project-rule owner", () => {
  const entry = generatedDoveAgentSurfaceEntries().find(({ destinationPath }) => destinationPath === ".claude/agents/dove.md");
  assert.ok(entry);
  assert.equal(entry.content, renderClaudeDoveAgent());
  assert.ok(entry.content.includes(renderDoveAgentInstructions()));
  assert.ok(entry.content.includes(DOVE_RESEARCH_RESULT_ADOPTION));
  assert.match(entry.content, /main session.*bounded subagent.*no higher judgment authority/isu);
  assert.match(entry.content, /return material findings for main-session adoption/iu);
  const projected = `${entry.content.trimEnd()}\n`;
  assert.ok([...projected].length <= 1_301, "Optional agent must stay within its 1301-character baseline");
  assert.ok(Buffer.byteLength(projected, "utf8") <= 1_301, "Optional agent must stay within its 1301-byte baseline");
});

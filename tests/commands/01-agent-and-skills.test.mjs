import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_SURFACE_BY_ID,
  COMMAND_SURFACES,
  PROJECT_HOST_IDS
} from "../../src/core/command-manifest.mjs";
import {
  renderClaudeDoveAgent,
  renderClaudeDoveMentorAgent
} from "../../src/core/dove-agent-definition.mjs";
import {
  renderDoveAgentInstructions,
  renderDoveSharedResearchContractSection
} from "../../src/core/dove-agent-persona.mjs";
import { renderClaudeAmbientRule } from "../../src/core/ambient-policy.mjs";
import { DOVE_RESEARCH_RESULT_ADOPTION, renderDoveResearchQualityFullReference } from "../../src/core/dove-research-contract.mjs";
import {
  generatedAdapterEntries,
  generatedClaudeAmbientProjectEntries,
  generatedDoveAgentSurfaceEntries
} from "../../scripts/generate-command-adapters.mjs";

const SKILLS = ["dove.research", "dove.status", "dove.source", "dove.experiment", "dove.draft", "dove.figure", "dove.review", "dove.rebuttal", "dove.lessons"];

function work(command) {
  const contract = COMMAND_SURFACE_BY_ID[command].contract;
  return [contract.purpose, ...(contract.responsibilities ?? []), ...contract.actions, ...contract.boundaries, ...(contract.nonGoals ?? [])].join("\n");
}

test("public Dove capability and host surfaces remain explicit", () => {
  assert.deepEqual(COMMAND_SURFACES.map(({ id }) => id), SKILLS);
  assert.deepEqual(Object.keys(COMMAND_SURFACE_BY_ID), SKILLS);
  assert.deepEqual(PROJECT_HOST_IDS, ["claude", "dsh"]);
  for (const command of COMMAND_SURFACES) {
    assert.equal(COMMAND_SURFACE_BY_ID[command.id], command);
    assert.ok(command.summary.trim());
    assert.ok(command.contract.actions.length);
    assert.deepEqual(command.contract.returnWith, [DOVE_RESEARCH_RESULT_ADOPTION]);
  }
});

test("rule and nine capability descriptions are materially shorter than 3.2.27", () => {
  // Character counts of the committed ee9cc48 host projections, not generated test expectations.
  const previousLengths = { claude: 79_376, dsh: 148_406 };
  const entries = generatedAdapterEntries();
  for (const hostId of PROJECT_HOST_IDS) {
    const total = (hostId === "claude" ? renderClaudeAmbientRule().length : 0)
      + entries.filter((entry) => entry.hostId === hostId).reduce((sum, entry) => sum + entry.content.length, 0);
    assert.ok(total < previousLengths[hostId] * 0.8, `${hostId}: ${total} characters must retain at least a 20% reduction`);
  }
});

test("Dove agent projection does not exceed its pre-amendment character or byte budget", () => {
  const entry = generatedDoveAgentSurfaceEntries().find(({ destinationPath }) => destinationPath === ".claude/agents/dove.md");
  assert.ok(entry);
  assert.equal(entry.content, renderClaudeDoveAgent());
  // The writer keeps exactly one final newline; extra renderer newlines are not projected.
  const projected = `${entry.content.trimEnd()}\n`;
  const characters = [...projected].length;
  const bytes = Buffer.byteLength(projected, "utf8");
  assert.ok(characters <= 1_301, `agent: ${characters} characters exceeds the 1301-character baseline`);
  assert.ok(bytes <= 1_301, `agent: ${bytes} bytes exceeds the 1301-byte baseline`);
});

test("Dove ambient rule projection does not exceed its pre-amendment character or byte budget", () => {
  const entry = generatedClaudeAmbientProjectEntries().find(({ destinationPath }) => destinationPath === ".claude/rules/dove.md");
  assert.ok(entry);
  assert.equal(entry.content, renderClaudeAmbientRule());
  const projected = `${entry.content.trimEnd()}\n`;
  const characters = [...projected].length;
  const bytes = Buffer.byteLength(projected, "utf8");
  assert.ok(characters <= 9_786, `ambient rule: ${characters} characters exceeds the 9786-character baseline`);
  assert.ok(bytes <= 9_826, `ambient rule: ${bytes} bytes exceeds the 9826-byte baseline`);
});

test("rounds run to EVAL results and preserve explicit pauses and necessary user decisions", () => {
  const shared = renderDoveSharedResearchContractSection();
  const research = work("dove.research");
  assert.match(shared, /Inception.*user-confirmed goal.*method rounds.*EVAL results.*mentor/iu);
  assert.match(shared, /Call `dove-mentor` when no round is active/iu);
  assert.match(shared, /Save its brief verbatim.*inception.*user confirmation.*method rounds.*EVAL results/iu);
  assert.match(shared, /Return after side answers/iu);
  assert.match(shared, /discussion-only\/stop pauses/iu);
  assert.match(shared, /Bounded requests stay bounded/iu);
  assert.match(research, /mentor decides methods and engineering within Mainline and user resources/iu);
  assert.match(research, /Only goal\/claim, deployment input\/output or resource changes.*user's decision/iu);
  assert.match(research, /ask once.*independent authorized defaults if unanswered/iu);
  assert.doesNotMatch(renderClaudeAmbientRule(), /CronCreate|--scope (?:route|design)/u);
});

test("mentor predicts evaluation columns and owns evidence-grounded quality assessment", () => {
  const mentor = renderClaudeDoveMentorAgent();
  assert.match(mentor, /^tools: Read, Grep, Glob$/mu);
  assert.match(mentor, /全新上下文.*不 resume.*不带执行过程对话.*不用执行者转述代替用户原话/u);
  assert.match(mentor, /EVAL\.md.*brief\/result.*diff.*原始产物/u);
  assert.match(mentor, /引用 EVAL 列名、预测和实际数值/u);
  assert.match(mentor, /EVAL 指定列的数值预测.*依据和不确定性/u);
  assert.match(mentor, /通用能力还是补丁.*未见数据列/u);
  assert.match(mentor, /八维评分.*理由和实际依据.*主会话保存到 EVAL/u);
  assert.match(mentor, /最弱且决定性的维度进入下一轮/u);
  assert.match(renderDoveResearchQualityFullReference(), /mentor writes eight-dimensional quality scores in EVAL\.md/iu);
  assert.match(renderDoveResearchQualityFullReference(), /main session does not duplicate that self-assessment/iu);
});

test("development iteration stays free while final heldout confirmation remains one-use", () => {
  const experiment = `${renderDoveSharedResearchContractSection()}\n${work("dove.experiment")}`;
  assert.match(experiment, /Develop freely.*ground truth and reruns.*without per-run registration/iu);
  assert.match(experiment, /fixed method version.*changed code.*new version and full rerun/iu);
  assert.match(experiment, /After test use.*changed method.*fresh unseen test draw.*same-set baselines/iu);
  assert.match(experiment, /Final confirmation.*claim\/control\/data\/metric.*brief.*heldout once/iu);
  assert.match(experiment, /Heldout used for tuning is no longer independent final evidence/iu);
  assert.match(experiment, /measured results in EVAL.*not new experiments\/ records/iu);
  assert.match(experiment, /Read-only or design-only requests do not execute/iu);
});

test("status reads core round context and returns four plain progress answers", () => {
  const status = work("dove.status");
  assert.match(status, /IDENTITY\.md.*last few EVAL\.md rows.*current round brief/iu);
  assert.match(status, /what we have made; whether the core is demonstrated; what blocks it; which round is underway/iu);
  assert.match(status, /without new experiments or a new route/iu);
  assert.match(status, /return to the ongoing round/iu);
});

test("source, draft, figure, rebuttal and Lessons retain their substantive abilities", () => {
  const checks = {
    "dove.source": [/direct DOI lookup before fuzzy title search/iu, /supported, contradicted, or uncovered/iu],
    "dove.draft": [/authoritative manuscript format/iu, /build or export path.*inspect the actual output/iu, /assessment-only requests return findings without edits/iu],
    "dove.figure": [/real data with reproducible code/iu, /write its caption/iu, /Open or view the actual rendered figure/iu, /final figure file and caption.*editable source/iu],
    "dove.rebuttal": [/same root cause/iu, /draft the response and make requested revisions/iu, /do not overwrite original returns/iu],
    "dove.lessons": [/fallible guidance/iu, /content-bearing.*LESSONS\.md/iu, /do not bootstrap an empty directory or index during reading/iu, /one-off tool failures, non-transferable bugs/iu]
  };
  for (const [command, patterns] of Object.entries(checks)) {
    for (const pattern of patterns) assert.match(work(command), pattern, command);
  }
});

test("optional Dove execution agent retains main-session and bounded-subagent ownership", () => {
  const agent = renderClaudeDoveAgent();
  assert.ok(agent.includes(renderDoveAgentInstructions()));
  assert.match(agent, /main session/iu);
  assert.match(agent, /bounded subagent/iu);
  assert.match(agent, /no higher judgment authority/iu);
  assert.equal(agent.includes("## Shared researcher judgment"), false);
  assert.equal(agent.includes("## Author stance"), false);
});

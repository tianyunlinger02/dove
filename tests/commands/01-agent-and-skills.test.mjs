import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_SURFACE_BY_ID,
  COMMAND_SURFACES,
  DOVE_AGENT_SURFACES,
  PROJECT_HOST_IDS,
  generatedDoveAgentEntries,
  renderClaudeDoveAgent,
  renderDoveAgentInstructions
} from "../../src/core/index.mjs";
import * as publicCore from "../../src/core/index.mjs";
import { renderDoveAuthorStanceSection, renderDoveReviewerStanceSection, renderDoveSharedResearchContractSection } from "../../src/core/dove-agent-persona.mjs";
import { renderClaudeAmbientRule } from "../../src/core/ambient-policy.mjs";
import { DOVE_AUTHOR_PREFERENCES_READ_TRIGGER, DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS } from "../../src/core/dove-author-preferences.mjs";
import {
  DOVE_RESEARCH_ACTION_SPINE,
  DOVE_RESEARCH_DEFAULT_AUTONOMY,
  DOVE_RESEARCH_DECISION_CONSEQUENCE,
  DOVE_RESEARCH_MAINLINE_ANCHORING,
  DOVE_RESEARCH_MAINTENANCE_TRIGGER,
  DOVE_RESEARCH_RESULT_ADOPTION,
  DOVE_RESEARCH_REFLECTION_CONTINUITY,
  DOVE_RESEARCH_SESSION_CONTINUATION,
  DOVE_RESEARCH_SHARED_CONTRACT_BULLETS,
  renderDoveResearchQualityReference,
  renderDoveResearchQualityFullReference,
  renderDoveResearchReanchor
} from "../../src/core/dove-research-contract.mjs";
import { generatedAdapterEntries, generatedClaudeAmbientProjectEntries } from "../../scripts/generate-command-adapters.mjs";

const SKILLS = ["dove.research", "dove.status", "dove.source", "dove.experiment", "dove.draft", "dove.figure", "dove.review", "dove.rebuttal", "dove.lessons"];

function work(command) {
  const contract = COMMAND_SURFACE_BY_ID[command].contract;
  return [contract.ambientParticipation, contract.purpose, ...contract.responsibilities, ...contract.actions, ...contract.boundaries].join("\n");
}

test("public Dove capability and host surfaces remain explicit", () => {
  assert.deepEqual(COMMAND_SURFACES.map(({ id }) => id), SKILLS);
  assert.deepEqual(Object.keys(COMMAND_SURFACE_BY_ID), SKILLS);
  assert.deepEqual(PROJECT_HOST_IDS, ["claude", "dsh"]);
  for (const command of COMMAND_SURFACES) {
    assert.equal(COMMAND_SURFACE_BY_ID[command.id], command);
    assert.ok(command.summary.trim());
    assert.ok(command.contract.semanticSections?.length || command.contract.actions?.length);
  }
});

test("open mainline continues through side questions, runs and wakes until completion or a hard blocker", () => {
  const rule = renderClaudeAmbientRule();
  const research = work("dove.research");
  assert.ok(rule.includes(DOVE_RESEARCH_SESSION_CONTINUATION));
  assert.match(DOVE_RESEARCH_DEFAULT_AUTONOMY, /goal is met or a hard blocker remains/iu);
  for (const blocker of [/missing user resources/iu, /material user decision/iu, /actual error that cannot be repaired/iu]) {
    assert.match(DOVE_RESEARCH_DEFAULT_AUTONOMY, blocker);
  }
  assert.match(DOVE_RESEARCH_SESSION_CONTINUATION, /Keep user-created goals and loops/iu);
  assert.match(DOVE_RESEARCH_SESSION_CONTINUATION, /answering status, why, or a side question does not cancel the mainline/iu);
  assert.match(DOVE_RESEARCH_SESSION_CONTINUATION, /next independent core dependency instead of spending wakes waiting/iu);
  assert.match(DOVE_RESEARCH_SESSION_CONTINUATION, /on waking perform a concrete core action/iu);
  assert.match(DOVE_RESEARCH_SESSION_CONTINUATION, /one future off-minute same-session CronCreate wake/iu);
  assert.match(research, /no (?:prospective|frozen)|rapid reruns/iu);
  assert.match(research, /Stop the open goal only at its completion/iu);
  assert.doesNotMatch(rule, /(?:invoke|use) \/dove:auto/iu);
});

test("short shared contract keeps confirmed Mainline stable while methods and evidence change", () => {
  const shared = renderDoveSharedResearchContractSection();
  const author = renderDoveAuthorStanceSection();
  const rule = renderClaudeAmbientRule();
  assert.ok(rule.includes(shared) && rule.includes(author));
  assert.ok(DOVE_RESEARCH_SHARED_CONTRACT_BULLETS.includes(DOVE_RESEARCH_MAINLINE_ANCHORING));
  assert.ok(DOVE_RESEARCH_SHARED_CONTRACT_BULLETS.includes(DOVE_RESEARCH_ACTION_SPINE));
  assert.ok(DOVE_RESEARCH_SHARED_CONTRACT_BULLETS.includes(DOVE_RESEARCH_DECISION_CONSEQUENCE));
  assert.match(DOVE_RESEARCH_MAINLINE_ANCHORING, /confirmed goal, intended contribution, and completion meaning/iu);
  assert.match(DOVE_RESEARCH_MAINLINE_ANCHORING, /not the current method, route, or next action/iu);
  assert.match(DOVE_RESEARCH_MAINLINE_ANCHORING, /wording unchanged/iu);
  for (const trigger of [/routine progress/iu, /unrelated corrections/iu, /experiment results/iu, /subtask completion/iu]) {
    assert.match(DOVE_RESEARCH_MAINLINE_ANCHORING, trigger);
  }
  assert.match(DOVE_RESEARCH_MAINLINE_ANCHORING, /do not paraphrase/iu);
  assert.match(DOVE_RESEARCH_MAINLINE_ANCHORING, /only when the user explicitly changes/iu);
  assert.match(DOVE_RESEARCH_MAINLINE_ANCHORING, /card demonstrably misstates already-confirmed intent/iu);
  assert.match(DOVE_RESEARCH_MAINLINE_ANCHORING, /Within that goal and explicit constraints/iu);
  assert.match(DOVE_RESEARCH_MAINLINE_ANCHORING, /revise methods and next actions without renewed approval/iu);
  assert.match(DOVE_RESEARCH_MAINLINE_ANCHORING, /revise scientific claims with evidence/iu);
  assert.match(DOVE_RESEARCH_MAINLINE_ANCHORING, /Mentioning another direction does not adopt it/iu);
  assert.match(DOVE_RESEARCH_MAINLINE_ANCHORING, /unconfirmed directions provisional/iu);
  assert.equal(renderDoveResearchQualityFullReference().split(DOVE_RESEARCH_MAINLINE_ANCHORING).length - 1, 1, "full quality reference retains the Mainline contract once");
  assert.equal(author.includes(DOVE_RESEARCH_MAINLINE_ANCHORING), false, "shared judgment, not author stance, owns Mainline anchoring");
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /user’s actual goal/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /every open-goal round/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /remaining whole-goal gap.*same confirmed Mainline/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /before acting, after results, and before ending/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /not only when changing direction/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /local batch or validation plan does not by itself complete/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /if requirements remain, do the next core work/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /Reuse settled context, not per-tool rescans, repeated reports, or renewed approval/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /current method remains revisable/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /change the real method and downstream artifact/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /root cause is known, change the method/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /actual producer and consumer/iu);
  assert.match(shared, /confirmed mainline covers its core implementation, reruns, diagnosis, and suitable GPU work/iu);
  assert.match(shared, /Only final heldout confirmation needs a frozen/iu);
  assert.match(shared, /important results.*several actual changes/iu);
  assert.match(shared, /second correction of the same problem/iu);
  assert.match(shared, /--scope route.*fresh read-only Dove context/iu);
  assert.match(shared, /actual diff since the last review.*actual run results/iu);
  assert.match(shared, /not the process conversation/iu);
  assert.match(shared, /Apply its findings to the real next action/iu);
  assert.match(shared, /remove or rework rejected patches/iu);
  assert.match(shared, /retain rejected approaches in the card/iu);
  assert.match(shared, /one-page design/iu);
  assert.match(shared, /public-baseline advantage.*concrete predicted example/iu);
  assert.match(shared, /grounds for likely success and biggest risk/iu);
  assert.match(shared, /user-confirmed method needs no design review/iu);
  assert.match(shared, /implement without renewed user approval/iu);
  assert.match(author, /identity card/iu);
  assert.match(author, /Mainline: ` followed by one sentence in the user's words/iu);
  assert.match(author, /Correct only the fields the user actually corrected/iu);
  assert.match(author, /including during an assessment/iu);
  assert.match(author, /unless writing is explicitly forbidden or the host refuses/iu);
  assert.match(author, /few-hundred-word.*plain language/iu);
  assert.match(author, /without internal abbreviations/iu);
  assert.match(author, /Put process details in history/iu);
  assert.match(DOVE_RESEARCH_REFLECTION_CONTINUITY, /identity card and actual work/iu);
  assert.match(DOVE_RESEARCH_REFLECTION_CONTINUITY, /last route review and next core action/iu);
  assert.match(DOVE_RESEARCH_REFLECTION_CONTINUITY, /fresh read-only Dove context/iu);
  assert.match(DOVE_RESEARCH_REFLECTION_CONTINUITY, /not another self-reflection/iu);
  assert.match(DOVE_RESEARCH_REFLECTION_CONTINUITY, /Route and next-action changes do not rewrite Mainline/iu);
  assert.match(DOVE_RESEARCH_REFLECTION_CONTINUITY, /do not mistake a latest note or a test prompt for a user decision/iu);
  assert.doesNotMatch(DOVE_RESEARCH_REFLECTION_CONTINUITY, /(?:read|scan) (?:private )?transcripts/iu);
});

test("development iteration and final heldout confirmation have different evidence contracts", () => {
  const experiment = work("dove.experiment");
  const research = work("dove.research");
  for (const value of [experiment, research]) {
    assert.match(value, /ground truth/iu);
    assert.match(value, /rerun/iu);
    assert.match(value, /final (?:heldout|confirmation)/iu);
  }
  assert.match(experiment, /No per-run prospective document, frozen development bank or one-shot quota/iu);
  assert.match(experiment, /freeze the method and comparison first/iu);
  assert.match(experiment, /read-only or design-only request does not run experiments/iu);
  assert.match(research, /Known root cause calls for a method change/iu);
  assert.match(experiment, /GPU for repeated computation when it fits/iu);
  assert.match(DOVE_RESEARCH_MAINTENANCE_TRIGGER, /user explicitly asks to record, update, or save/iu);
  assert.match(DOVE_RESEARCH_MAINTENANCE_TRIGGER, /conclusion, route decision, or priority within the confirmed goal/iu);
  assert.match(DOVE_RESEARCH_MAINTENANCE_TRIGGER, /evidence and continuation context is genuinely useful/iu);
  assert.doesNotMatch(DOVE_RESEARCH_MAINTENANCE_TRIGGER, /changes the research mainline/iu);
  for (const command of ["dove.research", "dove.source", "dove.experiment", "dove.draft", "dove.figure", "dove.rebuttal"]) {
    assert.ok(COMMAND_SURFACE_BY_ID[command].contract.boundaries.some((boundary) => boundary.includes(DOVE_RESEARCH_MAINTENANCE_TRIGGER)), `${command}: maintenance within the confirmed goal`);
  }
});

test("corrections are visible in identity card while Lessons remain optional and evidence-bound", () => {
  const lessons = work("dove.lessons");
  const author = renderDoveAuthorStanceSection();
  assert.match(author, /user corrects recurring behavior.*identity card immediately/iu);
  assert.match(author, /read-only assessment is not by itself a reason to forget the correction/iu);
  assert.match(author, /GPU correction changes restrictions, not Mainline/iu);
  assert.match(author, /method failure changes the current route and next action, not the goal/iu);
  assert.match(lessons, /content-bearing "\.dove\/research\/lessons\/LESSONS\.md"/iu);
  assert.match(lessons, /do not bootstrap an empty directory or index during reading/iu);
  assert.match(lessons, /fallible guidance rather than evidence/iu);
  assert.match(lessons, /one-off tool failures, non-transferable bugs/iu);
  assert.match(lessons, /Do not create lesson IDs, frontmatter, an application ledger/iu);
});

test("status answers four plain questions without replacing the mainline", () => {
  const status = work("dove.status");
  assert.match(status, /what are we trying to make, is the core claim proved, what blocks it, and what core work is underway/iu);
  assert.match(status, /Read the short project identity card/iu);
  assert.match(status, /Return control to the ongoing mainline after answering/iu);
  assert.match(status, /material user correction updates only affected identity-card fields/iu);
  assert.match(status, /even during assessment, not an unchanged Mainline/iu);
  assert.match(status, /explicit no-write instruction or host refusal still prohibits that write/iu);
  assert.match(work("dove.research"), /correct only affected fields/iu);
  assert.match(work("dove.research"), /Route and next-action updates do not rewrite the confirmed Mainline/iu);
});

test("Dove exposes one Claude agent definition with bounded roles and result adoption", () => {
  assert.deepEqual(DOVE_AGENT_SURFACES, { claude: ".claude/agents/dove.md" });
  const agent = renderClaudeDoveAgent();
  assert.ok(agent.includes(renderDoveAgentInstructions()));
  assert.match(agent, /main session/iu);
  assert.match(agent, /bounded subagent/iu);
  assert.match(agent, /no higher judgment authority/iu);
  assert.equal(agent.includes("## Shared researcher judgment"), false);
  assert.equal(agent.includes("## Author stance"), false);
  assert.deepEqual(generatedDoveAgentEntries(), [{ relativePath: DOVE_AGENT_SURFACES.claude, content: agent }]);
  for (const command of COMMAND_SURFACES) assert.deepEqual(command.contract.returnWith, [DOVE_RESEARCH_RESULT_ADOPTION]);
  assert.match(DOVE_RESEARCH_RESULT_ADOPTION, /actual evidence, and latest corrections/iu);
  assert.match(DOVE_RESEARCH_RESULT_ADOPTION, /completed subtask is not a completed goal/iu);
});

test("reviewer guidance excludes author stance and private preference access", () => {
  for (const guidance of [renderDoveSharedResearchContractSection(), renderDoveReviewerStanceSection(), renderDoveResearchQualityReference()]) {
    assert.equal(guidance.includes("## Author stance"), false);
    assert.equal(guidance.includes(DOVE_AUTHOR_PREFERENCES_READ_TRIGGER), false);
    assert.equal(guidance.includes(DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.claude), false);
    assert.equal(guidance.includes(".dove/research/IDENTITY.md"), false);
  }
  assert.match(renderDoveReviewerStanceSection(), /read-only/iu);
  assert.match(renderDoveReviewerStanceSection(), /listed frozen materials/iu);
  for (const scope of ["route", "design"]) {
    const reviewer = renderDoveReviewerStanceSection(scope);
    assert.match(reviewer, /fresh, read-only context/iu);
    assert.match(reviewer, /not the author's process conversation/iu);
    assert.match(reviewer, /not independent submission review/iu);
    assert.equal(reviewer.includes(DOVE_AUTHOR_PREFERENCES_READ_TRIGGER), false);
  }
  assert.match(renderDoveReviewerStanceSection("route"), /actual diff and run results/iu);
  assert.match(renderDoveReviewerStanceSection("route"), /generality is required only by the stated goal/iu);
  assert.match(renderDoveReviewerStanceSection("design"), /one-page method design/iu);
  assert.match(renderDoveReviewerStanceSection("design"), /grounds for likely success and biggest risk/iu);
});

test("ordinary rule and standalone DSH Research preserve the shortened mainline contract", () => {
  const rule = generatedClaudeAmbientProjectEntries().find(({ destinationPath }) => destinationPath === ".claude/rules/dove.md").content;
  const research = generatedAdapterEntries().filter(({ command }) => command.id === "dove.research");
  const claude = research.find(({ hostId }) => hostId === "claude").content;
  const dsh = research.find(({ hostId }) => hostId === "dsh").content;
  for (const context of [rule, `${rule}\n${claude}`, `${rule}\n${renderClaudeDoveAgent()}\n${claude}`, dsh]) {
    assert.equal(context.split(DOVE_RESEARCH_MAINLINE_ANCHORING).length - 1, 1, "one shared Mainline owner in each host context");
    assert.match(context, /problem → method → contribution/u);
    assert.match(context, /identity card/iu);
    assert.match(context, /core (?:work|implementation)/iu);
    assert.match(context, /final heldout/iu);
    assert.match(context, /plain language|plainly/iu);
  }
});

test("per-prompt reminder stays short and does not replace the identity card", () => {
  const reminder = renderDoveResearchReanchor();
  assert.ok(reminder.length < 400);
  assert.match(reminder, /identity card and latest user correction/iu);
  assert.match(reminder, /update only affected fields unless writing is forbidden/iu);
  assert.match(reminder, /Keep Mainline stable/iu);
  assert.match(reminder, /Each open-goal round checks action, result and remaining gap against the same Mainline/iu);
  assert.match(reminder, /do the next core work now/iu);
  assert.match(reminder, /Stop at whole-goal completion or a hard blocker/iu);
  assert.match(reminder, /not a local batch or plan/iu);
  assert.match(reminder, /Side answers keep the goal/iu);
  assert.match(reminder, /wake does core work/iu);
});

test("retired abstractions do not return as public API", () => {
  for (const name of ["DOVE_AGENT_DEFINITION", "DOVE_AGENT_NAME", "DOVE_AGENT_CAPSULE_BULLETS", "DOVE_AGENT_PERSONA_BULLETS", "renderDoveAgentPersonaSection", "HOST_ADAPTER_POLICY", "DOVE_RESEARCH_SHARED_CONTRACT", "DOVE_RESEARCH_CAPSULE_BULLETS", "DOVE_RESEARCH_ACTION_LENS_FRAME", "DOVE_RESEARCH_MATURITY"]) {
    assert.equal(Object.hasOwn(publicCore, name), false, name);
  }
});

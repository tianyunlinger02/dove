#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import { CLI_COMMAND_SPECS, parseDoveCli } from "../src/cli/command-parser.mjs";
import { renderProjectIntegrationResult } from "../src/cli/project-integration-output.mjs";
import { renderDoveHome } from "../src/cli/terminal-output.mjs";
import {
  COMMAND_SURFACE_BY_ID,
  COMMAND_SURFACES,
  HOST_ADAPTER_POLICY,
  PACKAGE_GENERATED_SUPPORT_PATHS,
  PROJECT_HOST_IDS,
  adapterPathForCommand
} from "../src/core/command-manifest.mjs";
import {
  DOVE_AGENT_CAPSULE_BULLETS,
  DOVE_AGENT_CURIOSITY,
  DOVE_AGENT_DIRECT_JUDGMENT,
  DOVE_AGENT_FRAME,
  DOVE_AGENT_HUNCH,
  DOVE_AGENT_LAYERING,
  DOVE_AGENT_NAME,
  DOVE_AGENT_PERSONA_BULLETS,
  DOVE_AGENT_PROPORTIONALITY,
  DOVE_AGENT_STOPPING,
  renderDoveAgentInstructions
} from "../src/core/dove-agent-persona.mjs";
import {
  DOVE_AGENT_DEFINITION,
  DOVE_AGENT_SURFACES,
  generatedDoveAgentEntries,
  renderClaudeDoveAgent
} from "../src/core/dove-agent-definition.mjs";
import { USER_RESPONSE_POLICY } from "../src/core/user-response-policy.mjs";
import { isHighConfidenceAmbientWorkPrompt } from "../src/core/ambient-policy.mjs";
import {
  RESEARCH_DEFAULT_DOCUMENTS,
  RESEARCH_DEFAULT_PATHS,
  RESEARCH_LESSON_TOPICS,
  planResearchDefaults
} from "../src/core/research-defaults.mjs";
import {
  PAPER_SEARCH_MCP_FRAGMENT,
  PAPER_SEARCH_PACKAGE_SPECIFIER,
  PAPER_SEARCH_SUPPORT_SKILL_PATH
} from "../src/core/paper-search-integration.mjs";
import {
  generatedAdapterEntries,
  generatedClaudeAmbientProjectEntries,
  renderCommandAdapter
} from "./generate-command-adapters.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_HOST_IDS = ["claude", "dsh"];
const EXPECTED_SKILL_IDS = ["dove.research", "dove.status", "dove.source", "dove.experiment", "dove.draft", "dove.figure", "dove.review", "dove.rebuttal", "dove.lessons", "dove.auto"];
const EXPECTED_AMBIENT_PATHS = [
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  PAPER_SEARCH_SUPPORT_SKILL_PATH
];

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must not contain duplicates`);
}

function text(value) {
  return JSON.stringify(value);
}

function assertDoveAgentPersona() {
  assert.equal(DOVE_AGENT_NAME, "dove");
  assert.deepEqual(DOVE_AGENT_DEFINITION, {
    id: "dove",
    publicName: "Dove",
    title: "dove",
    description: "Work as one complete Dove research agent that advances real research decisions with host tools.",
    responsibility: "Advance real research decisions as one complete research agent rather than exposing planning, authoring, or reviewing personas."
  });
  assert.deepEqual(DOVE_AGENT_SURFACES, {
    claude: ".claude/agents/dove.md"
  });
  assert.deepEqual(PACKAGE_GENERATED_SUPPORT_PATHS.filter((pathName) => pathName.includes("/agents/dove.md")), [
    "package-resources/hosts/claude/.claude/agents/dove.md"
  ]);

  const persona = DOVE_AGENT_PERSONA_BULLETS.join("\n");
  assert.ok(persona.includes(DOVE_AGENT_FRAME));
  assert.ok(persona.includes(DOVE_AGENT_CURIOSITY));
  assert.ok(persona.includes(DOVE_AGENT_STOPPING));
  assert.ok(DOVE_AGENT_PERSONA_BULLETS.length >= 5, "Dove persona must remain substantive without becoming a workflow checklist");
  assert.match(DOVE_AGENT_DIRECT_JUDGMENT, /weigh current evidence, task risk, user preference, and the research mainline/iu);
  assert.match(DOVE_AGENT_DIRECT_JUDGMENT, /useful next move.*stop before executing, recording, launching subagents, or creating tasks unless the user explicitly asks/iu);

  for (const textValue of [renderDoveAgentInstructions(), renderClaudeDoveAgent()]) {
    for (const bullet of DOVE_AGENT_PERSONA_BULLETS) assert.ok(textValue.includes(bullet), "Dove agent surface must include every canonical persona bullet");
    assert.match(textValue, /one complete research agent/iu);
    assert.match(textValue, /ten flat Skills.*capability entrances/isu);
    assert.match(textValue, /Maintain Dove research Markdown when the user explicitly asks to record, update, or save/iu);
    assert.match(textValue, /durable recovery and evidence value/iu);
    assert.match(textValue, /Auto is explicit-only foreground multi-round autonomy/iu);
    assert.match(textValue, /goal\/mission cycle/iu);
    assert.match(textValue, /manuscript submission-readiness Auto mainline.*Review capability/isu);
    assert.match(textValue, /actual Skill call to `dove:review`/iu);
    assert.match(textValue, /`REVISE` verdict keeps Auto working.*invoke Review again/isu);
    assert.match(textValue, /material manuscript or required-material change invalidates the earlier `PASS`/iu);
    assert.doesNotMatch(textValue, /planner.*builder.*reviewer.*three roles|user-switchable.*planner|Planner.*Builder\/Author.*Reviewer/isu);
  }

  const agentEntries = generatedDoveAgentEntries();
  assert.deepEqual(agentEntries.map((entry) => entry.relativePath), [DOVE_AGENT_SURFACES.claude]);
  assert.equal(agentEntries[0].content, renderClaudeDoveAgent());
}

function assertSkillManifest() {
  assert.deepEqual(COMMAND_SURFACES.map((command) => command.id), EXPECTED_SKILL_IDS, "Dove flat Skill manifest drifted");
  assert.deepEqual(Object.keys(COMMAND_SURFACE_BY_ID), EXPECTED_SKILL_IDS, "Skill lookup must match the ordered public manifest");
  assert.deepEqual(PROJECT_HOST_IDS, EXPECTED_HOST_IDS, "Generated Skill hosts drifted");

  for (const command of COMMAND_SURFACES) {
    const label = command.id;
    assert.match(label, /^dove\.[a-z]+$/u, `${label} must remain a flat Skill id`);
    assert.equal(COMMAND_SURFACE_BY_ID[label], command, `${label} lookup must reference the canonical entry`);
    assert.equal(typeof command.summary, "string", `${label} needs a summary`);
    assert.deepEqual(command.requiredTools, [], `${label} must not require a database or external tool`);
    assert.ok(Array.isArray(command.guidance) && command.guidance.length <= 1, `${label} guidance must stay thin`);
    const modes = command.workflow?.modes;
    assert.ok(Array.isArray(modes) && modes.length > 0, `${label} needs workflow guidance`);
    assertUnique(modes.map((mode) => mode.id), `${label} workflow modes`);
    for (const mode of modes) {
      assert.ok(Array.isArray(mode.steps) && mode.steps.length > 0, `${label}/${mode.id} needs steps`);
      assert.ok(Array.isArray(mode.clarification), `${label}/${mode.id} clarification must be an array`);
      for (const step of mode.steps) {
        assert.equal(step.type, "host", `${label}/${mode.id} must use host-native work`);
        assert.equal(typeof step.capability, "string", `${label}/${mode.id} needs a capability`);
        assert.equal(typeof step.instruction, "string", `${label}/${mode.id} needs an instruction`);
        assert.equal(typeof step.readOnly, "boolean", `${label}/${mode.id} must classify read-only behavior`);
        assert.equal(typeof step.persistWhen, "string", `${label}/${mode.id} must classify persistence`);
        assert.ok(["never", "standard-research", "explicit-lessons", "auto-subordinate"].includes(step.persistencePolicy), `${label}/${mode.id} has an unknown persistence policy`);
        if (step.readOnly) {
          assert.equal(step.persistWhen, "never", `${label}/${mode.id} read-only steps cannot maintain research Markdown`);
          assert.equal(step.persistencePolicy, "never", `${label}/${mode.id} read-only steps cannot classify persistence`);
        }
        if (step.persistWhen !== "never") assert.equal(step.capability, "research-document-maintenance", `${label}/${mode.id} persistence is only for optional research Markdown maintenance`);
        if (step.persistencePolicy === "never") assert.equal(step.persistWhen, "never", `${label}/${mode.id} must not hide an unrendered persistence trigger`);
        if (step.persistencePolicy !== "never") assert.notEqual(step.persistWhen, "never", `${label}/${mode.id} needs a persistence trigger`);
        if (label === "dove.lessons" && mode.id === "maintain" && step.capability === "research-document-maintenance") assert.equal(step.persistencePolicy, "explicit-lessons", "Lessons maintenance must remain explicit-only");
        if (label === "dove.auto" && step.capability === "research-document-maintenance") assert.equal(step.persistencePolicy, "auto-subordinate", "Auto maintenance must remain subordinate");
        assert.equal(step.tool, undefined, `${label}/${mode.id} must not impersonate an MCP call`);
      }
    }
  }

  const serialized = text(COMMAND_SURFACES);
  assert.match(serialized, /\.dove\/research\/RESEARCH\.md/u, "Skills must share the human-maintained overview entry");
  assert.doesNotMatch(serialized, /query_dove|manage_dove|MCP tool|semantic ID|Workspace record|Mission ID/iu, "Skills must not retain the research database contract");
  assert.doesNotMatch(serialized, /SQLite|vector database|hidden state service/iu, "Skills must not prescribe a replacement database");

  const research = COMMAND_SURFACE_BY_ID["dove.research"];
  const researchText = text(research);
  assert.equal(research.workflow.status, "single-bounded-pass");
  assert.deepEqual(research.workflow.modes[0].steps.map((step) => step.capability), [
    "research-document-reading",
    "lesson-reading",
    "project-exploration",
    "research-work",
    "research-document-maintenance"
  ]);
  assert.match(researchText, /real research question/iu);
  assert.match(researchText, /different explanations or approaches/iu);
  assert.match(researchText, /lower-level artifacts simulate higher-level research progress/iu);
  assert.match(researchText, /advance a real judgment or eliminate a serious candidate/iu);

  const source = COMMAND_SURFACE_BY_ID["dove.source"];
  const sourceWork = source.workflow.modes[0].steps.find((step) => step.capability === "source-research");
  assert.ok(sourceWork && !sourceWork.readOnly, "Source retrieval must be allowed to save useful material");
  assert.match(sourceWork.instruction, /retrieve when available, save when useful, read, and verify/iu);
  assert.match(sourceWork.instruction, /merely found.*actually retrieved, inspected, and used/iu);
  assert.doesNotMatch(sourceWork.instruction, /failures, conflicts, conditions, and limitations/iu);

  const status = COMMAND_SURFACE_BY_ID["dove.status"];
  assert.ok(status.workflow.modes[0].steps.every((step) => step.readOnly), "Status must remain read-only");
  assert.match(text(status), /If an overview, summary, or link is absent.*say so naturally/isu);

  const experiment = COMMAND_SURFACE_BY_ID["dove.experiment"];
  const experimentSteps = experiment.workflow.modes[0].steps;
  const experimentText = text(experiment);
  const designInstruction = experimentSteps.find((step) => step.capability === "experiment-design").instruction;
  assert.deepEqual(experimentSteps.map((step) => step.capability), [
    "research-document-reading",
    "lesson-reading",
    "experiment-design",
    "experiment-execution",
    "research-document-maintenance"
  ]);
  assert.match(experiment.summary, /advances a research decision/iu);
  assert.match(designInstruction, /real problem.*key uncertainty.*route decision/iu);
  assert.match(designInstruction, /actual project material.*relevant sources.*smallest low-risk diagnostic/iu);
  assert.match(designInstruction, /do not invent a substitute experiment/iu);
  assert.ok(designInstruction.indexOf("real problem") < designInstruction.indexOf("For a new experiment"), "Experiment purpose must precede experiment planning");
  assert.match(experimentText, /design-only.*stop before central execution/isu);
  assert.match(experimentText, /analysis of existing results.*directly/isu);
  assert.match(experimentText, /retrospective.*rather than.*prospective/isu);
  assert.match(experimentText, /actual procedure, result, and any deviation that changes the interpretation/isu);
  assert.doesNotMatch(experimentText, /denominator accounting|supports and cannot establish|actual provenance/iu);

  const figure = COMMAND_SURFACE_BY_ID["dove.figure"];
  const figureText = text(figure);
  const figureSteps = figure.workflow.modes[0].steps;
  const figureCreation = figureSteps.find((step) => step.capability === "figure-creation");
  const figureValidation = figureSteps.find((step) => step.capability === "figure-validation");
  assert.match(figureCreation.instruction, /figure's evidence job in the manuscript or research argument/iu);
  assert.match(figureCreation.instruction, /actual data, selection metadata, source visuals, plotting or rendering code, captions, nearby claims, and intended manuscript layout/iu);
  assert.match(figureCreation.instruction, /real data and reproducible plotting code for quantitative or statistical plots/iu);
  assert.match(figureCreation.instruction, /specialized figure-generation model for method diagrams, conceptual illustrations, or visual abstracts/iu);
  assert.match(figureCreation.instruction, /Do not invent data, results, or method details/iu);
  assert.match(figureCreation.instruction, /repository-local temporary workspace such as `.claude\/tmp\/`, not the system `\/tmp`/iu);
  assert.match(figureValidation.instruction, /actual rendered figure in its reviewer-facing manuscript layout and at realistic final size/iu);
  assert.match(figureValidation.instruction, /not only as a standalone source image or contact sheet/iu);
  assert.match(figureValidation.instruction, /nearby manuscript claim, source data or selection metadata, and rendering or plotting logic agree/iu);
  assert.match(figureValidation.instruction, /duplicate captions, over-dense panels, mismatched selection wording, or inconsistent examples/iu);
  assert.match(figureValidation.instruction, /generated-model output and visual inspection alone as unverified until these cross-checks pass/iu);
  assert.doesNotMatch(figureText, /image count.*quality|embedding.*proves|always use.*generation model/iu);

  const review = COMMAND_SURFACE_BY_ID["dove.review"];
  const reviewText = text(review);
  const reviewSteps = review.workflow.modes[0].steps;
  const reviewGrounding = reviewSteps.find((step) => step.capability === "review-grounding");
  const reviewerWork = reviewSteps.find((step) => step.capability === "reviewer-perspective-work");
  assert.equal(review.workflow.status, "reviewer-perspective-work");
  assert.deepEqual(reviewSteps.map((step) => step.capability), [
    "research-document-reading",
    "lesson-reading",
    "review-grounding",
    "reviewer-perspective-work",
    "review-handoff",
    "research-document-maintenance"
  ]);
  assert.ok(reviewGrounding?.readOnly, "Review grounding must not create research records by default");
  assert.match(reviewGrounding.instruction, /direct reviewer-perspective critique or separate review preparation/iu);
  assert.match(reviewGrounding.instruction, /target venue and submission stage/iu);
  assert.match(reviewGrounding.instruction, /current official venue sources/iu);
  assert.match(reviewGrounding.instruction, /published papers are scholarly context and cannot substitute for official venue requirements/iu);
  assert.match(reviewGrounding.instruction, /discover, retrieve when available, read, and verify/iu);
  assert.match(reviewGrounding.instruction, /merely found.*retrieved.*inspected.*actually used/isu);
  assert.match(reviewGrounding.instruction, /search results, titles, or abstracts as papers read/iu);
  assert.match(reviewGrounding.instruction, /failure to find material into a claim that none exists/iu);
  assert.match(reviewGrounding.instruction, /small, discriminating set of relevant published work/iu);
  assert.match(reviewGrounding.instruction, /novelty, positioning, nearest comparators, evidence norms, experiment presentation, or reader expectations/iu);
  assert.match(reviewGrounding.instruction, /fixed paper count, provider order, source list, or venue checklist/iu);
  assert.match(reviewGrounding.instruction, /returned-review import or ordinary review-context inspection, do not trigger venue or paper search/iu);
  assert.match(reviewerWork.instruction, /established external review context/iu);
  assert.match(reviewerWork.instruction, /official venue requirements and published work actually inspected/iu);
  assert.match(reviewerWork.instruction, /state that boundary instead of inventing references or substituting generic review language/iu);
  assert.match(reviewerWork.instruction, /When Auto invokes Review as a manuscript submission-readiness gate.*concrete `PASS` or `REVISE`/isu);
  assert.match(reviewerWork.instruction, /Read the actual manuscript and material results/iu);
  assert.match(reviewerWork.instruction, /Auto's prior assessment, task framing, package summary, and readiness language as untrusted advocacy rather than evidence/iu);
  assert.match(reviewerWork.instruction, /Reconstruct what the manuscript contributes.*trace the decisive claims to the evidence actually offered/isu);
  assert.match(reviewerWork.instruction, /strongest plausible falsifier or informed-reader objection.*test whether the manuscript answers it/isu);
  assert.match(reviewerWork.instruction, /concrete blockers and how they weaken the central claim/iu);
  assert.match(reviewerWork.instruction, /Complete that scientific judgment before reporting delivery-only package gaps/iu);
  assert.match(reviewerWork.instruction, /build success, embedding, file validity, formatting, or package completeness cannot establish scientific readiness/iu);
  assert.match(reviewerWork.instruction, /missing submission field cannot truncate the manuscript review/iu);
  assert.match(reviewerWork.instruction, /substantive reviewer report or newly inspected evidence contradicts an earlier optimistic judgment.*reconcile it explicitly.*withdraw any incompatible readiness implication/isu);
  assert.match(reviewerWork.instruction, /grounding needed for the judgment is unavailable.*return `REVISE`, not `PASS`/isu);
  assert.match(reviewerWork.instruction, /Do not accept artifact inventories or Auto's visual summary as a substitute/iu);
  assert.match(reviewerWork.instruction, /same agent, not independent external review and not a fixed verdict schema for ordinary Review requests/iu);
  assert.match(reviewerWork.instruction, /figure presence, references, image counts, DOCX or PDF embedding.*inventory or package evidence only/isu);
  assert.match(reviewerWork.instruction, /actual reviewer-facing rendered figures or figure pages in the manuscript's real layout.*source visual assets/isu);
  assert.match(reviewerWork.instruction, /evidence job it performs for the method, comparisons, results, failure modes, or contribution/iu);
  assert.match(reviewerWork.instruction, /caption, nearby manuscript claim, available source data or selection metadata, and relevant rendering or plotting logic/iu);
  assert.match(reviewerWork.instruction, /contact sheet or opened image as proof of quality/iu);
  assert.match(reviewerWork.instruction, /duplicated captions, over-dense panels, misleading selection language, or inconsistent examples/iu);
  assert.match(reviewerWork.instruction, /material figure cannot be inspected in context, remains only superficially checked.*return `REVISE`, not `PASS`/isu);
  assert.match(reviewerWork.instruction, /separate reviewer chosen and managed by the user/iu);
  assert.match(reviewText, /direct review.*reviewer perspective/isu);
  assert.match(reviewText, /manuscript contributes.*decisive claims.*evidence actually offered.*strongest plausible falsifier/isu);
  assert.match(reviewText, /prepare a separate review/iu);
  assert.match(reviewText, /import a returned review/iu);
  assert.match(reviewText, /inspect existing review context/iu);
  assert.match(reviewText, /independent external review/iu);
  assert.match(reviewText, /use Rebuttal for substantive response, revision, and follow-up work/isu);
  assert.doesNotMatch(reviewText, /ReviewExchange|reviewId|findingId|verdictEnum|strictImportSchema|venue registry|trust score|fixed paper pipeline/iu);

  const lessons = COMMAND_SURFACE_BY_ID["dove.lessons"];
  const lessonsText = text(lessons);
  assert.match(lessonsText, /researcher-owned Lessons documents/iu);
  assert.match(lessonsText, /Do not write project-specific guidance into package-managed built-in Lessons themes/iu);
  assert.doesNotMatch(lessonsText, /maintain supported reusable guidance in the relevant theme under `lessons\/`/iu);
  const lessonsMaintenance = lessons.workflow.modes.find((mode) => mode.id === "maintain").steps.find((step) => step.capability === "research-document-maintenance");
  assert.equal(lessonsMaintenance.persistencePolicy, "explicit-lessons");
  assert.match(lessonsMaintenance.persistWhen, /explicitly asks to remember, reflect, or preserve durable Lessons guidance/iu);
  assert.doesNotMatch(lessonsMaintenance.persistWhen, /research mainline|durable recovery and evidence value/iu);

  const auto = COMMAND_SURFACE_BY_ID["dove.auto"];
  const autoText = text(auto);
  const autoSteps = auto.workflow.modes[0].steps;
  const autoAutonomous = autoSteps.find((step) => step.capability === "autonomous-research-work");
  const autoMaintenance = autoSteps.find((step) => step.capability === "research-document-maintenance");
  const autoSynthesis = autoSteps.find((step) => step.capability === "research-synthesis");
  assert.equal(auto.workflow.status, "explicit-multi-round-autonomy");
  assert.deepEqual(autoSteps.map((step) => step.capability), [
    "research-document-reading",
    "autonomous-research-work",
    "research-document-maintenance",
    "research-synthesis"
  ]);
  assert.match(auto.summary, /documented or recovered mainline/iu);
  assert.match(autoText, /short `\/dove:auto`|continue the current mainline/iu);
  assert.match(autoSteps[0].instruction, /current conversation, and the actual project artifacts/iu);
  assert.match(autoSteps[0].instruction, /overview is absent or only default navigation, inspect only directly relevant research notes and project artifacts.*rather than asking the user to restate a long goal or recursively scanning the research tree/isu);
  assert.match(autoSteps[0].instruction, /materially competing directions or a real boundary/iu);
  assert.match(autoSteps[0].instruction, /suffix-free `\/dove:auto`.*real completion condition/isu);
  assert.match(autoSteps[0].instruction, /submission readiness.*whole manuscript and required submission package are actually ready or a material blocker/isu);
  assert.match(autoSteps[0].instruction, /first establish enough of the whole-manuscript readiness basis to choose the next material action/iu);
  assert.match(autoSteps[0].instruction, /scientific question, contribution and method.*experiments, results, interpretation and figures.*citations and related-work grounding.*official venue and submission-stage requirements/isu);
  assert.match(autoSteps[0].instruction, /authoritative manuscript source.*required submission materials and build path/isu);
  assert.match(autoSteps[0].instruction, /judgment dimensions, not fixed stages or checklist gates/iu);
  assert.match(autoSteps[0].instruction, /Distinguish the authoritative manuscript source, the scholarly and evidence basis, and the venue-facing submission materials/iu);
  assert.match(autoSteps[0].instruction, /Markdown, DOCX, PDF, LaTeX.*only when project evidence, current official venue requirements, or the user establishes that role/isu);
  assert.match(autoSteps[0].instruction, /never assume a fixed submission format/iu);
  assert.match(autoSteps[0].instruction, /venue permits multiple editable formats.*make and state a project-suited format decision/isu);
  assert.match(autoSteps[0].instruction, /availability of a local exporter is not evidence that its output is the right submission format/iu);
  assert.match(autoSteps[0].instruction, /generated file is a candidate or diagnostic export, not the authoritative submission artifact/iu);
  assert.match(autoSteps[0].instruction, /compaction summaries, host task lists, old next-step recommendations, and unfinished support work as recovery clues rather than authority/iu);
  assert.match(autoSteps[0].instruction, /revalidate them against the current mainline and actual artifacts before continuing/iu);
  assert.match(autoSteps[0].instruction, /never promote the most recent audit, provenance task, validation result, document update, or inherited task into the mainline/iu);
  assert.match(autoSteps[0].instruction, /invoke Dove's Review capability entrance on the actual current manuscript before substantial revision, submission-artifact construction, or any submit-ready conclusion/iu);
  assert.match(autoSteps[0].instruction, /make an actual Skill call to `dove:review`.*inline reviewer-style judgment is not that call/isu);
  assert.match(autoSteps[0].instruction, /one Dove agent using its Review capability, not a separate persona or a user-managed external reviewer handoff/iu);
  assert.match(autoSteps[0].instruction, /Return `PASS` only when no material objection remains.*otherwise return `REVISE`/isu);
  assert.match(autoSteps[0].instruction, /do not frame the call with Auto's readiness verdict, task list, package summary, or claim that the body is basically finished/iu);
  assert.match(autoSteps[0].instruction, /reconstruct the manuscript's central contribution.*trace its decisive claims to the evidence actually offered/isu);
  assert.match(autoSteps[0].instruction, /strongest plausible falsifier or informed-reader objection.*test whether the manuscript answers it/isu);
  assert.match(autoSteps[0].instruction, /Judge scientific readiness before and separately from delivery-only package gaps/iu);
  assert.match(autoSteps[0].instruction, /missing submission field cannot cut the manuscript review short/iu);
  assert.match(autoSteps[0].instruction, /current official venue requirements and actually inspected relevant published work/iu);
  assert.match(autoSteps[0].instruction, /failed fetch, empty search, title, abstract, cached summary, or project source note cannot be presented as verified venue or paper grounding/iu);
  assert.match(autoSteps[0].instruction, /cannot be accessed.*do not return or claim `PASS`/isu);
  assert.match(autoSteps[0].instruction, /review handoff, old verdict, author-side task list, compaction summary, or review document does not satisfy the current Review invocation/iu);
  assert.match(autoSteps[0].instruction, /figure presence, references, image counts, DOCX or PDF embedding.*inventory or package evidence only/isu);
  assert.match(autoSteps[0].instruction, /actual reviewer-facing rendered figures or figure pages in the manuscript's real layout.*source visual assets/isu);
  assert.match(autoSteps[0].instruction, /evidence job it performs for the method, comparisons, results, failure modes, or contribution/iu);
  assert.match(autoSteps[0].instruction, /contact sheet or opened image as proof of quality/iu);
  assert.match(autoAutonomous.instruction, /mainline-evidence-action-outcome continuation cycle/iu);
  assert.match(autoAutonomous.instruction, /mainline → evidence state → action lens → capability\/responsibility → outcome\/continuation/iu);
  assert.match(autoAutonomous.instruction, /found, accessed, inspected, used, executed, verified, contradicted/iu);
  assert.match(autoAutonomous.instruction, /Explore, Execute, and Express as orthogonal action lenses, not as a sequence, role split, Skill set, state, schema, or completion checklist/iu);
  assert.match(autoAutonomous.instruction, /evidence checking, provenance, validation, engineering, supplementary material, and research Markdown as normal subordinate support/iu);
  assert.match(autoAutonomous.instruction, /Dove owns the whole research responsibility/iu);
  assert.match(autoAutonomous.instruction, /must not mechanically traverse Skills\. The narrow exception is manuscript submission-readiness stopping.*invoke the Review capability entrance and obtain its current `PASS` or `REVISE` verdict/isu);
  assert.match(autoAutonomous.instruction, /invoke Dove's Review capability entrance on the actual current manuscript.*make an actual Skill call to `dove:review`.*Return `PASS` only when no material objection remains.*otherwise return `REVISE`/isu);
  assert.match(autoAutonomous.instruction, /A `REVISE` verdict keeps Auto working on the same submission-readiness mainline.*invoke Review again on the revised current version/isu);
  assert.match(autoAutonomous.instruction, /Any material manuscript or required-material change invalidates the earlier `PASS`/iu);
  assert.match(autoAutonomous.instruction, /Auto may stop as submit-ready only after the latest material state receives a current Review `PASS`/iu);
  assert.match(autoAutonomous.instruction, /Figure is not a second mandatory submission gate/iu);
  assert.match(autoAutonomous.instruction, /next action is to draw, redraw, revise, generate, caption, render for reviewer-facing inspection, or materially validate a figure.*must invoke Dove's Figure capability entrance before using host tools/isu);
  assert.match(autoAutonomous.instruction, /direct Bash render, image inventory, contact sheet, or visual summary does not satisfy the Figure call/iu);
  assert.match(autoAutonomous.instruction, /quantitative and statistical plots must come from real data and reproducible plotting code/iu);
  assert.match(autoAutonomous.instruction, /specialized figure-generation model when it is the best-suited tool/iu);
  assert.match(autoAutonomous.instruction, /After a material figure change or substantive figure repair decision, invoke Review again/iu);
  assert.match(autoAutonomous.instruction, /host cannot invoke the Review capability.*do not present direct reviewer perspective as the missing invocation and do not claim submit-ready/isu);
  assert.match(autoAutonomous.instruction, /Before declaring a manuscript submit-ready, use the latest Review invocation and its concrete findings/iu);
  assert.match(autoAutonomous.instruction, /Use the recovered whole-manuscript readiness basis to choose the next material action/iu);
  assert.match(autoAutonomous.instruction, /successfully generated DOCX or PDF does not resolve scientific, experimental, novelty, positioning, or argument blockers/iu);
  assert.match(autoAutonomous.instruction, /latest Review invocation and its concrete findings/iu);
  assert.match(autoAutonomous.instruction, /generic statement that the paper was rechecked is not a reassessment/iu);
  assert.match(autoAutonomous.instruction, /review handoff, old verdict, author-side task list, compaction summary, or review document does not satisfy the current Review invocation/iu);
  assert.match(autoAutonomous.instruction, /do not let one visible formatting or artifact gap displace a higher-order scientific or scholarly blocker/iu);
  assert.match(autoAutonomous.instruction, /Distinguish the authoritative manuscript source, the scholarly and evidence basis, and the venue-facing submission materials/iu);
  assert.match(autoAutonomous.instruction, /build or verify the required venue-facing artifact only when its form is established and that work is the next material action/iu);
  assert.match(autoAutonomous.instruction, /Distinguish a promising scientific core, locally corrected claim.*generated file.*from whole-manuscript readiness/isu);
  assert.match(autoAutonomous.instruction, /latest material state has a current Review `PASS` and the scientific and scholarly basis, verified venue requirements, and required venue-facing materials are complete or honestly bounded/iu);
  assert.match(autoAutonomous.instruction, /unresolved issues likely to require major scientific or scholarly revision as blockers/iu);
  assert.match(autoAutonomous.instruction, /reopen an earlier readiness conclusion when broader manuscript evidence or grounded review materially contradicts it/iu);
  assert.match(autoAutonomous.instruction, /After each substantive result.*current mainline or immediate goal/isu);
  assert.match(autoAutonomous.instruction, /checkpoint is an internal decision point, not a default place to return the final answer/iu);
  assert.match(autoAutonomous.instruction, /do not enter final synthesis merely because the next action can be named/iu);
  assert.match(autoAutonomous.instruction, /unavailable preferred tool.*approved local alternative can be implemented/iu);
  assert.match(autoAutonomous.instruction, /hard host context boundary.*exact unfinished action and only the minimum evidence needed to resume it before synthesis/isu);
  assert.match(autoAutonomous.instruction, /recovery summary or task list is not completion.*context exhaustion is not a scientific blocker/isu);
  assert.match(autoAutonomous.instruction, /Finishing one edit, check, Review invocation, export, or validation is a result to reassess, not a reason to close Auto/iu);
  assert.match(autoAutonomous.instruction, /perform that action in the same Auto run and continue the next cycle/iu);
  assert.match(autoAutonomous.instruction, /do not stop after describing work that Auto can still carry out/iu);
  assert.equal(autoMaintenance.persistencePolicy, "auto-subordinate");
  assert.match(autoMaintenance.instruction, /normal subordinate support/iu);
  assert.match(autoMaintenance.instruction, /never an Auto closing phase/iu);
  assert.match(autoMaintenance.instruction, /conditional support, not a per-cycle closing phase or a substitute for resuming interrupted work/iu);
  assert.match(autoMaintenance.instruction, /Never infer Lessons maintenance from Auto completion or a Stop continuation/iu);
  assert.match(autoSynthesis.instruction, /report progress against the current mainline or immediate goal/iu);
  assert.match(autoSynthesis.instruction, /Final synthesis is allowed only after a real stop condition is met/iu);
  assert.match(autoSynthesis.instruction, /manuscript submission readiness.*goal-achieved synthesis requires a current Review invocation returning `PASS` on the latest material state/isu);
  assert.match(autoSynthesis.instruction, /otherwise synthesize only a real unresolved boundary, not submit-ready completion/iu);
  assert.match(autoSynthesis.instruction, /return to autonomous research work and perform it rather than reporting it as a future next step/iu);
  assert.match(autoSynthesis.instruction, /Do not claim readiness from numeric hygiene, validation, provenance completion, a review document, a summary, or Markdown maintenance alone/iu);
  assert.match(autoSynthesis.instruction, /broader manuscript evidence or grounded review contradicts an earlier readiness verdict/iu);
  assert.match(autoSynthesis.instruction, /withdraw or revise that verdict and identify the newly established blockers/iu);
  assert.match(autoSynthesis.instruction, /Do not stop merely because one pass or support task finished/iu);
  assert.doesNotMatch(autoText, /task database|execution ledger.*create|scientific authority|current claim boundaries|adverse evidence|hidden session store|fallback|backcompat|fixed paper pipeline/iu);
}

function assertHostPolicy() {
  assert.deepEqual(HOST_ADAPTER_POLICY.toolAccess, {
    transport: "host-files",
    unavailable: "report",
    cliFallback: false,
    shellFallback: false
  });
  assert.deepEqual(HOST_ADAPTER_POLICY.privacy, { exposePrivateProtocol: false });
  assert.deepEqual(HOST_ADAPTER_POLICY.adapterBullets, DOVE_AGENT_CAPSULE_BULLETS);
  const policy = HOST_ADAPTER_POLICY.adapterBullets.join("\n");
  assert.match(policy, /one complete research agent/iu);
  assert.match(policy, /not separate planning, authoring, or reviewing personas/iu);
  assert.match(policy, /available and approved host file, search, coding, writing, figure, experiment, and research tools directly/iu);
  assert.match(policy, /researcher-owned context, not a database/iu);
  assert.doesNotMatch(policy, /scientific authority/iu);

  assert.deepEqual(USER_RESPONSE_POLICY, ["Follow the user's requested language and format."]);
}

function assertGeneratedAdapters() {
  const entries = generatedAdapterEntries();
  const agentEntries = generatedDoveAgentEntries();
  assert.equal(entries.length, COMMAND_SURFACES.length * PROJECT_HOST_IDS.length);
  assertUnique(entries.map((entry) => entry.relativePath), "Generated adapter paths");
  assertUnique(agentEntries.map((entry) => entry.relativePath), "Generated Dove agent paths");
  assert.deepEqual(agentEntries.map((entry) => entry.relativePath), [".claude/agents/dove.md"]);
  for (const entry of agentEntries) {
    assert.match(entry.content, /# Dove Agent/u);
    assert.match(entry.content, /one complete research agent/iu);
    assert.match(entry.content, /## Dove research-agent persona/u);
    for (const bullet of DOVE_AGENT_PERSONA_BULLETS) assert.ok(entry.content.includes(bullet));
    assert.doesNotMatch(entry.relativePath, /dove-(?:planner|builder|reviewer|reader|referee)|dove-(?:reviewer|reader|referee)/u);
    assert.doesNotMatch(entry.content, /three primary roles|Planner.*Builder\/Author.*Reviewer|user-switchable.*(?:reader|referee)/isu);
  }
  for (const entry of entries) {
    assert.equal(entry.destinationPath, adapterPathForCommand(entry.hostId, entry.command));
    assert.match(entry.relativePath, /^package-resources\/hosts\/(?:claude|dsh)\//u);
    assert.equal(entry.content, renderCommandAdapter(entry.hostId, entry.command));
    assert.match(entry.content, /^---\n/um);
    assert.match(entry.content, /## Internal workflow\n\nInternal guidance only; never use this workflow as the final report outline\./u);
    assert.doesNotMatch(entry.content, /Dove MCP tools|Call `(?:query|manage)_dove|semantic ID/iu);
    assert.doesNotMatch(entry.content, /No file write is required|Persist only when:/u);
    assert.match(entry.content, /objective and proportional/iu);
    if (entry.content.includes("research-document-maintenance")) {
      if (entry.command.id === "dove.lessons") {
        assert.match(entry.content, /Maintain Lessons only when the user explicitly asks to remember, reflect, or preserve durable Lessons guidance/iu);
        assert.doesNotMatch(entry.content, /Maintain Lessons only when.*research mainline/iu);
      } else if (entry.command.id === "dove.auto") {
        assert.match(entry.content, /Never infer Lessons maintenance from Auto completion or a Stop continuation/iu);
        assert.doesNotMatch(entry.content, /Maintain Dove research Markdown only when/iu);
      } else {
        assert.match(entry.content, /user explicitly asks to record, update, or save Dove research context/iu);
        assert.match(entry.content, /research mainline, conclusion, decision, or priority/iu);
        assert.match(entry.content, /durable recovery and evidence value/iu);
      }
    }
    if (entry.command.id === "dove.status") assert.match(entry.content, /This step is read-only; do not create or modify files\./u);
    if (["dove.draft", "dove.figure"].includes(entry.command.id)) {
      const artifactLine = entry.content.split("\n").find((line) => /artifact-editing|figure-creation/u.test(line));
      assert.ok(artifactLine);
      assert.doesNotMatch(artifactLine, /read-only|do not create or modify files/iu);
    }
    for (const bullet of HOST_ADAPTER_POLICY.adapterBullets) assert.ok(entry.content.includes(bullet));
    assert.doesNotMatch(entry.content, /## Response policy/u);
  }
}

function assertAmbientRouting() {
  for (const prompt of [
    "继续",
    "现在怎么办",
    "那接下来呢",
    "要不要继续",
    "what now",
    "should we continue",
    "要不要跑实验",
    "我们现在要不要跑实验",
    "do you think we should run an experiment",
    "should we record this result in the experiment note",
    "research",
    "source",
    "研究",
    "analyze this output",
    "fix this bug",
    "review this code",
    "帮我整理这个 Markdown"
  ]) assert.equal(isHighConfidenceAmbientWorkPrompt(prompt), false, `${prompt} must not ambient-route into Dove`);
  for (const prompt of [
    "research this problem",
    "find papers about retrieval-augmented generation",
    "分析这个实验结果",
    "记录这个实验结果到 Dove",
    "更新研究记录",
    "设计一个实验验证这个假设",
    "设计实验验证这个假设是否成立",
    "帮我写这张图的 caption",
    "prepare a review handoff for this manuscript",
    "record this result in the experiment note",
    "把这段写进研究记录",
    "保存到 lessons",
    "要不要跑个小实验？如果需要就跑一下",
    "do you think we should run an experiment, and if useful run it",
    "判断是否需要更新研究记录，需要就记录"
  ]) assert.equal(isHighConfidenceAmbientWorkPrompt(prompt), true, `${prompt} must remain eligible for Dove intake`);

  const entries = generatedClaudeAmbientProjectEntries();
  assert.deepEqual(entries.map((entry) => entry.destinationPath), EXPECTED_AMBIENT_PATHS);
  const byPath = new Map(entries.map((entry) => [entry.destinationPath, entry.content]));
  const rule = byPath.get(".claude/rules/dove.md");
  const intake = byPath.get(".claude/skills/dove-intake/SKILL.md");
  const paperSearch = byPath.get(PAPER_SEARCH_SUPPORT_SKILL_PATH);
  const ordinary = `${rule}\n${intake}`;
  assert.match(ordinary, /zero-write/iu);
  assert.match(ordinary, /one complete research agent/iu);
  assert.match(ordinary, /capability entrances, not separate personas/iu);
  assert.doesNotMatch(ordinary, /Planner.*Builder\/Author.*Reviewer/isu);
  assert.match(ordinary, /smallest suitable Dove Skill/iu);
  assert.match(ordinary, /never selects Auto/iu);
  assert.match(ordinary, /judgment-only prompts/iu);
  assert.match(ordinary, /weigh current evidence, task risk, user preference, and the research mainline/iu);
  assert.match(ordinary, /useful next move.*stop before executing, recording, launching subagents, or creating tasks unless the user explicitly asks/iu);
  assert.match(rule, /user explicitly names Dove while giving feedback, criticism, correction, or an improvement request about it/iu);
  assert.match(rule, /append a concise natural-language note to `\.dove\/install\/DOCTOR\.md`/iu);
  assert.match(rule, /reusable feedback about ordinary research or collaboration without explicitly naming Dove/iu);
  assert.match(rule, /relevant Lessons Markdown instead/iu);
  assert.match(rule, /A Stop-hook continuation is response rendering only/iu);
  assert.match(rule, /do not call tools, create tasks, continue research, or write DOCTOR, Lessons, research Markdown/iu);
  assert.match(rule, /Do not create IDs, statuses, severity fields, counters, frontmatter, or a fixed template/iu);
  assert.match(rule, /Do not record ordinary research uncertainty, project bugs, external tool failures, or general conversation/iu);
  assert.match(rule, /Do not ask the user to run `dove doctor`/iu);
  assert.match(intake, /research, status, source, experiment, draft, figure, review, rebuttal, or lessons/iu);
  assert.match(intake, /choose no Dove Skill and answer directly/iu);
  assert.match(intake, /do not expand a short follow-up into a new research or experiment task/iu);
  assert.doesNotMatch(ordinary, /dove-lessons-intake|manage_dove|public Dove MCP|semantic ID/iu);
  assert.match(paperSearch, /user-invocable: false/u);
  assert.match(paperSearch, /use_scihub: false/u);
  assert.match(paperSearch, /do not install dependencies or use a CLI or shell fallback/iu);
  assert.doesNotMatch(paperSearch, /uv tool install|pip install|download_scihub/iu);
  assert.deepEqual(PAPER_SEARCH_MCP_FRAGMENT, {
    type: "stdio",
    command: "uvx",
    args: ["--from", PAPER_SEARCH_PACKAGE_SPECIFIER, "paper-search-mcp"]
  });
  assert.equal(Object.hasOwn(PAPER_SEARCH_MCP_FRAGMENT, "env"), false);
}

function assertPackagedAgentPolicy() {
  const agentText = renderClaudeDoveAgent();
  assert.ok(USER_RESPONSE_POLICY.length > 0);
  assert.match(agentText, /one complete research agent/iu);
  assert.match(agentText, /hunches and first impressions as hypotheses.*user preferences as tradeoff signals/isu);
  assert.match(agentText, /Bring research drive/iu);
  assert.match(agentText, /layered means rather than equal goals/iu);
  assert.match(agentText, /actual Skill call to `dove:review`|Review capability/iu);
  assert.match(agentText, /latest material state receives a current Review `PASS`/iu);
  assert.match(agentText, /Figure capability entrance/iu);
  assert.match(agentText, /Auto is explicit-only foreground multi-round autonomy/iu);
  assert.doesNotMatch(agentText, /Keep three primary roles distinct|Planner frames|Builder\/Author performs|Reviewer returns/iu);
}

function assertPublicDocumentationBoundaries() {
  const usage = fs.readFileSync(path.join(ROOT, "docs/USAGE.md"), "utf8");
  const capabilityMatrix = fs.readFileSync(path.join(ROOT, "docs/CAPABILITY_MATRIX.md"), "utf8");
  const packaging = fs.readFileSync(path.join(ROOT, "docs/PACKAGING.md"), "utf8");
  for (const document of [usage, capabilityMatrix]) {
    assert.match(document, /actual `dove:review` runtime call|actual `dove:review` call|invokes Dove Review/iu);
    assert.match(document, /`PASS` or `REVISE`|latest current `PASS`/iu);
    assert.match(document, /only the latest current `PASS` permits a submit-ready stop|completion requires the latest current Review `PASS`/iu);
    assert.match(document, /same Dove agent|part of (?:the same|one) Dove agent|one complete Dove persona/iu);
    assert.match(document, /host tool trace|generated command surface.*cannot prove/isu);
    assert.match(document, /image counts|embedding.*inventory|package evidence only/isu);
    assert.match(document, /`dove:figure`/iu);
    assert.match(document, /specialized figure-generation model/iu);
  }
  assert.match(packaging, /cannot prove that `dove:review` actually ran.*host tool trace/isu);
}

function assertUserFacingCliOutput() {
  const homeCurrent = renderDoveHome({ state: "current" });
  const homeNeedsSync = renderDoveHome({ state: "needs-sync" });
  assert.match(homeCurrent, /完整科研 agent/iu);
  assert.match(homeCurrent, /进入 Claude Code 后切换 Dove agent 或使用 \/dove:\*/u);
  assert.match(homeNeedsSync, /Dove 项目集成需要更新/u);
  assert.match(homeNeedsSync, /dove update/u);
  assert.doesNotMatch(`${homeCurrent}\n${homeNeedsSync}`, /dove sync|\/dove:workspace/u);

  const initOutput = renderProjectIntegrationResult("init", {
    status: "initialized",
    target: "/workspace/example-project",
    hosts: ["claude"],
    writtenPaths: [],
    removedPaths: [],
    changedPaths: []
  });
  assert.match(initOutput, /Dove agent 已安装/u);
  assert.match(initOutput, /10 个 Dove 能力入口已安装/u);
  assert.match(initOutput, /切换到 Dove agent 或使用 \/dove:\* 能力入口/u);
  assert.doesNotMatch(initOutput, /12 个 Dove 工作入口|Dove-only MCP 批准|\/dove:workspace/u);

  const updateOutput = renderProjectIntegrationResult("update", {
    status: "updated",
    target: "/workspace/example-project",
    hosts: ["claude"],
    writtenPaths: [],
    removedPaths: [],
    changedPaths: []
  });
  assert.match(updateOutput, /Dove agent、能力入口/u);
  assert.match(updateOutput, /内置 Lessons 已刷新/u);
  assert.doesNotMatch(updateOutput, /dove sync|Dove-only MCP 批准/u);
}

function researchState(relativePath, content = null) {
  const bytes = content === null ? null : Buffer.from(content, "utf8");
  return {
    relativePath,
    exists: bytes !== null,
    type: bytes === null ? "absent" : "file",
    bytes,
    text: content,
    sha256: null,
    mode: bytes === null ? null : 0o644
  };
}

function assertResearchDefaultsOwnership() {
  const builtInNotice = "This is a Dove built-in Lesson. `dove update` replaces this file.";
  const retiredTopLevelLessons = ".dove/research/LESSONS.md";
  const retiredAdditionalLessons = ".dove/research/lessons/additional-lessons.md";
  assert.equal(Object.hasOwn(RESEARCH_DEFAULT_PATHS, "retiredTopLevelLessons"), false, "Retired top-level Lessons must not remain in the public default-path API");
  assert.equal(Object.hasOwn(RESEARCH_DEFAULT_PATHS, "additionalLessons"), false, "Retired additional Lessons must not remain in the public default-path API");
  const defaults = new Map(RESEARCH_DEFAULT_DOCUMENTS.map((document) => [document.path, document.content]));
  for (const topic of RESEARCH_LESSON_TOPICS) assert.match(defaults.get(topic.path), new RegExp(builtInNotice.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.ok(defaults.get(RESEARCH_DEFAULT_PATHS.decisionMaking).includes(DOVE_AGENT_LAYERING), "Decision-making Lesson must consume the canonical layering persona");
  assert.ok(defaults.get(RESEARCH_DEFAULT_PATHS.researchMethod).includes(DOVE_AGENT_HUNCH), "Research-method Lesson must consume the canonical hunch persona");
  assert.ok(defaults.get(RESEARCH_DEFAULT_PATHS.researchMethod).includes(DOVE_AGENT_CURIOSITY), "Research-method Lesson must consume the canonical research-drive persona");
  assert.ok(defaults.get(RESEARCH_DEFAULT_PATHS.engineeringAndValidation).includes(DOVE_AGENT_PROPORTIONALITY), "Engineering Lesson must consume the canonical proportionality persona");
  assert.match(defaults.get(RESEARCH_DEFAULT_PATHS.decisionMaking), /user preferences.*do not let.*preferences redefine/isu);
  assert.match(defaults.get(RESEARCH_DEFAULT_PATHS.experimentsAndEvidence), /fake rigor or fake progress/iu);
  assert.match(defaults.get(RESEARCH_DEFAULT_PATHS.writingAndReview), /nearest work.*actual task.*real user need.*supporting evidence/isu);
  assert.match(defaults.get(RESEARCH_DEFAULT_PATHS.researchMethod), /do not treat missing evidence as a reason to stop before seeking the evidence that matters/iu);
  assert.match(defaults.get(RESEARCH_DEFAULT_PATHS.experimentsAndEvidence), /not invent a substitute experiment or stop at merely admitting the basis is missing/iu);
  assert.match(defaults.get(RESEARCH_DEFAULT_PATHS.collaborationAndEnvironment), /user preferences as collaboration and risk signals/iu);
  for (const relativePath of [
    RESEARCH_DEFAULT_PATHS.overview,
    RESEARCH_DEFAULT_PATHS.missionsSummary,
    RESEARCH_DEFAULT_PATHS.experimentsSummary,
    RESEARCH_DEFAULT_PATHS.sourcesSummary,
    RESEARCH_DEFAULT_PATHS.reviewsSummary,
    RESEARCH_DEFAULT_PATHS.claimsSummary,
    RESEARCH_DEFAULT_PATHS.lessonsSummary
  ]) assert.doesNotMatch(defaults.get(relativePath), /Dove built-in Lesson/u);

  const researcherOverview = "# My research\n\nProject-owned mainline.\n";
  const researcherMissions = "# My missions\n\nProject-owned summary.\n";
  const researcherLessons = "# My lessons\n\nProject-owned guidance.\n- [Additional migrated Lessons](additional-lessons.md)\n";
  const staleTopic = "# Old built-in topic\n\nOutdated package doctrine.\n";
  const states = new Map(RESEARCH_DEFAULT_DOCUMENTS.map((document) => [document.path, researchState(document.path)]));
  states.set(RESEARCH_DEFAULT_PATHS.overview, researchState(RESEARCH_DEFAULT_PATHS.overview, researcherOverview));
  states.set(RESEARCH_DEFAULT_PATHS.missionsSummary, researchState(RESEARCH_DEFAULT_PATHS.missionsSummary, researcherMissions));
  states.set(RESEARCH_DEFAULT_PATHS.lessonsSummary, researchState(RESEARCH_DEFAULT_PATHS.lessonsSummary, researcherLessons));
  states.set(RESEARCH_DEFAULT_PATHS.decisionMaking, researchState(RESEARCH_DEFAULT_PATHS.decisionMaking, staleTopic));
  states.set(retiredTopLevelLessons, researchState(retiredTopLevelLessons, "retired"));
  states.set(retiredAdditionalLessons, researchState(retiredAdditionalLessons, "migrated"));
  states.set(RESEARCH_DEFAULT_PATHS.importedLessons, researchState(RESEARCH_DEFAULT_PATHS.importedLessons, "imported"));

  const plan = planResearchDefaults({ states });
  assert.equal(plan.writes.get(RESEARCH_DEFAULT_PATHS.missionsSummary), undefined, "Existing project summaries must not receive package prose");
  assert.equal(plan.writes.get(RESEARCH_DEFAULT_PATHS.overview).toString("utf8").startsWith(researcherOverview), true, "Overview navigation sync must preserve project prose");
  const lessonsSummary = plan.writes.get(RESEARCH_DEFAULT_PATHS.lessonsSummary).toString("utf8");
  assert.match(lessonsSummary, /Project-owned guidance/u);
  assert.doesNotMatch(lessonsSummary, /Additional migrated Lessons/u);
  assert.equal(plan.writes.get(RESEARCH_DEFAULT_PATHS.decisionMaking).toString("utf8"), defaults.get(RESEARCH_DEFAULT_PATHS.decisionMaking));
  assert.equal(plan.writes.has(RESEARCH_DEFAULT_PATHS.importedLessons), false, "Explicitly imported Lessons remain project-owned");
  assert.deepEqual([...plan.deletes].sort(), [retiredAdditionalLessons, retiredTopLevelLessons].sort());

  const replacePlan = planResearchDefaults({ states }, { mode: "replace" });
  for (const document of RESEARCH_DEFAULT_DOCUMENTS) assert.equal(replacePlan.writes.get(document.path).toString("utf8"), document.content);
}

function assertTrellisSpecMirrors() {
  const sourceDir = path.join(ROOT, ".trellis/spec/frontend");
  const templateDir = path.join(ROOT, "src/templates/markdown/spec/frontend");
  const sourceNames = fs.readdirSync(sourceDir).filter((name) => name.endsWith(".md")).sort();
  const templateNames = fs.readdirSync(templateDir).filter((name) => name.endsWith(".md")).sort();
  assert.deepEqual(templateNames, sourceNames);
  for (const name of sourceNames) assert.ok(fs.readFileSync(path.join(templateDir, name)).equals(fs.readFileSync(path.join(sourceDir, name))), name);
}

function assertRuntimeCli() {
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "init"));
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "hook"));
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "mcp"), false, "CLI must not expose the retired MCP server");
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "migrate-research"), false, "CLI must not expose format migration");
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "export-research"), "CLI must expose explicit Markdown export");
  assert.deepEqual(parseDoveCli(["hook", "user-prompt-submit", "--project=/workspace"]), {
    command: "hook",
    positionals: ["user-prompt-submit"],
    args: ["--project", "/workspace"]
  });
  assert.throws(() => parseDoveCli(["mcp", "serve"]), /Unknown|requires|unsupported/iu);
}

async function assertSourceBuilds() {
  for (const entryPoint of ["src/core/index.mjs", "bin/dove.mjs"]) {
    await build({ absWorkingDir: ROOT, entryPoints: [entryPoint], bundle: true, write: false, platform: "node", format: "esm", external: ["node:*"], logLevel: "silent" });
  }
}

assertDoveAgentPersona();
assertSkillManifest();
assertHostPolicy();
assertGeneratedAdapters();
assertAmbientRouting();
assertPackagedAgentPolicy();
assertUserFacingCliOutput();
assertPublicDocumentationBoundaries();
assertResearchDefaultsOwnership();
assertTrellisSpecMirrors();
assertRuntimeCli();
await assertSourceBuilds();

console.log(JSON.stringify({ status: "passed" }, null, 2));

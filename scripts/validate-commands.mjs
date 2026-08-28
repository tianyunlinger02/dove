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
  DOVE_AGENT_NAME,
  DOVE_AGENT_PERSONA_BULLETS,
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
  RESEARCH_DEFAULT_DIRECTORY_PATHS,
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

function skillContract(command) {
  const contract = command.contract;
  assert.equal(typeof contract?.purpose, "string", `${command.id} needs a purpose`);
  assert.equal(typeof contract?.when, "string", `${command.id} needs use guidance`);
  for (const field of ["responsibilities", "actions", "boundaries", "nonGoals", "clarification"]) {
    assert.ok(Array.isArray(contract[field]), `${command.id} contract.${field} must be an array`);
  }
  assert.equal(typeof contract.hostGuidance, "object", `${command.id} needs conditional host guidance`);
  return contract;
}

function contractText(command) {
  return text(skillContract(command));
}

function contractAction(command, capability) {
  return skillContract(command).actions.find((item) => item.capability === capability);
}

function contractActions(command) {
  return skillContract(command).actions;
}

function actionCapabilities(command) {
  return contractActions(command).map((item) => item.capability);
}

function assertCapabilitySet(command, expected) {
  assert.deepEqual([...actionCapabilities(command)].sort(), [...expected].sort(), `${command.id} possible action capabilities drifted`);
}

const SEMANTIC_SECTION_FIELDS = Object.freeze(["responsibilities", "actions", "boundaries", "nonGoals"]);

function structuredText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(structuredText).filter(Boolean).join("\n");
  if (typeof value === "object") return Object.values(value).map(structuredText).filter(Boolean).join("\n");
  return String(value);
}

function semanticSectionText(section) {
  return [section.title, section.purpose, section.description, ...SEMANTIC_SECTION_FIELDS.map((field) => structuredText(section[field]))].filter(Boolean).join("\n");
}

function semanticContractText(command) {
  const contract = skillContract(command);
  return structuredText([contract.purpose, contract.when, contract.semanticSections ?? [], contract.hostGuidance]);
}

function assertMatchesAll(value, label, patterns) {
  for (const pattern of patterns) assert.match(value, pattern, `${label} semantic contract drifted: ${pattern}`);
}

function assertMatchesNone(value, label, patterns) {
  for (const pattern of patterns) assert.doesNotMatch(value, pattern, `${label} must not contain retired or unsafe language: ${pattern}`);
}

function assertSemanticSections(command, options = {}) {
  const contract = skillContract(command);
  const min = options.min ?? 1;
  assert.ok(Array.isArray(contract.semanticSections), `${command.id} needs semanticSections`);
  assert.ok(contract.semanticSections.length >= min, `${command.id} needs at least ${min} semantic sections`);

  const titles = [];
  for (const [index, section] of contract.semanticSections.entries()) {
    assert.equal(typeof section.title, "string", `${command.id} semantic section ${index + 1} needs a title`);
    const title = section.title.trim();
    assert.ok(title, `${command.id} semantic section ${index + 1} title must not be empty`);
    titles.push(title);
    for (const field of SEMANTIC_SECTION_FIELDS) {
      if (Object.hasOwn(section, field)) assert.ok(Array.isArray(section[field]), `${command.id} semantic section ${title} ${field} must be an array`);
    }
    assert.ok(SEMANTIC_SECTION_FIELDS.some((field) => Array.isArray(section[field]) && section[field].length > 0), `${command.id} semantic section ${title} needs contract content`);
  }
  assertUnique(titles, `${command.id} semantic section titles`);

  for (const field of SEMANTIC_SECTION_FIELDS) {
    const flattened = contract.semanticSections.flatMap((section) => Array.isArray(section[field]) ? section[field] : []);
    assert.deepEqual(contract[field], flattened, `${command.id} top-level contract.${field} must mirror semanticSections`);
  }

  return contract.semanticSections;
}

function semanticSectionIndex(sections, matchers, options = {}) {
  const startIndex = options.startIndex ?? 0;
  const inclusive = options.inclusive === true;
  return sections.findIndex((section, sectionIndex) => sectionIndex >= startIndex && (inclusive || sectionIndex !== startIndex) && matchers.every((pattern) => pattern.test(semanticSectionText(section))));
}

function assertSemanticSectionOrder(command, expectations) {
  const sections = assertSemanticSections(command, { min: expectations.length });
  let previousIndex = -1;
  for (const expectation of expectations) {
    const index = semanticSectionIndex(sections, expectation.matchers, { startIndex: previousIndex, inclusive: false });
    assert.ok(index >= 0, `${command.id} semanticSections need ${expectation.label} after section ${previousIndex + 1}`);
    previousIndex = index;
  }
  return previousIndex;
}

function assertSemanticModeAvailable(command, sections, spec) {
  const sectionMatch = sections.some((section) => spec.matchers.every((pattern) => pattern.test(semanticSectionText(section))));
  const contractMatch = spec.matchers.every((pattern) => pattern.test(semanticContractText(command)));
  assert.ok(sectionMatch || contractMatch, `${command.id} must support ${spec.label}`);
}

function assertRenderedSemanticSectionOrder(entry) {
  const sections = entry.command.contract?.semanticSections;
  if (!Array.isArray(sections) || sections.length === 0) return;
  let previousIndex = -1;
  for (const section of sections) {
    const index = entry.content.indexOf(section.title);
    assert.ok(index > previousIndex, `${entry.command.id} generated adapter must render semantic section ${section.title} in contract order`);
    previousIndex = index;
  }
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
    assert.match(textValue, /preserving the work's evidence and continuation context is genuinely useful/iu);
    assert.match(textValue, /Auto.*explicit|explicit.*Auto/isu);
    assert.match(textValue, /foreground.*multi-round|multi-round.*foreground|inner rounds?|outer session/isu);
    assert.match(textValue, /user-confirmed Workspace mainline|confirmed mainline/iu);
    assert.match(textValue, /(?:cycle|rounds?).*(?:evidence|action|result|reassess)|(?:evidence|action|result).*(?:cycle|rounds?|reassess)/isu);
    assert.match(textValue, /Review findings are evidence inside Auto|Treat Review findings as evidence/iu);
    assert.match(textValue, /not authority over Dove's current judgment|not.*authority over the Workspace mainline/isu);
    assert.match(textValue, /mainline.*achieved|material blocker|user decision|explicit.*boundary/isu);
    assert.match(textValue, /current Dove run|current Dove judgment/iu);
    assert.match(textValue, /Direct Scientific Review.*self-check|author-side self-check/isu);
    assert.match(textValue, /isolated host Agent context|isolated Reviewer/isu);
    assert.match(textValue, /frozen handoff/iu);
    assert.match(textValue, /author-side sufficiency.*independent Reviewer acceptability recommendation|independent Reviewer acceptability recommendation.*author-side sufficiency/isu);
    assert.doesNotMatch(textValue, /actual Skill call to `dove:review`|latest material state receives a current Review `PASS`|Review gate/iu);
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
    assert.ok(Array.isArray(command.guidance) && command.guidance.length === 0, `${label} command guidance must remain folded into the contract`);
    assert.equal(command.workflow, undefined, `${label} must not expose the retired workflow.modes[].steps[] model`);
    assert.equal(command.modes, undefined, `${label} must not expose top-level modes`);
    assert.equal(command.steps, undefined, `${label} must not expose top-level steps`);

    const contract = skillContract(command);
    assert.ok(contract.responsibilities.length > 0, `${label} needs Dove responsibilities`);
    assert.ok(contract.actions.length > 0, `${label} needs possible actions`);
    assert.ok(contract.boundaries.length > 0, `${label} needs side-effect boundaries`);
    assert.ok(contract.nonGoals.length > 0, `${label} needs non-goals`);
    assert.ok(Object.hasOwn(contract.hostGuidance, "common"), `${label} needs common host guidance`);
    assert.ok(Object.hasOwn(contract.hostGuidance, "claude"), `${label} needs Claude host guidance`);
    assert.ok(Object.hasOwn(contract.hostGuidance, "dsh"), `${label} needs DSH host guidance`);
    for (const hostId of ["common", "claude", "dsh"]) {
      assert.ok(Array.isArray(contract.hostGuidance[hostId]), `${label} ${hostId} host guidance must be an array`);
    }

    for (const item of contract.actions) {
      assert.equal(item.type, "host", `${label} possible actions must use host-native work`);
      assert.equal(typeof item.capability, "string", `${label} action needs a capability`);
      assert.equal(typeof item.instruction, "string", `${label} action needs an instruction`);
      assert.equal(typeof item.readOnly, "boolean", `${label} action must classify read-only behavior`);
      assert.equal(typeof item.persistWhen, "string", `${label} action must classify persistence`);
      assert.ok(["never", "standard-research", "explicit-lessons", "auto-subordinate"].includes(item.persistencePolicy), `${label} has an unknown persistence policy`);
      if (item.readOnly) {
        assert.equal(item.persistWhen, "never", `${label} read-only actions cannot maintain research Markdown`);
        assert.equal(item.persistencePolicy, "never", `${label} read-only actions cannot classify persistence`);
      }
      if (item.persistWhen !== "never") assert.equal(item.capability, "research-document-maintenance", `${label} persistence is only for optional research Markdown maintenance`);
      if (item.persistencePolicy === "never") assert.equal(item.persistWhen, "never", `${label} must not hide an unrendered persistence trigger`);
      if (item.persistencePolicy !== "never") assert.notEqual(item.persistWhen, "never", `${label} needs a persistence trigger`);
      if (label === "dove.lessons" && item.capability === "research-document-maintenance") assert.equal(item.persistencePolicy, "explicit-lessons", "Lessons maintenance must remain explicit-only");
      if (label === "dove.auto" && item.capability === "research-document-maintenance") assert.equal(item.persistencePolicy, "auto-subordinate", "Auto maintenance must remain subordinate");
      assert.equal(item.tool, undefined, `${label} must not impersonate an MCP call`);
    }
  }

  const serialized = text(COMMAND_SURFACES);
  assert.match(serialized, /\.dove\/research\/RESEARCH\.md/u, "Skills must share the human-maintained overview entry");
  assert.doesNotMatch(serialized, /workflow"|"modes"|"steps"|Internal workflow|research-synthesis/iu, "Skills must not retain the retired sequential workflow rendering model");
  assert.doesNotMatch(serialized, /query_dove|manage_dove|MCP tool|semantic ID|Workspace record|Mission ID/iu, "Skills must not retain the research database contract");
  assert.doesNotMatch(serialized, /SQLite|vector database|hidden state service|hidden runtime/iu, "Skills must not prescribe a replacement database or hidden runtime");
  assert.doesNotMatch(serialized, /Review gate|Auto-gate|contribution score|return `PASS`|return `REVISE`|verdictEnum|strictImportSchema|same-context independent|same context independent/iu, "Skills must not recreate review gates, scoring states, schemas, enums, or same-context pseudo-independence");
  assert.doesNotMatch(serialized, /fixed closing synthesis|numbered steps/iu, "Skills must not preserve retired fixed-synthesis or numbered-step language");

  const research = COMMAND_SURFACE_BY_ID["dove.research"];
  const researchText = contractText(research);
  assertCapabilitySet(research, [
    "research-document-reading",
    "lesson-reading",
    "project-exploration",
    "research-work",
    "research-document-maintenance"
  ]);
  assert.match(research.contract.purpose, /bounded pass/iu);
  assert.match(researchText, /real research question/iu);
  assert.match(researchText, /different explanations or approaches/iu);
  assert.match(researchText, /lower-level artifacts simulate higher-level research progress/iu);
  assert.match(researchText, /advance a real judgment or eliminate a serious candidate/iu);

  const source = COMMAND_SURFACE_BY_ID["dove.source"];
  const sourceWork = contractAction(source, "source-research");
  assert.ok(sourceWork && !sourceWork.readOnly, "Source retrieval must be allowed to save useful material");
  assert.match(sourceWork.instruction, /retrieve when available, save when useful, read, and verify/iu);
  assert.match(sourceWork.instruction, /merely found.*actually retrieved, inspected, and used/iu);
  assert.doesNotMatch(sourceWork.instruction, /failures, conflicts, conditions, and limitations/iu);

  const status = COMMAND_SURFACE_BY_ID["dove.status"];
  assert.ok(contractActions(status).every((item) => item.readOnly), "Status must remain read-only");
  assert.match(contractText(status), /If an overview, summary, or link is absent.*say so naturally/isu);
  assert.match(contractText(status), /Status is read-only/iu);

  const experiment = COMMAND_SURFACE_BY_ID["dove.experiment"];
  const experimentText = contractText(experiment);
  const designInstruction = contractAction(experiment, "experiment-design").instruction;
  assertCapabilitySet(experiment, [
    "research-document-reading",
    "lesson-reading",
    "experiment-design",
    "experiment-execution",
    "research-document-maintenance"
  ]);
  assert.match(experiment.summary, /advances a research decision/iu);
  assert.match(experiment.contract.when, /contribution or evidence deficiency/iu);
  assert.match(designInstruction, /real problem.*key uncertainty.*route decision/iu);
  assert.match(designInstruction, /actual project material.*relevant sources.*smallest low-risk diagnostic/iu);
  assert.doesNotMatch(designInstruction, /invent a substitute experiment/iu);
  assert.ok(designInstruction.indexOf("real problem") < designInstruction.indexOf("For a new experiment"), "Experiment purpose must precede experiment planning within the design action");
  assert.match(experimentText, /design-only.*stop before central execution/isu);
  assert.match(experimentText, /analysis of existing results.*directly/isu);
  assert.match(experimentText, /retrospective.*rather than.*prospective/isu);
  assert.match(experimentText, /actual procedure, result, and any deviation that changes the interpretation/isu);
  assert.match(experimentText, /do not run experiments mechanically/iu);
  assert.doesNotMatch(experimentText, /denominator accounting|supports and cannot establish|actual provenance/iu);

  const draft = COMMAND_SURFACE_BY_ID["dove.draft"];
  const draftText = contractText(draft);
  assert.match(draft.contract.when, /expression, argument, or an authoritative delivery artifact is the limiting deficiency/iu);
  assert.match(draftText, /science is sufficiently supported|clearer wording cannot support the intended contribution/iu);
  assert.match(draftText, /edit the authoritative source and propagate through the real build or export path/iu);

  const figure = COMMAND_SURFACE_BY_ID["dove.figure"];
  const figureText = contractText(figure);
  const figureCreation = contractAction(figure, "figure-creation");
  const figureValidation = contractAction(figure, "figure-validation");
  assert.match(figure.contract.when, /figure is the material evidence or communication bottleneck/iu);
  assert.match(figureCreation.instruction, /figure's evidence job in the manuscript or research argument/iu);
  assert.match(figureCreation.instruction, /actual data, selection metadata, source visuals, plotting or rendering code, captions, nearby claims, and intended manuscript layout/iu);
  assert.match(figureCreation.instruction, /real data and reproducible plotting code for quantitative or statistical plots/iu);
  assert.match(figureCreation.instruction, /specialized figure-generation model for method diagrams, conceptual illustrations, or visual abstracts/iu);
  assert.match(figureCreation.instruction, /Do not invent data, results, or method details/iu);
  assert.match(figureCreation.instruction, /repository-local temporary workspace such as `.claude\/tmp\/`, not the system `\/tmp`/iu);
  assert.match(figureValidation.instruction, /actual rendered figure in its reviewer-facing manuscript layout and at realistic final size/iu);
  assert.match(figureValidation.instruction, /not only as a standalone source image or contact sheet/iu);
  assert.match(figureValidation.instruction, /nearby manuscript claim, source data or selection metadata, and rendering or plotting logic agree/iu);
  assert.match(figureText, /Figure capability/iu);
  assert.doesNotMatch(figureText, /image counts?[^.]*quality|embedding[^.]*proves?|always use[^.]*generation model/iu);

  const review = COMMAND_SURFACE_BY_ID["dove.review"];
  const reviewText = semanticContractText(review);
  const reviewSections = assertSemanticSections(review, { min: 3 });
  const reviewGrounding = contractAction(review, "review-grounding");
  const reviewerWork = contractAction(review, "reviewer-perspective-work");
  const reviewHandoff = contractAction(review, "review-handoff");
  assertCapabilitySet(review, [
    "research-document-reading",
    "lesson-reading",
    "review-grounding",
    "reviewer-perspective-work",
    "delivery-review",
    "review-handoff",
    "research-document-maintenance"
  ]);
  assert.ok(reviewGrounding, "Review needs a grounding action");
  assert.equal(reviewGrounding.readOnly, true, "Review grounding must not create research records by default");
  assert.ok(reviewerWork?.readOnly, "Direct Review must return critique without author-side writes");
  assertSemanticSectionOrder(review, [
    {
      label: "direct scientific review before delivery boundary",
      matchers: [/(?:direct.*scientific|scientific.*review|reviewer-perspective.*critique|self-check)/iu, /(?:critique|falsifier|claim.*evidence|evidence.*claim|material findings)/iu]
    },
    {
      label: "conditional delivery boundary after scientific review",
      matchers: [/(?:delivery|venue|formatting|packaging|required materials|submission)/iu, /(?:conditional|only when|sufficiently supported|delivery boundary|does not prove|does not substitute)/iu]
    },
    {
      label: "independent reviewer handoff after delivery review",
      matchers: [/(?:independent reviewer|isolated reviewer|isolated host agent)/iu, /(?:frozen handoff|frozen materials|whole-paper|acceptability recommendation)/iu]
    }
  ]);
  for (const mode of [
    { label: "Direct Scientific Review self-check", matchers: [/direct/iu, /scientific/iu, /review/iu, /self-check|author-side/iu] },
    { label: "Conditional Delivery Review", matchers: [/(?:conditional|only when|sufficiently supported|genuinely limiting)/iu, /(?:delivery|venue|format|packag|required material|submission)/iu] },
    { label: "Independent Reviewer Handoff", matchers: [/independent Reviewer|isolated.*Reviewer|isolated host Agent/iu, /handoff|frozen materials|frozen handoff/iu] },
    { label: "Returned Review Import", matchers: [/(?:returned[- ]review|reviewer return|actual reviewer return|return)/iu, /import|preserve|faithfully/iu] },
    { label: "Context Inspection", matchers: [/(?:context inspection|review-context inspection|inspect(?: existing)? review context|inspect context)/iu] }
  ]) assertSemanticModeAvailable(review, reviewSections, mode);
  assertMatchesAll(reviewText, "dove.review", [
    /scientific.*(?:before|first|comes before).*delivery|delivery.*(?:does not substitute|cannot substitute|does not prove).*scientific/isu,
    /findings?/iu,
    /evidence/iu,
    /useful response|response/iu,
    /downstream use|caller|Auto must absorb/iu,
    /current Dove run/iu,
    /Direct Scientific Review.*self-check|author-side self-check/isu,
    /independent Reviewer|isolated.*Reviewer|isolated host Agent/isu,
    /frozen handoff|frozen materials/iu,
    /scientific acceptability.*delivery readiness|delivery readiness.*scientific acceptability/isu,
    /whole-paper|current full paper|current full version/iu,
    /author-side sufficiency.*independent Reviewer acceptability recommendation|independent Reviewer acceptability recommendation.*author-side sufficiency/isu,
    /cosmetic-only/iu,
    /selective evidence/iu,
    /hiding counterevidence/iu,
    /narrowing claims without scientific reason/iu,
    /diff-only/iu,
    /restarting\/manipulating Reviewer context/iu
  ]);
  assertMatchesAll(reviewHandoff.instruction, "dove.review handoff", [
    /fresh.*isolated|isolated.*fresh/isu,
    /resume.*same.*Reviewer|same.*Reviewer.*re-review/isu,
    /frozen materials|frozen handoff/iu,
    /whole-paper.*recommendation|recommendation.*whole-paper/isu
  ]);
  assertMatchesAll(reviewGrounding.instruction, "dove.review grounding", [
    /venue|submission stage|official .*requirements/isu,
    /published work|scholarly context|nearest comparators|novelty/iu,
    /found.*retrieved.*inspected.*used|retrieved.*inspected.*used/isu,
    /current full-paper review|frozen handoff|author-side self-check|independent Reviewer/iu,
    /returned[- ]review import|review-context inspection/iu
  ]);
  assertMatchesAll(reviewerWork.instruction, "dove.review work", [
    /current Dove run/iu,
    /do not call.*Agent tool|do not.*helper subagents/isu,
    /contribution|novelty|claims|evidence|method|experiment conditions|limitations|writing clarity|reader confusion/isu,
    /current full paper|whole-paper/iu,
    /findings?.*evidence.*(?:consequence|effect).*response|evidence.*(?:consequence|effect).*response/isu,
    /acceptability recommendation/iu,
    /scientific acceptability|delivery readiness/iu,
    /advisory (?:author-side )?reviewer perspective.*not independent external review.*authority over Auto/isu,
    /does not itself authorize author-side artifact changes/iu,
    /cannot satisfy final independent review/iu
  ]);
  assertMatchesAll(reviewText, "dove.review authority boundary", [
    /not independent external review|does not claim independent external review/iu,
    /not.*authority over|does not.*authority over/isu,
    /does not modify author-side manuscript.*experiment.*implementation.*build.*delivery(?:.*Review-return)? artifacts/isu,
    /does not continue as author-side execution.*explicitly invoked Auto|explicitly invoked Auto.*does not continue/isu,
    /does not satisfy final independent review|cannot satisfy final independent review/iu,
    /reviewer status|external acceptance|independent Reviewer status/iu
  ]);
  assertMatchesNone(reviewText, "dove.review", [
    /ReviewExchange|reviewId|findingId|verdictEnum|strictImportSchema|fixed paper pipeline|helper reviewer Agents?/iu,
    /submission-readiness gate|Review gate|Auto-gate|actual Skill call|return `PASS`|return `REVISE`/iu,
    /same-context independent|pseudo-independent|local separation proves independence|host label proves independence/iu,
    /claim acceptance[^.]*as proof|Reviewer controls Auto/iu
  ]);

  const rebuttal = COMMAND_SURFACE_BY_ID["dove.rebuttal"];
  const rebuttalText = contractText(rebuttal);
  assert.match(rebuttalText, /author-side Dove work/iu);
  assert.match(rebuttalText, /make requested ordinary project revisions/iu);
  assert.match(rebuttalText, /supplements, highlights, or venue-facing files/iu);
  assert.match(rebuttalText, /Do not let the Reviewer control the Workspace mainline/iu);
  assert.doesNotMatch(rebuttalText, /claim acceptance[^.]*as proof|Reviewer controls Auto/iu);

  const lessons = COMMAND_SURFACE_BY_ID["dove.lessons"];
  const lessonsText = contractText(lessons);
  assert.match(lessonsText, /researcher-owned Lessons documents/iu);
  assert.match(lessonsText, /Lessons materials are optional researcher-owned advisory documents, not package-owned defaults/iu);
  assert.doesNotMatch(lessonsText, /package-managed built-in Lessons themes|maintain supported reusable guidance in the relevant theme under `lessons\/`/iu);
  const lessonsReading = contractAction(lessons, "research-document-reading");
  const lessonsMaintenance = contractAction(lessons, "research-document-maintenance");
  assert.equal(lessonsReading.readOnly, true);
  assert.equal(lessonsMaintenance.persistencePolicy, "explicit-lessons");
  assert.match(lessonsMaintenance.persistWhen, /explicitly asks to remember, reflect, or preserve durable Lessons guidance/iu);
  assert.doesNotMatch(lessonsMaintenance.persistWhen, /research mainline|durable recovery and evidence value/iu);

  const auto = COMMAND_SURFACE_BY_ID["dove.auto"];
  const autoText = semanticContractText(auto);
  const autoSections = assertSemanticSections(auto, { min: 3 });
  const autoRead = contractAction(auto, "research-document-reading");
  const autoAutonomous = contractAction(auto, "autonomous-research-work");
  const autoIndependentReviewer = contractAction(auto, "independent-reviewer-handoff");
  const autoMaintenance = contractAction(auto, "research-document-maintenance");
  assertCapabilitySet(auto, [
    "research-document-reading",
    "autonomous-research-work",
    "independent-reviewer-handoff",
    "research-document-maintenance"
  ]);
  assert.ok(autoRead?.readOnly, "Auto must begin from read-only mainline/context reading");
  assert.ok(autoAutonomous && !autoAutonomous.readOnly, "Auto needs an autonomous host-work action");
  assert.ok(autoIndependentReviewer && !autoIndependentReviewer.readOnly, "Auto needs an independent Reviewer handoff action when host isolation is available");
  assert.equal(autoMaintenance.persistencePolicy, "auto-subordinate");
  assertSemanticSectionOrder(auto, [
    {
      label: "outer session",
      matchers: [/(?:outer session|explicit foreground session|foreground)/iu, /(?:mainline|suffix)/iu, /(?:ambient|background|runtime|queue|daemon)/iu]
    },
    {
      label: "inner scientific rounds",
      matchers: [/(?:inner scientific rounds?|scientific round|next scientific round)/iu, /(?:material action|host tools|actual result|reassess)/iu, /(?:next round|begin the next round|by default begins the next round)/iu]
    },
    {
      label: "research priority and scientific writing",
      matchers: [/(?:research hierarchy|research priority|contribution|method|evidence|experiment|source|writing|delivery)/iu, /(?:readiness basis|scientific writing|manuscript|authoritative source|build path)/iu]
    },
    {
      label: "review absorption",
      matchers: [/(?:Review findings|reviewer-perspective|adversarial judgment)/iu, /(?:absorb|reject|convert|defer|bound|block)/iu]
    },
    {
      label: "independent reviewer handoff",
      matchers: [/(?:independent Reviewer|isolated Reviewer|isolated host Agent)/iu, /(?:frozen handoff|whole-paper|acceptability recommendation)/iu]
    },
    {
      label: "outer stop",
      matchers: [/(?:stop Auto|outer stop|material blocker|explicit user|permission|safety|resource|time|external boundary)/iu, /(?:next scientific round|Otherwise begin the next scientific round)/iu]
    }
  ]);
  for (const section of autoSections) {
    const sectionText = semanticSectionText(section);
    assert.doesNotMatch(sectionText, /^\s*\d+\./mu, "Auto semantic sections must not become numbered steps");
  }
  assertMatchesAll(autoText, "dove.auto", [
    /explicit(?:-only)?|explicitly invokes|explicitly requests/iu,
    /foreground/iu,
    /multi-round|repeated|recurrent/iu,
    /user-confirmed|confirmed.*mainline|mainline.*confirmed/iu,
    /immediate in-scope|suffix/iu,
    /contribution/iu,
    /evidence/iu,
    /authoritative artifact|authoritative manuscript|LaTeX/iu,
    /material deficiency|limiting deficiency|research hierarchy/iu,
    /Review findings?|reviewer-perspective|acceptability recommendation/iu,
    /absorb|reject|convert|act on|defer|bound/iu,
    /stop|blocker|user decision|boundary/iu,
    /operational interruption/iu,
    /independent Reviewer handoff|frozen handoff/iu
  ]);
  assertMatchesAll(autoRead.instruction, "dove.auto reading", [
    /current conversation|actual project artifacts/iu,
    /user-confirmed|confirmed.*mainline|mainline.*confirmed/iu,
    /do not.*(?:reconstruct|replace|broaden)|not confirmed.*ask/isu,
    /suffix|without a suffix|completion condition/isu,
    /LaTeX|authoritative manuscript source|build path/iu,
    /Reviewer returns|clarifications|private Reviewer transcripts/iu
  ]);
  assertMatchesAll(autoAutonomous.instruction, "dove.auto autonomous work", [
    /materially help|materially improve|next useful mainline action/iu,
    /Review|Figure|Source|Experiment|Draft|Rebuttal/iu,
    /do not treat.*(?:capability|recommendation|checklist|validation|generated file|Markdown update|Mission completion).*objective/isu,
    /LaTeX|authoritative .*source|compiled output/iu,
    /Review|figure inspection/iu,
    /absorb|reject|convert/iu,
    /independent Reviewer handoff|frozen handoff/iu
  ]);
  assertMatchesAll(autoMaintenance.instruction, "dove.auto maintenance", [
    /narrowest document|narrowest .*document/iu,
    /mainline|conclusion|decision|priority|recovery/iu,
    /never.*endpoint|required endpoint/iu
  ]);
  assertMatchesAll(auto.contract.hostGuidance.claude.join("\n"), "dove.auto Claude host guidance", [
    /actually exposes|session exposes/iu,
    /background|monitor|cron|loop|tmux|waiting/iu,
    /success|failure|crash|timeout|OOM|cancellation|missing output/iu,
    /isolated Reviewer|independent review/iu
  ]);
  assertMatchesAll(auto.contract.hostGuidance.dsh.join("\n"), "dove.auto DSH host guidance", [
    /lacks.*waiting|monitoring affordance/iu,
    /preserve.*continuation|say so honestly/iu,
    /isolated persistent Reviewer context|independent review/iu
  ]);
  assertMatchesAll(autoText, "dove.auto runtime boundary", [
    /not.*(?:ambient routing|background queue|runtime)|must not become.*(?:daemon|scheduler|queue|runtime)/isu,
    /independent Reviewer handoff.*frozen handoff/isu
  ]);
  assertMatchesNone(autoText, "dove.auto", [
    /task database|execution ledger.*create|scientific authority|current claim boundaries|adverse evidence|hidden session store|fallback|backcompat|fixed paper pipeline|ambient Auto/iu,
    /Review gate|Auto-gate|latest current `PASS`|actual Skill call to `dove:review`|return `PASS`|return `REVISE`/iu,
    /same-context independent/iu
  ]);
  assertMatchesNone(auto.contract.hostGuidance.dsh.join("\n"), "dove.auto DSH host guidance", [
    /Claude Code hooks.*available|Monitor.*available|Cron.*available|tmux.*available/iu
  ]);
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
    assert.match(entry.content, /## Capability contract\n\nUse these responsibilities and actions as an unordered capability contract/iu);
    assert.match(entry.content, /### Purpose\n\n/u);
    assert.match(entry.content, /### Use when\n\n/u);
    if (Array.isArray(entry.command.contract?.semanticSections)) {
      assertRenderedSemanticSectionOrder(entry);
      assert.match(entry.content, /#### Responsibilities\n\n/u);
      assert.match(entry.content, /#### Actions\n\n/u);
      assert.match(entry.content, /#### Side-effect and authorization boundary\n\n/u);
      assert.match(entry.content, /#### Non-goals\n\n/u);
    } else {
      assert.match(entry.content, /### Dove responsibilities\n\n/u);
      assert.match(entry.content, /### Possible actions\n\n/u);
      assert.match(entry.content, /### Side-effect and authorization boundary\n\n/u);
      assert.match(entry.content, /### Non-goals\n\n/u);
    }
    assert.match(entry.content, /### Conditional host guidance\n\n/u);
    if (["dove.auto", "dove.review"].includes(entry.command.id)) {
      for (const bullet of entry.command.adapterCapsuleBullets) assert.ok(entry.content.includes(bullet));
      assert.doesNotMatch(entry.content, /## Dove capsule[\s\S]*Bring research drive/iu);
      assert.doesNotMatch(entry.content, /## Dove capsule[\s\S]*When the route is open/iu);
    } else {
      for (const bullet of HOST_ADAPTER_POLICY.adapterBullets) assert.ok(entry.content.includes(bullet));
    }
    assert.doesNotMatch(entry.content, /## Internal workflow|Internal guidance only|^\s*\d+\./mu);
    assert.doesNotMatch(entry.content, /Dove MCP tools|Call `(?:query|manage)_dove|semantic ID/iu);
    assert.doesNotMatch(entry.content, /No file write is required|Persist only when:/u);
    assert.match(entry.content, /objective and proportional/iu);
    if (entry.content.includes("research-document-maintenance")) {
      if (entry.command.id === "dove.lessons") {
        assert.match(entry.content, /Maintain Lessons only when the user explicitly asks to remember, reflect, or preserve durable Lessons guidance/iu);
        assert.doesNotMatch(entry.content, /Maintain Lessons only when.*research mainline/iu);
      } else if (entry.command.id === "dove.auto") {
        assert.match(entry.content, /Maintain only the narrowest document when the result changes the mainline/iu);
        assert.doesNotMatch(entry.content, /Auto completion or a Stop continuation/iu);
        assertRenderedSemanticSectionOrder(entry);
      } else {
        assert.match(entry.content, /user explicitly asks to record, update, or save Dove research context/iu);
        assert.match(entry.content, /research mainline, conclusion, decision, or priority/iu);
        assert.match(entry.content, /preserving the work's evidence and continuation context is genuinely useful/iu);
      }
    }
    if (entry.command.id === "dove.status") assert.match(entry.content, /Read-only: do not create or modify files\./u);
    if (["dove.draft", "dove.figure"].includes(entry.command.id)) {
      const artifactLine = entry.content.split("\n").find((line) => /artifact-editing|figure-creation/u.test(line));
      assert.ok(artifactLine);
      assert.doesNotMatch(artifactLine, /read-only|do not create or modify files/iu);
    }
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
  assert.match(rule, /Dove does not install or rely on a Stop hook/iu);
  assert.match(rule, /Stop does not drive research continuity, routing, tools, writes, scheduling, or plain-language second turns/iu);
  assert.doesNotMatch(rule, /Stop-hook continuation|说人话|plain-language rendering path/iu);
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
  assert.match(agentText, /Review and independent Reviewer loop/iu);
  assert.match(agentText, /Review findings and recommendations are evidence to act on, rebut, bound, or defer|Review findings?.*(?:input|advice|absorb|reject|convert|act on)/isu);
  assert.match(agentText, /Figure capability/iu);
  assert.doesNotMatch(agentText, /actual Skill call to `dove:review`|latest material state receives a current Review `PASS`|Review gate/iu);
  assert.match(agentText, /Auto.*explicit|explicit.*Auto/isu);
  assert.match(agentText, /foreground.*multi-round|multi-round.*foreground|inner rounds?|outer session/isu);
  assert.doesNotMatch(agentText, /Keep three primary roles distinct|Planner frames|Builder\/Author performs|Reviewer returns/iu);
}

function assertPublicDocumentationBoundaries() {
  const usage = fs.readFileSync(path.join(ROOT, "docs/USAGE.md"), "utf8");
  const capabilityMatrix = fs.readFileSync(path.join(ROOT, "docs/CAPABILITY_MATRIX.md"), "utf8");
  const packaging = fs.readFileSync(path.join(ROOT, "docs/PACKAGING.md"), "utf8");
  for (const document of [usage, capabilityMatrix]) {
    assert.match(document, /user-confirmed Workspace mainline/iu);
    assert.match(document, /Review.*advisory|advisory.*Review/isu);
    assert.match(document, /no.*(?:verdict|PASS|REVISE).*controls?|does not.*(?:control|decide).*completion/isu);
    assert.match(document, /same Dove agent|one complete Dove persona/iu);
    assert.match(document, /image counts|embedding.*inventory|package evidence only/isu);
    assert.match(document, /dove(?:\.|:)figure|Figure capability/iu);
    assert.match(document, /specialized figure-generation model/iu);
    assert.match(document, /LaTeX as the authoritative manuscript source|uses LaTeX as the authoritative manuscript source/iu);
    assert.match(document, /do(?:es)? not provide or accept LaTeX/iu);
    assert.match(document, /stops? only when|It stops when/iu);
    assert.doesNotMatch(document, /documented or recovered mainline|recovers the current mainline|Review-gated|Auto-gate|latest current `PASS`|actual `dove:review` call/iu);
  }
  assert.match(packaging, /generated adapters/iu);
  assert.match(packaging, /release validation/iu);
  assert.match(packaging, /cannot prove that Auto chose or performed the right research action/iu);
  assert.doesNotMatch(packaging, /Auto's Review gate|actual `dove:review` actually ran|runtime Skill call for Auto's Review gate/iu);
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
  assert.match(updateOutput, /项目绝对路径状态栏已刷新/u);
  assert.doesNotMatch(updateOutput, /内置 Lessons 已刷新|dove sync|Dove-only MCP 批准/u);
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
  const retiredTopLevelLessons = ".dove/research/LESSONS.md";
  const retiredAdditionalLessons = ".dove/research/lessons/additional-lessons.md";
  assert.equal(Object.hasOwn(RESEARCH_DEFAULT_PATHS, "retiredTopLevelLessons"), false, "Retired top-level Lessons must not remain in the public default-path API");
  assert.equal(Object.hasOwn(RESEARCH_DEFAULT_PATHS, "additionalLessons"), false, "Retired additional Lessons must not remain in the public default-path API");
  assert.deepEqual(RESEARCH_DEFAULT_DOCUMENTS.map((document) => document.path), [RESEARCH_DEFAULT_PATHS.overview]);
  assert.deepEqual(RESEARCH_DEFAULT_DIRECTORY_PATHS, [RESEARCH_DEFAULT_PATHS.root]);
  assert.deepEqual(RESEARCH_LESSON_TOPICS, []);

  const defaults = new Map(RESEARCH_DEFAULT_DOCUMENTS.map((document) => [document.path, document.content]));
  const overviewDefault = defaults.get(RESEARCH_DEFAULT_PATHS.overview);
  assert.match(overviewDefault, /^# Research/mu);
  assert.match(overviewDefault, /researcher-owned entry/iu);
  for (const relativePath of [
    RESEARCH_DEFAULT_PATHS.missionsSummary,
    RESEARCH_DEFAULT_PATHS.experimentsSummary,
    RESEARCH_DEFAULT_PATHS.sourcesSummary,
    RESEARCH_DEFAULT_PATHS.reviewsSummary,
    RESEARCH_DEFAULT_PATHS.claimsSummary,
    RESEARCH_DEFAULT_PATHS.lessonsSummary,
    RESEARCH_DEFAULT_PATHS.decisionMaking,
    RESEARCH_DEFAULT_PATHS.researchMethod,
    RESEARCH_DEFAULT_PATHS.experimentsAndEvidence,
    RESEARCH_DEFAULT_PATHS.engineeringAndValidation,
    RESEARCH_DEFAULT_PATHS.writingAndReview,
    RESEARCH_DEFAULT_PATHS.collaborationAndEnvironment
  ]) assert.equal(defaults.has(relativePath), false, `${relativePath} must not be a mandatory installed research default`);

  const absentStates = new Map(RESEARCH_DEFAULT_DOCUMENTS.map((document) => [document.path, researchState(document.path)]));
  const bootstrapPlan = planResearchDefaults({ states: absentStates });
  assert.deepEqual([...bootstrapPlan.writes.keys()], [RESEARCH_DEFAULT_PATHS.overview]);
  assert.equal(bootstrapPlan.writes.get(RESEARCH_DEFAULT_PATHS.overview).toString("utf8"), overviewDefault);
  assert.deepEqual([...bootstrapPlan.deletes], []);

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
  assert.equal(plan.writes.size, 0, "Existing .dove/research/** must remain researcher-owned and untouched during sync");
  assert.equal(plan.deletes.size, 0, "Research sync must not delete retired or optional researcher-visible materials");

  const replacePlan = planResearchDefaults({ states }, { mode: "replace" });
  assert.deepEqual([...replacePlan.writes.keys()], [RESEARCH_DEFAULT_PATHS.overview]);
  assert.equal(replacePlan.writes.get(RESEARCH_DEFAULT_PATHS.overview).toString("utf8"), overviewDefault);
  assert.deepEqual([...replacePlan.deletes], []);
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

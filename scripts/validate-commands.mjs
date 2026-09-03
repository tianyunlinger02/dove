#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import { CLI_COMMAND_SPECS, parseDoveCli } from "../src/cli/command-parser.mjs";
import { runInteractiveDoveSetup } from "../src/cli/interactive-setup.mjs";
import { renderProjectIntegrationResult } from "../src/cli/project-integration-output.mjs";
import { renderDoveHome } from "../src/cli/terminal-output.mjs";
import {
  COMMAND_SURFACE_BY_ID,
  COMMAND_SURFACES,
  HOST_ADAPTER_POLICY,
  PACKAGE_DOCUMENTATION_PATHS,
  PACKAGE_GENERATED_SUPPORT_PATHS,
  PROJECT_HOST_IDS,
  adapterPathForCommand
} from "../src/core/command-manifest.mjs";
import {
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
import { isResearchRelatedWakeupPrompt } from "../src/core/ambient-policy.mjs";
import {
  DEFAULT_INITIALIZABLE_HOSTS,
  HOST_REGISTRY,
  PROJECT_HOST_IDS as REGISTERED_PROJECT_HOST_IDS
} from "../src/core/host-registry.mjs";
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
  EXA_MCP_FRAGMENT,
  EXA_WEB_SUPPORT_SKILL_PATH,
  WEB_FETCH_DENY_PERMISSION
} from "../src/core/web-access-integration.mjs";
import {
  generatedAdapterEntries,
  generatedClaudeAmbientProjectEntries,
  renderCommandAdapter
} from "./generate-command-adapters.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_HOST_IDS = ["claude", "dsh"];
const EXPECTED_SKILL_IDS = ["dove.research", "dove.status", "dove.source", "dove.experiment", "dove.draft", "dove.figure", "dove.review", "dove.rebuttal", "dove.lessons"];
const EXPECTED_AMBIENT_PATHS = [
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  PAPER_SEARCH_SUPPORT_SKILL_PATH,
  EXA_WEB_SUPPORT_SKILL_PATH
];
const RETIRED_RESEARCH_MODEL_PHRASES = Object.freeze([
  "layer enum",
  "contribution score",
  "state machine",
  "fixed pipeline",
  "runtime controller",
  "runtime daemon",
  "runtime scheduler",
  "runtime queue",
  "finding schema",
  "same-context independent",
  "same context independent",
  "same-context pseudo-independence",
  "fallback",
  "backcompat"
]);
const UNSAFE_RESEARCH_SURFACE_PATTERNS = Object.freeze([
  { label: "pilot terminology", pattern: /\bpilot(?:s|ing)?\b/iu },
  { label: "small/local evidence overclaims broad scale", pattern: /\b(?:small-scale|diagnostic|local)\b[^.]{0,160}\b(?:proves?|guarantees?|establish(?:es|ed)?|validates?)\b[^.]{0,100}\b(?:large-scale|full-scale|cross-scale|all scales|deployment|production|universal|general(?:ized|izable|ization)?|paper-wide)\b/iu },
  { label: "broad scale overclaimed from small/local evidence", pattern: /\b(?:large-scale|full-scale|cross-scale|all scales|deployment|production|universal|general(?:ized|izable|ization)?|paper-wide)\b[^.]{0,160}\b(?:proves?|guarantees?|establish(?:es|ed)?|validates?)\b[^.]{0,100}\b(?:small-scale|diagnostic|local)\b/iu },
  { label: "dove.theory Skill ID", pattern: /\bdove\.theory\b/u },
  { label: "theoryMode field", pattern: /\btheoryMode\b/u },
  { label: "theoryStage field", pattern: /\btheoryStage\b/u },
  { label: "predictionId field", pattern: /\bpredictionId\b/u },
  { label: "scaleTransferId field", pattern: /\bscaleTransferId\b/u }
]);

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

function assertCapabilityIncludes(command, expected) {
  const actual = new Set(actionCapabilities(command));
  for (const capability of expected) assert.ok(actual.has(capability), `${command.id} must expose capability ${capability}`);
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
  return structuredText([
    contract.purpose,
    contract.when,
    contract.semanticSections ?? [],
    contract.responsibilities,
    contract.actions,
    contract.boundaries,
    contract.nonGoals,
    contract.hostGuidance
  ]);
}

function assertExcludesPhrases(value, label, phrases) {
  const normalized = value.toLowerCase();
  for (const phrase of phrases) assert.ok(!normalized.includes(phrase.toLowerCase()), `${label} must not contain retired or unsafe phrase: ${phrase}`);
}

function assertNoUnsafeSameContext(value, label) {
  const normalized = value.toLowerCase()
    .split("do not substitute same-context review").join("")
    .split("do not impersonate independence in the same context").join("")
    .split("same context for later rounds").join("")
    .split("resume that same context").join("")
    .split("resume the same context").join("")
    .split("same reviewer context").join("")
    .split("reuse the same context for re-review").join("")
    .split("resume the same isolated reviewer context").join("")
    .split("return to the same context after later substantive changes").join("");
  assert.ok(!normalized.includes("same-context"), `${label} must not contain same-context pseudo-independence language outside explicit negative boundaries`);
  assert.ok(!normalized.includes("same context"), `${label} must not contain same context pseudo-independence language outside explicit negative boundaries`);
}

function assertMatchesAll(value, label, patterns) {
  for (const pattern of patterns) assert.match(value, pattern, `${label} semantic contract drifted: ${pattern}`);
}

function assertMatchesNone(value, label, patterns) {
  for (const pattern of patterns) assert.doesNotMatch(value, pattern, `${label} must not contain retired or unsafe language: ${pattern}`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function generatedSurfaceLabel(entry) {
  return entry.label ?? entry.relativePath ?? `${entry.hostId ?? "unknown-host"} ${entry.command?.id ?? "unknown-command"}`;
}

function assertGeneratedSurfaceUsesCurrentRenderer(entry) {
  const label = generatedSurfaceLabel(entry);
  assert.doesNotMatch(entry.content, /Capability contract/iu, `${label} must not render retired Capability contract title`);
  assert.doesNotMatch(entry.content, /Side-effect(?: and authorization)? boundary/iu, `${label} must not render retired Side-effect boundary title`);
  assert.doesNotMatch(entry.content, /Result boundar(?:y|ies)/iu, `${label} must not render retired Result boundary title`);
  assert.doesNotMatch(entry.content, /\(read-only\)/iu, `${label} must not render retired read-only action marker`);
  assert.doesNotMatch(entry.content, /\(work-capable(?:;[^)]*)?\)/iu, `${label} must not render retired work-capable action marker`);
  assert.doesNotMatch(entry.content, /\*\*internal-capability-id\*\*/iu, `${label} must not render **internal-capability-id** placeholder`);

  for (const capability of new Set(COMMAND_SURFACES.flatMap((command) => actionCapabilities(command)))) {
    assert.doesNotMatch(entry.content, new RegExp(`\\*\\*${escapeRegExp(capability)}\\*\\*`, "iu"), `${label} must not render internal capability id **${capability}**`);
  }
}

function assertRenderedActions(entry) {
  const label = generatedSurfaceLabel(entry);
  for (const item of contractActions(entry.command)) {
    assert.ok(entry.content.includes(item.instruction), `${label} must render ${entry.command.id} action instruction without exposing its internal capability id`);
  }
}

function assertGeneratedSurfaceLinkMaintenanceSemantics(entries) {
  const value = entries.map((entry) => entry.content).join("\n");
  assert.match(value, /ordinary Markdown links?/iu, "generated command surfaces must mention ordinary Markdown links");
  assert.match(value, /project-relative artifact paths?/iu, "generated command surfaces must mention project-relative artifact paths");
  assert.match(value, /when useful(?: for recovery)?|only when useful|useful for recovery/iu, "generated command surfaces must keep optional when-useful recovery semantics");

  const negativeContext = (value.match(/(?:do not|no|not)[^.\n]{0,260}(?:databases?|generated IDs?|frontmatter|backlink audits?|consistency matrices?)[^.\n]*/giu) ?? []).join("\n");
  for (const { label, pattern } of [
    { label: "database", pattern: /databases?\b/iu },
    { label: "generated IDs", pattern: /generated IDs?\b/iu },
    { label: "frontmatter", pattern: /frontmatter\b/iu },
    { label: "backlink audit", pattern: /backlink audits?\b/iu },
    { label: "consistency matrix", pattern: /consistency (?:matrices|matrix)\b/iu }
  ]) assert.match(negativeContext, pattern, `generated command surfaces must explicitly avoid ${label}`);
}

function patternIndex(value, pattern) {
  const match = pattern.exec(value);
  return match ? match.index : -1;
}

function assertPatternOrder(value, label, firstPattern, secondPattern) {
  const firstIndex = patternIndex(value, firstPattern);
  const secondIndex = patternIndex(value, secondPattern);
  assert.ok(firstIndex >= 0, `${label} must include ${firstPattern}`);
  assert.ok(secondIndex >= 0, `${label} must include ${secondPattern}`);
  assert.ok(firstIndex < secondIndex, `${label} must keep ${firstPattern} before ${secondPattern}`);
}

function assertNoUnsafeResearchSurfaceLanguage(entries) {
  for (const entry of entries) {
    for (const { label, pattern } of UNSAFE_RESEARCH_SURFACE_PATTERNS) {
      assert.doesNotMatch(entry.content, pattern, `${entry.label} must not contain unsafe research-surface language: ${label}`);
    }
  }
}

const AMBIGUOUS_ROUTE_TERM_PATTERNS = Object.freeze([
  { label: "approved route", pattern: /\bapproved route\b/iu },
  { label: "support route", pattern: /\bsupport route\b/iu },
  { label: "source path", pattern: /\bsource path\b/iu },
  { label: "business adapters", pattern: /\bbusiness adapters\b/iu },
  { label: "the other MCP", pattern: /\bthe other MCP\b/iu },
  { label: "unavailable or unapproved", pattern: /\bunavailable or unapproved\b/iu }
]);

function assertNoAmbiguousRouteTerms(entries) {
  for (const entry of entries) {
    for (const { label, pattern } of AMBIGUOUS_ROUTE_TERM_PATTERNS) {
      assert.doesNotMatch(entry.content, pattern, `${entry.label} must not contain ambiguous term: ${label}`);
    }
  }
}

function packageDocumentEntries() {
  return PACKAGE_DOCUMENTATION_PATHS.map((relativePath) => ({
    label: `public package doc ${relativePath}`,
    content: fs.readFileSync(path.join(ROOT, relativePath), "utf8")
  }));
}

function assertCanonicalTerminology() {
  assertNoAmbiguousRouteTerms([
    { label: "canonical rendered Dove agent instructions", content: renderDoveAgentInstructions() },
    { label: "canonical rendered Claude Dove agent", content: renderClaudeDoveAgent() },
    ...generatedDoveAgentEntries().map((entry) => ({ label: `generated Dove agent ${entry.relativePath}`, content: entry.content })),
    ...generatedAdapterEntries().map((entry) => ({ label: `generated ${entry.hostId} ${entry.command.id}`, content: entry.content })),
    ...generatedClaudeAmbientProjectEntries().map((entry) => ({ label: `ambient/support guidance ${entry.destinationPath}`, content: entry.content })),
    ...packageDocumentEntries()
  ]);
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
    if (field === "boundaries") {
      assert.ok(contract[field].length > 0, `${command.id} needs a concise top-level side-effect boundary`);
      continue;
    }
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
    const index = entry.content.indexOf(`### ${section.title}`);
    assert.ok(index > previousIndex, `${entry.command.id} generated adapter must render semantic section ${section.title} in contract order`);
    previousIndex = index;
  }
}

function sharedCapabilityReturnText(command) {
  const contract = skillContract(command);
  const firstSection = Array.isArray(contract.semanticSections) ? contract.semanticSections[0] : null;
  if (/Return to Dove's research judgment|Shared capability return/iu.test(firstSection?.title ?? "")) return semanticSectionText(firstSection);
  const responsibility = contract.responsibilities.find((item) => /capability results?.*same Dove judgment|same Dove judgment.*capability results?|Return.*same Dove judgment|Return with what was inspected/iu.test(String(item)));
  assert.ok(responsibility, `${command.id} needs a shared capability return responsibility`);
  return String(responsibility);
}

function assertSharedCapabilityReturnIsConcise(command) {
  const sharedReturn = sharedCapabilityReturnText(command);
  assert.match(sharedReturn, /Return with|same Dove judgment|Dove's research judgment/iu, `${command.id} shared capability return must send work back to Dove judgment`);
  assert.match(sharedReturn, /what was inspected|actually inspected|inspected or changed|changed/iu, `${command.id} shared capability return must preserve inspected-evidence semantics`);
  assert.match(sharedReturn, /what changed|material decision.*changed|what remains unresolved|unresolved/iu, `${command.id} shared capability return must preserve decision-change semantics`);
  assert.match(sharedReturn, /next useful action|next feasible action|confirmed task (?:boundary|scope)/iu, `${command.id} shared capability return must preserve continuation semantics`);
  assert.ok(sharedReturn.length <= 700, `${command.id} shared capability return must stay concise`);
}

function assertCapabilitySharedJudgment(command) {
  const label = command.id;
  const value = semanticContractText(command);
  assert.match(value, /mainline|Workspace|research|project|paper|artifact|source|experiment|figure|review|lesson|status/iu, `${label} must anchor work in an active research object or capability context`);
  assert.match(value, /inspected|read|retrieved|executed|changed|unresolved|evidence|decision|claim|route|progress|priority|what was inspected/iu, `${label} must preserve evidence/change judgment`);
  assert.match(value, /next action|next useful action|continue|priority|useful response|proceed|what happens next/iu, `${label} must preserve continuation judgment`);
}

function assertOrdinarySkillNoFullDoveReviewHandoff(command) {
  if (command.id === "dove.review") return;
  for (const [surface, value] of [
    ["contract", contractText(command)],
    ...PROJECT_HOST_IDS.map((hostId) => [`${hostId} generated adapter`, renderCommandAdapter(hostId, command)])
  ]) {
    const detailMatches = [
      /frozen near-submission handoff/iu,
      /exact project-relative frozen material list/iu,
      /host-provided.*(?:reviewer context|session|resume).*frozen material scope/isu,
      /provenance.*(?:review round|target venue|frozen material scope)/isu,
      /Do not expose code, raw experiment outputs, unprocessed figure materials, internal notes/iu
    ].filter((pattern) => pattern.test(value));
    assert.ok(detailMatches.length < 2, `${command.id} ${surface} must leave detailed dove-review handoff/provenance semantics to the Review capability`);
  }
}

function assertSharedResearchContractSemantics(value, label) {
  assertMatchesAll(value, label, [
    /real research question/iu,
    /user need/iu,
    /key uncertainty/iu,
    /current or provisional route|provisional research question or route/iu,
    /decision that matters/iu,
    /serious (?:mechanisms|candidate|alternatives|explanations|approaches)|candidate mechanisms/iu,
    /assumptions/iu,
    /applicability/iu,
    /predictions/iu,
    /failure conditions/iu,
    /claim-driven experiments?|diagnostics/iu,
    /strongest alternatives?|distinguish/iu,
    /anomalous results|unstable|irreproducible|surprising/iu,
    /inspected material|material actually read|retrieved|executed|inspected/iu,
    /conditions tested|tested or read conditions|tested conditions/iu,
    /claim strength|claim scope|strength the evidence supports/iu,
    /evidence or (?:the user|an explicit user decision)/iu,
    /Absorb|absorbing|absorbs/iu,
    /route|paper spine|claim scope|next action/iu
  ]);
}

function assertDoveAgentSurfaceSemantics(value, label) {
  assertMatchesAll(value, label, [
    /one complete (?:Dove )?research agent|same research collaboration/iu,
    /nine Skills.*(?:same research collaboration|current decision|optional specialist methods)|optional specialist capabilities/isu,
    /real research question/iu,
    /current or provisional route|provisional research question or route/iu,
    /user need/iu,
    /key uncertainty/iu,
    /decision that matters/iu,
    /literature|current theory|related work/iu,
    /adjacent (?:ideas|fields)|analogies/iu,
    /mathematics|mathematical|physical reasoning|physical analysis/iu,
    /assumptions/iu,
    /applicability/iu,
    /predictions/iu,
    /failure conditions/iu,
    /hunches.*hypotheses|first impressions.*hypotheses/isu,
    /negative results?.*near misses?.*(?:hypotheses|diagnostic|route|validity)|near misses?.*(?:hypotheses|diagnostic|route|validity)/isu,
    /inspected material|retrieved sources|executed work|rendered figures|checked artifacts/iu,
    /user-confirmed Workspace mainline/iu,
    /active confirmed research context.*feasible next in-scope step|short follow-ups.*perform the feasible next in-scope step/isu,
    /Maintain Dove research Markdown.*record, update, or save/iu,
    /preserving the work's evidence and continuation context is genuinely useful/iu,
    /author-side Review.*scientific self-check|author-side Review is Dove's own scientific self-check/isu,
    /independent `dove-review`.*real isolated persistent reviewer context|real isolated persistent reviewer context.*current frozen handoff/isu,
    /findings.*inform.*author-side judgment|findings.*evidence to absorb|not authority over the Workspace mainline/isu
  ]);
}

function assertCapabilityPatterns(command, groups) {
  const value = semanticContractText(command);
  for (const group of groups) {
    assert.ok(group.patterns.some((pattern) => pattern.test(value)), `${command.id} must preserve ${group.label}`);
  }
}

function assertResearchCapabilitySemantics(command) {
  const value = contractText(command);
  const researchProgression = contractAction(command, "research-progression")?.instruction ?? "";
  assertCapabilityIncludes(command, [
    "research-document-reading",
    "lesson-reading",
    "project-exploration",
    "research-progression",
    "research-document-maintenance"
  ]);
  assert.ok(contractAction(command, "project-exploration"));
  assertCapabilityPatterns(command, [
    { label: "default progression for confirmed goals", patterns: [/continues?.*substantive rounds.*default|default.*substantive rounds|default.*progression|research loop/isu] },
    { label: "conditional high-value clarification", patterns: [/framing.*open|question or route.*open|clarification.*change the next action|result that would change the next action/isu] },
    { label: "problem formation details", patterns: [/real phenomenon|assumptions|intended claim|evaluation target|real research question/iu] },
    { label: "confirmed or provisional mainline anchoring", patterns: [/confirmed.*mainline|provisional.*(?:question|route)|confirmed or provisional mainline/isu] },
    { label: "inventive search", patterns: [/inventive lenses|literature|adjacent|contradictions|negative or near-miss results|serious routes/isu] },
    { label: "discriminating evidence work", patterns: [/small diagnostics|diagnostic experiments?|source checks|experiments|artifact inspections|distinguish routes|change the judgment/isu] },
    { label: "result absorption before continuation", patterns: [/absorb.*result|absorbing each material result|absorb each result|what it changes/isu] }
  ]);
  assert.match(researchProgression, /confirmed or provisional mainline|Follow the confirmed or provisional mainline/iu);
  assert.match(researchProgression, /change the judgment|absorb the result|continue while it matters/isu);
  assert.match(value, /no separate Auto|Do not expose Auto|default.*substantive rounds/isu);
}

function assertSourceCapabilitySemantics(command) {
  const sourceWork = contractAction(command, "source-research");
  const value = semanticContractText(command);
  assert.ok(sourceWork && !sourceWork.readOnly, "Source retrieval must be work-capable when useful");
  assertCapabilityPatterns(command, [
    { label: "external theory and related-work acquisition", patterns: [/external theory|related work|route changes that depend on external theory/isu] },
    { label: "source identity and claim-support checking", patterns: [/citation identity.*claim support|identity.*metadata.*supports?|verify identity.*metadata.*supports?/isu] },
    { label: "identity and support as separate judgments", patterns: [/Separate citation identity from claim support|identity.*then whether inspected content supports/isu] },
    { label: "unavailable material stays explicit", patterns: [/unavailable.*missing|needed material is unavailable|If needed material is unavailable/isu] },
    { label: "inspected-material provenance", patterns: [/found.*retrieved.*inspected.*used|retrieved, inspected, and used|what was inspected/isu] },
    { label: "literature as research opportunity", patterns: [/consensus|contradictions|transferable mechanisms|research opportunities/iu] },
    { label: "conditional systematic-review trigger", patterns: [/explicit systematic review|meta-analysis|evidence grading|auditable/isu] },
    { label: "structured systematic-review method", patterns: [/PICOS|structured question|search scope|eligibility criteria/iu] },
    { label: "PRISMA tracking", patterns: [/PRISMA-style tracking|retrieval|deduplication|screening|full-text/iu] },
    { label: "risk of bias and evidence certainty", patterns: [/risk-of-bias|evidence-certainty|GRADE-style/iu] },
    { label: "meta-analysis only for comparable studies", patterns: [/pool effects|effect pooling|studies and data are comparable|comparable studies and data/iu] },
    { label: "ordinary source work stays proportional", patterns: [/Ordinary paper finding.*related-work scans.*single fact checks stay proportional|single fact checks stay proportional/isu] },
    { label: "host-tool availability boundary", patterns: [/current host.*exposes.*permissions permit|permitted host tools|needed material is unavailable|material class is missing/isu] }
  ]);
  assertMatchesAll(value, "dove.source systematic-review semantics", [
    /explicit systematic review|meta-analysis|evidence grading|auditable/isu,
    /structured question|search scope|eligibility criteria/iu,
    /PRISMA-style|PRISMA/iu,
    /risk-of-bias|risk of bias/iu,
    /evidence-certainty|evidence certainty|GRADE-style/iu,
    /pool effects|effect pooling/iu,
    /comparable studies and data|studies and data are comparable/iu
  ]);
  assert.match(sourceWork.instruction, /discover|retrieve|read|verify/iu);
  assert.match(sourceWork.instruction, /identity.*metadata.*whether inspected content supports|citation checks.*separate/isu);
  assert.match(sourceWork.instruction, /Ordinary paper finding.*single fact checks stay proportional|single fact checks stay proportional/isu);
  assert.doesNotMatch(value, /one source path|unavailable or unapproved|approved route|support route|source path|the other MCP/iu);
}

function assertExperimentCapabilitySemantics(command) {
  const designInstruction = contractAction(command, "experiment-design")?.instruction ?? "";
  const executionInstruction = contractAction(command, "experiment-execution")?.instruction ?? "";
  const interpretationInstruction = contractAction(command, "experiment-interpretation")?.instruction ?? "";
  assertCapabilityIncludes(command, [
    "research-document-reading",
    "lesson-reading",
    "experiment-design",
    "experiment-execution",
    "research-document-maintenance"
  ]);
  assertCapabilityPatterns(command, [
    { label: "distinct experiment request modes", patterns: [/design-only|execution|analysis of existing results|retrospective/iu] },
    { label: "central experiment basis", patterns: [/real problem.*key uncertainty.*route decision|problem.*key uncertainty.*strongest alternative/isu] },
    { label: "diagnostic path when basis is missing", patterns: [/actual project material.*relevant sources.*smallest low-risk diagnostic|central basis is missing.*inspect actual project material/isu] },
    { label: "claim-driven discrimination", patterns: [/natural-language named prediction|primary prediction|minimum sufficient evidence|positive, negative, or ambiguous outcomes/iu] },
    { label: "execution validity before scientific evidence", patterns: [/anomalous.*before using them as evidence|unstable.*scientific evidence|check anomalous results before using them as evidence/isu] },
    { label: "execution-validity coverage", patterns: [/implementation.*data.*configuration.*environment.*randomness.*metrics.*analysis|implementation.*data shortcuts.*configuration drift.*baselines.*randomness.*metrics.*analysis|implementation.*data.*configuration.*baselines.*randomness.*metrics.*analysis|configuration.*data.*metrics.*actual code.*logs.*outputs/isu] },
    { label: "results grounded in actual run materials", patterns: [/methods.*configuration.*data.*metrics.*run counts.*result numbers.*actual code.*logs.*outputs|actual code.*logs.*outputs.*data files.*user material|run receipts/isu] },
    { label: "Dove run receipt judgment boundary", patterns: [/dove run start\|status\|resume\|finalize\|compare|\.dove\/runs\/<id>|run receipts.*Experiment Markdown/isu] },
    { label: "observation interpretation separation", patterns: [/what was observed.*what it means.*why it matters.*what happens next|separate what was observed/isu] },
    { label: "scoped evidence", patterns: [/data.*scale.*settings.*implementation|conditions actually tested|evidence scope/isu] }
  ]);
  assert.match(designInstruction, /real problem|key uncertainty|route decision|primary prediction|strongest alternative|minimum sufficient evidence/iu);
  assert.match(executionInstruction, /Execute only when requested and permitted|when requested and permitted/iu);
  assert.match(`${executionInstruction}\n${interpretationInstruction}`, /actual code|logs|outputs|data files|configuration|metrics/iu);
  assert.match(`${executionInstruction}\n${interpretationInstruction}`, /anomalous|unstable|hard-to-reproduce|scientific evidence|expected and actual/iu);
}

function assertDraftCapabilitySemantics(command) {
  const artifactEditing = contractAction(command, "artifact-editing")?.instruction ?? "";
  const artifactValidation = contractAction(command, "artifact-validation");
  assert.equal(artifactValidation?.readOnly, false, "Draft artifact validation may fix issues, so it must stay work-capable");
  assertCapabilityPatterns(command, [
    { label: "evidence-grounded drafting", patterns: [/evidence needed for its material claims|available evidence|relevant material/iu] },
    { label: "facts not filled from memory", patterns: [/leave unchecked.*unknown|missing.*unknown|actual project or source material/isu] },
    { label: "claim standing preservation", patterns: [/certainty.*causality.*scope.*generality.*quantitative qualifiers.*novelty/isu] },
    { label: "claim changes explained before editing", patterns: [/say what changed.*before changing|state what changed.*why/isu] },
    { label: "author style from real samples", patterns: [/reliable author samples|author samples|confirmed Workspace author text/iu] },
    { label: "author style features", patterns: [/rhythm.*paragraph.*hedging.*transitions.*reporting verbs.*citation integration/isu] },
    { label: "style subordinated to scientific accuracy", patterns: [/accuracy.*venue norms|scientific accuracy.*venue/isu] },
    { label: "paper-spine repair", patterns: [/paper spine.*problem.*gap.*insight|paper spine.*mechanism.*method.*evidence.*claim/isu] },
    { label: "authoritative artifact propagation", patterns: [/authoritative source.*build or export path|propagate through the real build/isu] },
    { label: "higher-value action before claim narrowing", patterns: [/method.*source.*experiment.*figure|before merely weakening prose|before narrowing/isu] }
  ]);
  assert.match(artifactEditing, /target.*relevant material|relevant material.*draft|assess|revise/isu);
  assert.match(artifactEditing, /authoritative source.*build or export path|real build or export path/isu);
}

function assertFigureCapabilitySemantics(command) {
  assertCapabilityIncludes(command, [
    "research-document-reading",
    "lesson-reading",
    "figure-planning",
    "figure-creation",
    "figure-inspection",
    "figure-revision",
    "figure-delivery",
    "research-document-maintenance"
  ]);

  for (const capability of ["research-document-reading", "lesson-reading", "figure-planning", "figure-inspection"]) {
    assert.equal(contractAction(command, capability)?.readOnly, true, `${command.id} ${capability} must stay read-only`);
  }
  for (const capability of ["figure-creation", "figure-revision", "figure-delivery", "research-document-maintenance"]) {
    assert.equal(contractAction(command, capability)?.readOnly, false, `${command.id} ${capability} must stay work-capable`);
  }

  assertCapabilityPatterns(command, [
    { label: "brief-driven visual planning", patterns: [/figure brief|visual plan|target claim|evidence or mechanism job|manuscript (?:placement|location)/isu] },
    { label: "route choice across plot, editable diagram, image tools, and mixed media", patterns: [/real data.*reproducible code|editable.*(?:SVG|vector|source)|host image.*(?:generation|editing)|mixed raster.*(?:SVG|vector)/isu] },
    { label: "actual rendered inspection", patterns: [/open|view|actual rendered|realistic final (?:dimensions|size)|manuscript context/isu] },
    { label: "targeted revision of figure and manuscript context", patterns: [/targeted changes|editable source|plotting code|caption|nearby (?:text|manuscript text)|export settings/isu] },
    { label: "editable final delivery", patterns: [/final figure|route-native editable source|later modification|plotting code|SVG|vector|layered|mixed raster/isu] },
    { label: "no invented scientific material", patterns: [/must not invent|do not invent/iu] }
  ]);
}

function assertReviewCapabilitySemantics(command) {
  const sections = assertSemanticSections(command, { min: 5 });
  assertSemanticSectionOrder(command, [
    { label: "shared Dove judgment return", matchers: [/Return.*Dove.*research judgment|same Dove judgment|what was inspected.*what changed/isu] },
    { label: "author-side scientific self-check", matchers: [/author-side.*scientific self-check|scientific self-check.*author-side/isu] },
    { label: "conditional delivery review", matchers: [/delivery review|delivery readiness/iu] },
    { label: "isolated dove-review judgment", matchers: [/dove-review/iu, /isolated|persistent|recoverable/iu, /frozen|near-submission|handoff/iu] },
    { label: "returned review or existing context", matchers: [/returned review|user-pasted review|existing Review context|context inspection/iu] }
  ]);

  const reviewGrounding = contractAction(command, "review-grounding");
  const reviewerWork = contractAction(command, "reviewer-perspective-work");
  const deliveryReview = contractAction(command, "delivery-review");
  const reviewHandoff = contractAction(command, "dove-review-handoff");
  const reviewImport = contractAction(command, "research-document-maintenance");
  const reviewContextInspection = contractAction(command, "research-document-reading");
  assertCapabilityIncludes(command, [
    "research-document-reading",
    "review-grounding",
    "reviewer-perspective-work",
    "delivery-review",
    "dove-review-handoff",
    "research-document-maintenance"
  ]);
  assert.equal(reviewGrounding?.readOnly, true, "Review grounding must remain read-only");
  assert.equal(reviewerWork?.readOnly, true, "Author-side Review self-check must remain read-only");
  assert.equal(deliveryReview?.readOnly, true, "Delivery Review must remain read-only");
  assert.equal(reviewContextInspection?.readOnly, true, "Review context inspection must remain read-only");
  assert.equal(reviewImport?.readOnly, false, "Review import must remain narrowly work-capable");
  assert.equal(reviewHandoff?.readOnly, false, "Review handoff must remain narrowly work-capable");

  for (const mode of [
    { label: "Author-side scientific self-check", matchers: [/scientific|critique|findings/iu, /self-check|author-side|author context/iu] },
    { label: "Conditional Delivery Review", matchers: [/delivery|venue|format|packag|required material|submission/iu] },
    { label: "dove-review external handoff", matchers: [/dove-review/iu, /handoff|frozen|near-submission/iu, /isolated|persistent|recoverable|reviewer context/iu] },
    { label: "Returned Review Import", matchers: [/returned[- ]review|reviewer return|actual reviewer return|user-pasted review/iu, /import|preserve|faithfully/iu] },
    { label: "Context Inspection", matchers: [/context inspection|inspect(?: existing)? review context|existing Review context/iu] }
  ]) assertSemanticModeAvailable(command, sections, mode);

  const value = semanticContractText(command);
  assertMatchesAll(value, "dove.review", [
    /official venue sources|related work|scholarly context|published work/isu,
    /scientific acceptability.*delivery readiness|delivery readiness.*scientific acceptability/isu,
    /isolated.*persistent.*recoverable|isolated.*recoverable.*persistent|persistent.*recoverable.*reviewer context/isu,
    /frozen.*near-submission|frozen.*handoff|frozen.*materials/iu,
    /whole.*current.*(?:paper|version|submission)|same full version|complete manuscript/isu,
    /findings?.*evidence|Review findings.*evidence|evidence.*findings/isu,
    /without claiming independent external review|counting it as independent review|external acceptance|scientific certification|Workspace authority/isu,
    /faithfully|actual reviewer return|returned review/iu,
    /method.*answer|method-answer|method ability/iu,
    /contribution|novelty|claims|evidence|method|limitations|writing clarity/isu,
    /citation identity.*claim support|claim support.*citation identity/isu,
    /anomalous results|execution scrutiny/iu,
    /local paragraph|single figure|single-method review|requested scope/isu
  ]);
  assertMatchesAll(reviewHandoff?.instruction ?? "", "dove.review handoff", [
    /near-submission|highly complete/iu,
    /genuinely isolated|isolated.*reviewer context|reviewer context.*isolated/isu,
    /real runtime|runtime paths|actual session id|recorded reviewer session/isu,
    /resume or rerun.*whole-paper rounds.*same review id|same review id.*recorded reviewer session/isu,
    /complete frozen material list|whole-paper|complete paper/isu,
    /only those listed materials/iu,
    /runtime is unavailable|host.*(?:provide|provides).*isolated/isu,
    /continue feasible author-side work without counting it as independent review/isu
  ]);
  assertMatchesAll(reviewImport?.instruction ?? "", "dove.review import", [
    /append.*faithfully|faithfully.*append|Preserve.*faithfully/isu,
    /actual text|actual `dove-review` return|user-pasted review/isu,
    /same review id and round when known|round.*when known/isu,
    /real `\.dove\/reviews\/<id>\/rounds\/<round>\/report\.md` return|report\.md/isu,
    /do not revise author artifacts|without revising author artifacts/iu
  ]);
  assertMatchesNone(value, "dove.review", [
    /ReviewExchange|reviewId|findingId|verdictEnum|strictImportSchema|fixed paper pipeline|helper reviewer Agents?/iu,
    /submission-readiness gate|Review gate|Auto-gate|actual Skill call|return `PASS`|return `REVISE`/iu,
    /same-context independent|pseudo-independent|local separation proves independence|host label proves independence/iu,
    /claim acceptance[^.]*as proof|reviewer controls Dove/iu
  ]);
}

function assertRebuttalCapabilitySemantics(command) {
  const rebuttalAction = contractAction(command, "rebuttal-and-revision")?.instruction ?? "";
  const artifactValidation = contractAction(command, "artifact-validation");
  assert.equal(artifactValidation?.readOnly, false, "Rebuttal artifact validation may fix issues, so it must stay work-capable");
  assertCapabilityPatterns(command, [
    { label: "author-side review response", patterns: [/author-side Dove work|current-Dove author-side work|author-side response|rebuttal/iu] },
    { label: "finding-to-deficiency analysis", patterns: [/scientific deficiency|needed evidence|research action|source, experiment, method, analysis, expression, figure, or venue-fit problem/isu] },
    { label: "claim-standing comparison", patterns: [/original claim.*reviewer interpretation.*planned response.*revised claim|compare.*claim.*reviewer interpretation/isu] },
    { label: "no silent strengthening or weakening", patterns: [/does not silently strengthen or weaken|neither strengthening nor weakening happens silently|silently|Preserve certainty/isu] },
    { label: "claim-standing dimensions", patterns: [/certainty.*causality.*scope.*quantitative qualifiers.*novelty|claim strength/isu] },
    { label: "Source support for new citations", patterns: [/Use Source for new citations|new citations.*Source|Source.*new citations/isu] },
    { label: "Experiment support for new results", patterns: [/Use Experiment for new results|new results.*Experiment|Experiment.*new results/isu] },
    { label: "facts not filled from memory", patterns: [/unchecked source content.*project facts.*methods.*results.*field facts|leave unchecked.*unconfirmed|filling them from memory/isu] },
    { label: "author voice", patterns: [/reliable author text samples|author's professional voice|professional author voice/iu] },
    { label: "evidence-backed revision", patterns: [/requested ordinary project revisions|supplements|highlights|venue-facing files|real revisions are in scope/iu] },
    { label: "higher-value action before weakening", patterns: [/fixable deficiencies.*improve evidence|improve evidence.*analysis.*manuscript text|feasible in-mainline|higher-level action|before narrowing|weakening the claim|support the intended contribution/isu] }
  ]);
  assert.match(rebuttalAction, /material finding|review/i);
  assert.match(rebuttalAction, /same review id and round when available|same review id|round when available/isu);
  assert.match(rebuttalAction, /fresh `dove review rerun`|ordinary author-side revisions do not trigger a full re-review/isu);
  assert.match(rebuttalAction, /preserving accurate claim strength|claim strength|resolve, reduce, or honestly bound/isu);
  assert.doesNotMatch(contractText(command), /claim acceptance[^.]*as proof|reviewer controls Dove/iu);
}

function assertDoveAgentPersona() {
  assert.equal(DOVE_AGENT_NAME, "dove");
  assert.equal(DOVE_AGENT_DEFINITION.id, "dove");
  assert.equal(DOVE_AGENT_DEFINITION.publicName, "Dove");
  assert.equal(DOVE_AGENT_DEFINITION.title, "dove");
  assert.match(DOVE_AGENT_DEFINITION.description, /one complete Dove research agent.*real research decisions|real research decisions.*one complete Dove research agent/iu);
  assert.match(DOVE_AGENT_DEFINITION.responsibility, /real research decisions/iu);
  assert.match(DOVE_AGENT_DEFINITION.responsibility, /one complete Dove research agent|one complete research agent/iu);
  assert.deepEqual(DOVE_AGENT_SURFACES, {
    claude: ".claude/agents/dove.md"
  });
  assert.deepEqual(PACKAGE_GENERATED_SUPPORT_PATHS.filter((pathName) => pathName.includes("/agents/dove.md")), [
    "package-resources/hosts/claude/.claude/agents/dove.md"
  ]);
  assert.equal(PACKAGE_GENERATED_SUPPORT_PATHS.includes(`package-resources/hosts/claude/${EXA_WEB_SUPPORT_SKILL_PATH}`), true);

  const persona = DOVE_AGENT_PERSONA_BULLETS.join("\n");
  assert.ok(persona.includes(DOVE_AGENT_FRAME));
  assert.ok(persona.includes(DOVE_AGENT_CURIOSITY));
  assert.ok(persona.includes(DOVE_AGENT_STOPPING));
  assert.match(DOVE_AGENT_STOPPING, /bounded requests?|pure judgment/iu);
  assert.match(DOVE_AGENT_STOPPING, /confirmed mainline goal|continue while an effective in-scope action remains/iu);
  assert.match(DOVE_AGENT_STOPPING, /pause for the user|materially change the work/iu);
  assert.ok(DOVE_AGENT_PERSONA_BULLETS.length >= 5, "Dove persona must remain substantive without becoming a workflow checklist");
  assert.match(DOVE_AGENT_DIRECT_JUDGMENT, /weigh current evidence, task risk, user preference, and the research mainline/iu);
  assert.match(DOVE_AGENT_DIRECT_JUDGMENT, /useful next move.*stop before unrequested execution or recording/iu);

  for (const textValue of [renderDoveAgentInstructions(), renderClaudeDoveAgent()]) {
    assertDoveAgentSurfaceSemantics(textValue, "Dove agent surface");
    assert.doesNotMatch(textValue, /PICOS|PRISMA|risk-of-bias|GRADE|meta-analysis/iu, "Dove agent surface must leave systematic-review details to Source");
    assert.doesNotMatch(textValue, /exact project-relative frozen material list|review round.*target venue.*frozen material scope|whole current version.*not only a diff/isu, "Dove agent surface must leave detailed review handoff and provenance to the Review Skill");
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
    assertSharedCapabilityReturnIsConcise(command);
    assertCapabilitySharedJudgment(command);
    assertOrdinarySkillNoFullDoveReviewHandoff(command);
    assert.ok(contract.responsibilities.length > 0, `${label} needs Dove responsibilities`);
    assert.ok(contract.actions.length > 0, `${label} needs possible actions`);
    assert.ok(contract.boundaries.length > 0, `${label} needs side-effect boundaries`);
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
      assert.ok(["never", "standard-research"].includes(item.persistencePolicy), `${label} has an unknown persistence policy`);
      if (item.readOnly) {
        assert.equal(item.persistWhen, "never", `${label} read-only actions cannot maintain research Markdown`);
        assert.equal(item.persistencePolicy, "never", `${label} read-only actions cannot classify persistence`);
      }
      if (item.persistWhen !== "never") assert.equal(item.capability, "research-document-maintenance", `${label} persistence is only for optional research Markdown maintenance`);
      if (item.persistencePolicy === "never") assert.equal(item.persistWhen, "never", `${label} must not hide an unrendered persistence trigger`);
      if (item.persistencePolicy !== "never") assert.notEqual(item.persistWhen, "never", `${label} needs a persistence trigger`);
      if (label === "dove.lessons" && item.capability === "research-document-maintenance") assert.equal(item.persistencePolicy, "standard-research", "Lessons maintenance must follow the broad reusable-value standard");
      if (item.capability === "lesson-reading") {
        assert.match(item.instruction, /Read "\.dove\/research\/RESEARCH\.md" first only when project context is still needed and it has not already been read in the active context/iu, `${label} lesson reading must not reread the project overview`);
        assert.match(item.instruction, /Reuse Lessons already read in the active context instead of rereading them mechanically/iu, `${label} lesson reading must reuse active-context Lessons`);
      }

      assert.equal(item.tool, undefined, `${label} must not impersonate an MCP call`);
    }
  }

  const serialized = text(COMMAND_SURFACES);
  assert.match(serialized, /\.dove\/research\/RESEARCH\.md/u, "Skills must share the human-maintained overview entry");
  assertExcludesPhrases(serialized, "Dove Skills", RETIRED_RESEARCH_MODEL_PHRASES);
  assertNoUnsafeResearchSurfaceLanguage([
    { label: "Dove contract text", content: serialized },
    { label: "Dove Skill IDs", content: COMMAND_SURFACES.map((command) => command.id).join("\n") },
    { label: "Dove rendered agent instructions", content: renderDoveAgentInstructions() },
    { label: "Dove generated Claude agent", content: renderClaudeDoveAgent() },
    ...generatedAdapterEntries().map((entry) => ({ label: `generated ${entry.hostId} ${entry.command.id}`, content: entry.content }))
  ]);
  assertNoUnsafeSameContext(serialized, "Dove Skills");
  assert.doesNotMatch(serialized, /workflow"|"modes"|"steps"|Internal workflow|research-synthesis/iu, "Skills must not retain the retired sequential workflow rendering model");
  assert.doesNotMatch(serialized, /query_dove|manage_dove|MCP tool|semantic ID|Workspace record|Mission ID/iu, "Skills must not retain the research database contract");
  assert.doesNotMatch(serialized, /SQLite|vector database|hidden state service|hidden runtime/iu, "Skills must not prescribe a replacement database or hidden runtime");
  assert.doesNotMatch(serialized, /Review gate|Auto-gate|contribution score|return `PASS`|return `REVISE`|verdictEnum|strictImportSchema|same-context independent|same context independent/iu, "Skills must not recreate review gates, scoring states, schemas, enums, or same-context pseudo-independence");
  assert.doesNotMatch(serialized, /fixed closing synthesis|numbered steps/iu, "Skills must not preserve retired fixed-synthesis or numbered-step language");

  const research = COMMAND_SURFACE_BY_ID["dove.research"];
  assertResearchCapabilitySemantics(research);

  const source = COMMAND_SURFACE_BY_ID["dove.source"];
  assertSourceCapabilitySemantics(source);

  const status = COMMAND_SURFACE_BY_ID["dove.status"];
  assert.ok(contractActions(status).every((item) => item.readOnly), "Status must remain read-only");
  assert.match(contractText(status), /overview|summary|link/iu);
  assert.match(contractText(status), /absent|missing|ordinary document facts|say so naturally/iu);
  assert.match(contractText(status), /only inspect and report|without writes|do not modify files/iu);

  const experiment = COMMAND_SURFACE_BY_ID["dove.experiment"];
  assert.match(experiment.summary, /advance(?:s)? a research decision/iu);
  assert.match(experiment.contract.when, /contribution or evidence deficiency/iu);
  assertExperimentCapabilitySemantics(experiment);
  assert.doesNotMatch(contractText(experiment), /denominator accounting|supports and cannot establish|actual provenance/iu);

  const draft = COMMAND_SURFACE_BY_ID["dove.draft"];
  assert.match(draft.contract.when, /expression, argument, or an authoritative delivery artifact is the limiting deficiency/iu);
  assertDraftCapabilitySemantics(draft);

  const figure = COMMAND_SURFACE_BY_ID["dove.figure"];
  assert.match(figure.contract.when, /figure brief|visual revision|figure.*material evidence|communication bottleneck/iu);
  assertFigureCapabilitySemantics(figure);
  assert.doesNotMatch(contractText(figure), /image counts?[^.]*quality|embedding[^.]*proves?|always use[^.]*generation model|figure schema|figure CLI|renderer/iu);

  const review = COMMAND_SURFACE_BY_ID["dove.review"];
  assertReviewCapabilitySemantics(review);

  const rebuttal = COMMAND_SURFACE_BY_ID["dove.rebuttal"];
  assertRebuttalCapabilitySemantics(rebuttal);

  const lessons = COMMAND_SURFACE_BY_ID["dove.lessons"];
  const lessonsText = contractText(lessons);
  assert.match(lessonsText, /researcher-owned Lessons/iu);
  assert.match(lessonsText, /Lessons materials are optional researcher-owned advisory documents, not package-owned defaults/iu);
  assert.doesNotMatch(lessonsText, /package-managed built-in Lessons themes|maintain supported reusable guidance in the relevant theme under `lessons\/`/iu);
  const lessonsReading = contractAction(lessons, "research-document-reading");
  const lessonsMaintenance = contractAction(lessons, "research-document-maintenance");
  assert.equal(lessonsReading.readOnly, true);
  assert.match(lessonsReading.instruction, /inspire current or subsequent work|improve judgment|expand the candidate space|prevent repeated mistakes/iu);
  assert.match(lessonsReading.instruction, /directly relevant or plausibly useful/iu);
  assert.match(lessonsReading.instruction, /RESEARCH\.md.*project context.*active context|project context.*RESEARCH\.md.*active context/isu);
  assert.match(lessonsReading.instruction, /Reuse Lessons.*active context.*rereading|already read.*active context.*rereading/isu);
  assert.equal(lessonsMaintenance.persistencePolicy, "standard-research");
  assert.match(lessonsMaintenance.persistWhen, /inspire current or subsequent work|improve judgment|expand the candidate space|prevent repeated mistakes/iu);
  assert.match(lessonsMaintenance.instruction, /reusable insight|relevant conditions|future value/iu);
  assert.match(lessonsMaintenance.instruction, /routine progress|transient status|no plausible future value/iu);
}

function assertHostPolicy() {
  assert.deepEqual(HOST_ADAPTER_POLICY.toolAccess, {
    transport: "host-files",
    unavailable: "report",
    cliFallback: false,
    shellFallback: false
  });
  assert.deepEqual(HOST_ADAPTER_POLICY.privacy, { exposePrivateProtocol: false });
  assert.equal("adapterBullets" in HOST_ADAPTER_POLICY, false, "Skill adapters should rely on their capability contract rather than repeat the full Dove agent capsule");

  assert.deepEqual(USER_RESPONSE_POLICY, ["Follow the user's requested language and format."]);
}

function assertGeneratedAdapters() {
  const entries = generatedAdapterEntries();
  const agentEntries = generatedDoveAgentEntries();
  assert.equal(entries.length, COMMAND_SURFACES.length * PROJECT_HOST_IDS.length);
  assertGeneratedSurfaceLinkMaintenanceSemantics(entries);
  assertUnique(entries.map((entry) => entry.relativePath), "Generated adapter paths");
  assertUnique(agentEntries.map((entry) => entry.relativePath), "Generated Dove agent paths");
  assert.deepEqual(agentEntries.map((entry) => entry.relativePath), [".claude/agents/dove.md"]);

  for (const entry of agentEntries) {
    assertGeneratedSurfaceUsesCurrentRenderer(entry);
    assert.match(entry.content, /# Dove Agent/u);
    assertDoveAgentSurfaceSemantics(entry.content, "Generated Dove agent");
    assert.doesNotMatch(entry.content, /PICOS|PRISMA|risk-of-bias|GRADE|meta-analysis/iu, "Generated Dove agent must leave systematic-review details to Source");
    assert.doesNotMatch(entry.relativePath, /dove-(?:planner|builder|reviewer|reader|referee)|dove-(?:reviewer|reader|referee)/u);
    assert.doesNotMatch(entry.content, /three primary roles|Planner.*Builder\/Author.*Reviewer|user-switchable.*(?:reader|referee)/isu);
  }

  for (const entry of entries) {
    const contract = skillContract(entry.command);
    assert.equal(entry.destinationPath, adapterPathForCommand(entry.hostId, entry.command));
    assert.match(entry.relativePath, /^package-resources\/hosts\/(?:claude|dsh)\//u);
    assert.equal(entry.content, renderCommandAdapter(entry.hostId, entry.command));
    assert.match(entry.content, /^---\n/um);
    assert.match(entry.content, /## How Dove approaches this work\n\n/iu);
    assert.match(entry.content, /### What this is for\n\n/u);
    assert.match(entry.content, /### When it helps\n\n/u);
    assert.match(entry.content, /### Scope and changes\n\n/u);
    assert.match(entry.content, /### Using host tools\n\n/u);
    assertGeneratedSurfaceUsesCurrentRenderer(entry);
    assertRenderedActions(entry);

    if (Array.isArray(contract.semanticSections) && contract.semanticSections.length > 0) {
      assertRenderedSemanticSectionOrder(entry);
      assert.doesNotMatch(entry.content, /^#### /mu, "semantic command adapters should not reintroduce nested renderer labels");
    } else {
      if (contract.responsibilities.length > 0) assert.match(entry.content, /### What Dove will examine\n\n/u);
      if (contract.actions.length > 0) assert.match(entry.content, /### Ways Dove may proceed\n\n/u);
      if (contract.nonGoals.length > 0) assert.match(entry.content, /### What this should not replace\n\n/u);
    }
    if (contract.clarification.length > 0) assert.match(entry.content, /### When Dove needs input\n\n/u);

    assert.doesNotMatch(entry.content, /## Dove capsule/u, "Skill adapters must not duplicate the full Dove agent capsule");
    assert.doesNotMatch(entry.content, /## Internal workflow|Internal guidance only|^\s*\d+\./mu);
    assert.doesNotMatch(entry.content, /Dove MCP tools|Call `(?:query|manage)_dove|semantic ID/iu);
    assert.doesNotMatch(entry.content, /No file write is required|Persist only when:/u);
    assert.doesNotMatch(entry.content, /work-capable; not standalone authorization|Read-only: do not create or modify files\.|Other file changes still require authorization|File changes require authorization/iu, "generated actions must not carry repeated authorization tails");

    if (actionCapabilities(entry.command).includes("research-document-maintenance")) {
      if (entry.command.id === "dove.lessons") {
        assert.match(entry.content, /inspire current or subsequent work|improve judgment|expand the candidate space|prevent repeated mistakes/iu);
        assert.match(entry.content, /reusable insight|future value|routine progress/iu);
        assert.doesNotMatch(entry.content, /maintenance is explicit-only|only when the user explicitly asks/iu);
      } else if (entry.command.id === "dove.review") {
        assert.match(entry.content, /`dove-review` return|user-pasted review opinion|preserve self-check or handoff context|returned review/isu);
      } else {
        assert.match(entry.content, /user explicitly asks to record, update, or save Dove research context/iu);
        assert.match(entry.content, /research mainline, conclusion, decision, or priority/iu);
        assert.match(entry.content, /preserving the work's evidence and continuation context is genuinely useful/iu);
      }
    }
    if (entry.command.id === "dove.status") assert.match(entry.content, /without writes|only inspect and report|do not create, modify, repair, validate, or normalize files/iu);
    if (entry.command.id === "dove.lessons") {
      assert.match(entry.content, /RESEARCH\.md.*project context.*active context|project context.*RESEARCH\.md.*active context/isu);
      assert.match(entry.content, /Reuse Lessons.*active context.*rereading|already read.*active context.*rereading/isu);
    }
    if (entry.command.id === "dove.review") assert.match(entry.content, /delivery readiness.*scientific acceptability|scientific acceptability.*delivery readiness/isu);
    assert.doesNotMatch(entry.content, /## Response policy/u);
    if (entry.hostId === "dsh") assert.doesNotMatch(entry.content, /\/dove:/u, "DSH filesystem Skills must not advertise Claude slash commands");
  }
}

function assertAmbientRouting() {
  for (const prompt of [
    "继续",
    "现在怎么办",
    "那接下来呢",
    "what now",
    "fix this bug",
    "review this code",
    "帮我整理这个 Markdown",
    "research travel options",
    "research laptop prices",
    "I am researching laptop options",
    "researcher job application",
    "帮我研究一下电脑怎么选",
    "研究一下购物选项",
    "帮我写研究生申请邮件",
    "Dove 菜单输出有错",
    "update the Dove CLI help",
    "/dove:research"
  ]) assert.equal(isResearchRelatedWakeupPrompt(prompt), false, `${prompt} must not wake Dove from the research-relevance gate`);
  for (const prompt of [
    "research problem: retrieval-augmented generation under domain shift",
    "research project on retrieval-augmented generation",
    "find papers about retrieval-augmented generation",
    "分析这个实验结果",
    "记录这个实验结果到 Dove",
    "更新研究记录",
    "设计一个实验验证这个假设",
    "prepare a review handoff for this manuscript",
    "do you think we should run an experiment",
    "do you think we should run an experiment, and if useful run it",
    "判断是否需要更新研究记录，需要就记录"
  ]) assert.equal(isResearchRelatedWakeupPrompt(prompt), true, `${prompt} must remain eligible for Dove research intake`);

  const entries = generatedClaudeAmbientProjectEntries();
  assert.deepEqual(entries.map((entry) => entry.destinationPath), EXPECTED_AMBIENT_PATHS);
  const byPath = new Map(entries.map((entry) => [entry.destinationPath, entry.content]));
  const rule = byPath.get(".claude/rules/dove.md");
  const intake = byPath.get(".claude/skills/dove-intake/SKILL.md");
  const paperSearch = byPath.get(PAPER_SEARCH_SUPPORT_SKILL_PATH);
  const webReader = byPath.get(EXA_WEB_SUPPORT_SKILL_PATH);
  const ordinary = `${rule}\n${intake}`;
  assert.match(ordinary, /zero-write/iu);
  assert.match(ordinary, /one complete (?:Dove )?research agent|same research collaboration/iu);
  assert.match(ordinary, /nine Skills.*(?:same research collaboration|current decision|optional specialist methods)|optional specialist capabilities/isu);
  assert.doesNotMatch(ordinary, /Planner.*Builder\/Author.*Reviewer/isu);
  assert.match(rule, /host handles general task routing/iu);
  assert.match(rule, /clearly research-related non-slash requests/iu);
  assert.match(rule, /hidden `dove-intake`.*thin zero-write bridge/isu);
  assert.match(rule, /does not choose a Skill, authorize work, decide continuation or completion, or narrow claims/iu);
  assert.match(rule, /Ask only when a consequential ambiguity would change the next useful action/iu);
  assert.match(rule, /weigh current evidence, task risk, user preference, and the research mainline/iu);
  assert.match(rule, /useful next move.*stop before unrequested execution or recording/iu);
  assert.match(rule, /real paper and webpage reading tools/iu);
  assert.match(rule, /search snippets can guide discovery/iu);
  assert.match(rule, /do not replace unretrieved paper or webpage content with shell, `curl`, or ad hoc fetch substitutes/iu);
  assert.match(rule, /Record concise natural-language notes in `\.dove\/install\/DOCTOR\.md` only for explicit feedback about Dove itself or actual Dove integration, routing, Skill, document, or guidance failures/iu);
  assert.match(rule, /Preserve reusable ordinary research or collaboration experience as Lessons instead/iu);
  assert.doesNotMatch(rule, /Stop hook|Stop-hook|Stop does not drive|plain-language rendering path|说人话/iu);
  assert.doesNotMatch(rule, /dove-paper-search|hosted `exa`|built-in `WebFetch`|built-in `WebSearch`|MCP|severity fields|fixed template|Do not ask the user to run `dove doctor`/iu);
  assert.match(intake, /likely research-related/iu);
  assert.match(intake, /zero-write/iu);
  assert.match(intake, /does not select a Skill/iu);
  assert.match(intake, /do not read, search, execute, modify files/iu);
  assert.doesNotMatch(intake, /sync/iu);
  assert.doesNotMatch(ordinary, /dove-lessons-intake|manage_dove|public Dove MCP|semantic ID/iu);
  assert.match(paperSearch, /user-invocable: false/u);
  assert.match(paperSearch, /Search, retrieve, and read academic papers through the pinned dove-paper-search project MCP/iu);
  assert.match(paperSearch, /academic paper discovery, retrieval, or full-text reading materially helps/iu);
  assert.match(paperSearch, /use_scihub: false/u);
  assert.match(paperSearch, /current host actually exposes and current user\/project permissions permit/iu);
  assert.match(paperSearch, /academic paper discovery, download, or full text was not obtained through `dove-paper-search`/iu);
  assert.match(paperSearch, /choose any exposed and permitted material or action that can still advance the question: `WebSearch` discovery snippets, Exa ordinary webpage\/documentation\/venue\/known-URL text when exposed, local project material, user-provided material, theory, experiment, or analysis/iu);
  assert.match(paperSearch, /Do not install dependencies or substitute a CLI, shell, `curl`, or ad hoc fetch script for this MCP, and do not follow a fixed substitute sequence/iu);
  assert.match(paperSearch, /Use built-in `WebSearch` for discovery when appropriate/iu);
  assert.match(paperSearch, /project `exa` MCP for ordinary webpage bodies, documentation pages, venue pages, and known URLs/iu);
  assert.doesNotMatch(paperSearch, /WebFetch/iu);
  assert.match(webReader, /user-invocable: false/u);
  assert.match(webReader, /hosted Exa project MCP/iu);
  assert.match(webReader, /ordinary webpage body retrieval, documentation page reading, venue page reading, crawling, or a known URL materially helps/iu);
  assert.match(webReader, /built-in `WebSearch`/iu);
  assert.match(webReader, /built-in `WebFetch`/iu);
  assert.match(webReader, /`exa` hosted project MCP/iu);
  assert.match(webReader, /ordinary webpage bodies, documentation pages, venue pages, and known URLs/iu);
  assert.match(webReader, /current host actually exposes and current user\/project permissions permit/iu);
  assert.match(webReader, /ordinary webpage body, documentation page, venue page, or known URL was not obtained through Exa/iu);
  assert.match(webReader, /choose any exposed and permitted material or action that can still advance the question: `WebSearch` discovery snippets, `dove-paper-search` academic paper discovery\/download\/full text when exposed, local project material, user-provided material, theory, experiment, or analysis/iu);
  assert.match(webReader, /Do not use CLI, shell, `curl`, Node\/Python fetch scripts, or built-in `WebFetch` instead, and do not follow a fixed substitute sequence/iu);
  assert.deepEqual(PAPER_SEARCH_MCP_FRAGMENT, {
    type: "stdio",
    command: "uvx",
    args: ["--from", PAPER_SEARCH_PACKAGE_SPECIFIER, "paper-search-mcp"]
  });
  assert.equal(Object.hasOwn(PAPER_SEARCH_MCP_FRAGMENT, "env"), false);
  assert.deepEqual(EXA_MCP_FRAGMENT, {
    url: "https://mcp.exa.ai/mcp",
    type: "http"
  });
  assert.equal(WEB_FETCH_DENY_PERMISSION, "WebFetch");
}

function assertPackagedAgentPolicy() {
  const agentText = renderClaudeDoveAgent();
  assert.ok(USER_RESPONSE_POLICY.length > 0);
  assertDoveAgentSurfaceSemantics(agentText, "Packaged Dove agent");
  assert.doesNotMatch(agentText, /actual Skill call to `dove:review`|latest material state receives a current Review `PASS`|Review gate/iu);
  assert.doesNotMatch(agentText, /Keep three primary roles distinct|Planner frames|Builder\/Author performs|Reviewer returns/iu);
}

function assertPublicDocumentationBoundaries() {
  const usage = fs.readFileSync(path.join(ROOT, "docs/USAGE.md"), "utf8");
  const capabilityMatrix = fs.readFileSync(path.join(ROOT, "docs/CAPABILITY_MATRIX.md"), "utf8");
  const packaging = fs.readFileSync(path.join(ROOT, "docs/PACKAGING.md"), "utf8");
  for (const document of [usage, capabilityMatrix]) {
    assert.match(document, /current research direction|current full paper|confirmed goal|research goal|Workspace mainline/iu);
    assert.match(document, /same Dove agent|same Dove|one complete Dove agent|one complete Dove persona|one research agent/iu);
    assert.match(document, /Review.*advisory|advisory.*Review|Review findings?.*evidence|returned review.*evidence|not independent external review/isu);
    assert.match(document, /goal is (?:reached|achieved)|no effective in-scope path|stops? when|keeps working while another useful in-scope step/isu);
    assert.match(document, /dove(?:\.|:)figure|Figure capability|Figure.*materially improve|figure.*material evidence|draw or revise figures/iu);
    assert.match(document, /dove run|run receipts|\.dove\/runs/iu);
    assert.doesNotMatch(document, /documented or recovered mainline|recovers the current mainline|Review-gated|Auto-gate|latest current `PASS`|actual `dove:review` call/iu);
  }
  assert.match(usage, /real manuscript context|manuscript layout|check(?:s|ing)? the result in its real manuscript context/iu);
  assert.match(usage, /generation.*revision.*checking|best available tool|drawing, redrawing, generation/isu);
  assert.match(usage, /LaTeX source/iu);
  assert.match(usage, /unless the target venue requires another format|venue.*(?:does not provide or accept|lacks|required|requires).*LaTeX/isu);
  assert.match(packaging, /generated adapters/iu);
  assert.match(packaging, /release validation/iu);
  assert.match(packaging, /run receipt behavior|\.dove\/runs|dove run/iu);
  assert.match(packaging, /cannot prove that Dove chose or performed the right research action/iu);
  assert.doesNotMatch(packaging, /Review gate|actual `dove-review` actually ran|runtime Skill call/iu);
}

function assertUserFacingCliOutput() {
  const homeCurrent = renderDoveHome({ state: "current" });
  const homeNeedsSync = renderDoveHome({ state: "needs-sync" });
  assert.match(homeCurrent, /完整科研 agent/iu);
  assert.match(homeCurrent, /进入支持的宿主后直接提出科研请求/u);
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
  assert.match(initOutput, /Dove agent 与 9 个可选专项入口已安装/u);
  assert.match(initOutput, /9 个可选专项入口已安装/u);
  assert.match(initOutput, /直接提出科研请求/u);
  assert.match(initOutput, /WebFetch 禁用/u);
  assert.match(initOutput, /普通网页 Exa MCP/u);
  assert.match(initOutput, /WebSearch 保留用于搜索发现，WebFetch 由项目权限禁用/u);
  assert.doesNotMatch(initOutput, /12 个 Dove 工作入口|Dove-only MCP 批准|\/dove:workspace/u);

  const updateOutput = renderProjectIntegrationResult("update", {
    status: "updated",
    target: "/workspace/example-project",
    hosts: ["claude"],
    writtenPaths: [],
    removedPaths: [],
    changedPaths: []
  });
  assert.match(updateOutput, /Dove 能力入口和已选宿主接入已刷新/u);
  assert.doesNotMatch(updateOutput, /内置 Lessons 已刷新|dove sync|Dove-only MCP 批准/u);

  const dshOutput = renderProjectIntegrationResult("init", {
    status: "initialized",
    target: "/workspace/example-project",
    hosts: ["dsh"],
    writtenPaths: [],
    removedPaths: [],
    changedPaths: []
  });
  assert.match(dshOutput, /DSH 项目级 filesystem Skills 已安装/u);
  assert.match(dshOutput, /DSH 不提供 Claude slash 命令、Hooks 或 MCP 声明/u);
  assert.doesNotMatch(dshOutput, /Claude 提示钩子|WebFetch 禁用|Exa MCP|dove-paper-search|重新进入 Claude Code/u);
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
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "export-research"), false, "CLI must not expose the retired legacy export command");
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "review"), "CLI must expose explicit isolated review handoff runtime");
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "run"), "CLI must expose detached experiment run receipts");
  assert.deepEqual(parseDoveCli(["review", "handoff", "--project=/workspace", "--venue", "TestConf", "--material", "paper/main.tex", "--material=build/main.pdf", "--id", "review-1", "--json"]), {
    command: "review",
    positionals: ["handoff"],
    args: ["--project", "/workspace", "--venue", "TestConf", "--material", "paper/main.tex", "--material", "build/main.pdf", "--id", "review-1", "--json"]
  });
  assert.deepEqual(parseDoveCli(["hook", "user-prompt-submit", "--project=/workspace"]), {
    command: "hook",
    positionals: ["user-prompt-submit"],
    args: ["--project", "/workspace"]
  });
  assert.deepEqual(parseDoveCli(["run", "start", "--project", "/workspace", "--id", "run-a", "--metric-name", "score", "--direction", "max", "--", "node", "script.mjs", "--flag", "--not-dove"]), {
    command: "run",
    positionals: ["start"],
    args: ["--project", "/workspace", "--id", "run-a", "--metric-name", "score", "--direction", "max"],
    passthrough: ["node", "script.mjs", "--flag", "--not-dove"]
  });
  assert.throws(() => parseDoveCli(["run", "status", "--project", "/workspace", "--id", "run-a", "--group", "group-a"]), /cannot be combined|Use only one/iu);
  assert.throws(() => parseDoveCli(["run", "start", "--project", "/workspace", "--format", "text", "--", "node"]), /--format accepts only json/iu);
  assert.throws(() => parseDoveCli(["run", "start", "--project", "/workspace", "--direction", "mean", "--", "node"]), /--direction accepts only min or max/iu);
  assert.throws(() => parseDoveCli(["doctor", "--json", "--format", "json"]), /cannot be combined/iu);
  assert.throws(() => parseDoveCli(["run", "start", "--project", "/workspace", "node"]), /requires command arguments after '--'/iu);
  assert.throws(() => parseDoveCli(["run", "start", "--project", "/workspace", "node", "--", "script.mjs"]), /accepts at most 1 positional/iu);
  assert.throws(() => parseDoveCli(["mcp", "serve"]), /Unknown|requires|unsupported/iu);
  assert.throws(() => parseDoveCli(["review"]), /review accepts only/iu);
  assert.throws(() => parseDoveCli(["review", "unknown"]), /review accepts only/iu);
}

async function assertInteractiveHostSelection() {
  assert.deepEqual(REGISTERED_PROJECT_HOST_IDS, EXPECTED_HOST_IDS);
  assert.deepEqual(DEFAULT_INITIALIZABLE_HOSTS, ["claude"]);

  for (const selectedHosts of [["claude"], ["dsh"], ["claude", "dsh"]]) {
    const target = "/workspace/example-project";
    let inspectionCount = 0;
    let initializeCall = null;
    let checkboxConfig = null;
    const output = [];
    const result = await runInteractiveDoveSetup({
      target,
      inspect: async () => {
        inspectionCount += 1;
        if (inspectionCount === 1) {
          return {
            target,
            setup: { mode: "init", reason: "clean-uninitialized", allowedActions: ["init", "exit"] },
            projectIntegration: { state: "uninitialized" }
          };
        }
        return {
          target,
          setup: { mode: "reinstall", reason: "current", allowedActions: ["reinstall", "uninstall", "exit"] },
          projectIntegration: { state: "current", manifest: { hosts: selectedHosts } }
        };
      },
      initialize: async (receivedTarget, lifecycleOptions) => {
        initializeCall = { target: receivedTarget, lifecycleOptions };
      },
      promptSelect: async () => "init",
      promptCheckbox: async (config) => {
        checkboxConfig = config;
        return selectedHosts;
      },
      stream: { isTTY: false, write: (chunk) => output.push(chunk) },
      env: { NO_COLOR: "1" }
    });

    assert.equal(result.status, "initialized");
    assert.deepEqual(initializeCall, { target, lifecycleOptions: { hosts: selectedHosts } });
    assert.equal(checkboxConfig.message, "选择要安装 Dove 的平台：");
    assert.equal(checkboxConfig.required, true);
    assert.deepEqual(checkboxConfig.choices, EXPECTED_HOST_IDS.map((hostId) => ({
      name: HOST_REGISTRY[hostId].label,
      value: hostId,
      checked: DEFAULT_INITIALIZABLE_HOSTS.includes(hostId)
    })));
    assert.match(output.join(""), /项目配置完成/u);
  }
}

async function assertInteractiveLifecycleMenus() {
  const target = "/workspace/example-project";
  const streamFor = () => {
    const chunks = [];
    return { chunks, stream: { isTTY: false, write: (chunk) => chunks.push(chunk) } };
  };

  {
    const actions = ["details", "exit"];
    const { chunks, stream } = streamFor();
    let detailsCalls = 0;
    let initialMenuOutput = null;
    const result = await runInteractiveDoveSetup({
      target,
      inspect: async () => ({
        target,
        staticChecksPassed: false,
        userCli: { healthy: true, package: { version: "3.0.0" } },
        projectIntegration: {
          state: "drifted",
          manifest: { hosts: ["claude"] }
        },
        migrationInstallation: { state: "absent" },
        workspaceState: { mode: "current", healthy: true },
        actions: [{ kind: "inspect", command: "dove doctor --json" }],
        setup: { mode: "blocked", reason: "drifted", allowedActions: ["reinstall", "details", "exit"] }
      }),
      promptSelect: async (config) => {
        if (actions.length === 2) {
          assert.deepEqual(config.choices.map((choice) => choice.value), ["reinstall", "details", "exit"]);
          initialMenuOutput = chunks.join("");
          assert.equal(initialMenuOutput.includes("Dove 检查"), false);
        }
        return actions.shift();
      },
      promptCheckbox: async () => { throw new Error("Drifted menu must not ask for install hosts."); },
      previewCompleteReinstall: async () => { throw new Error("Details must remain read-only."); },
      stream,
      env: { NO_COLOR: "1" }
    });
    detailsCalls += chunks.join("").match(/Dove 检查/gu)?.length ?? 0;
    assert.equal(result.status, "exited");
    assert.equal(detailsCalls, 1);
    assert.match(initialMenuOutput, /自动更新已停止/u);
    assert.doesNotMatch(initialMenuOutput, /面向 Dove 开发排查/u);
  }

  {
    const { stream } = streamFor();
    let updateCall = null;
    let checkboxConfig = null;
    const result = await runInteractiveDoveSetup({
      target,
      inspect: async () => ({
        target,
        projectIntegration: { state: "current", manifest: { hosts: ["dsh"] } },
        setup: { mode: "current", reason: "current", allowedActions: ["change-hosts", "reinstall", "uninstall", "details", "exit"] }
      }),
      promptSelect: async (config) => {
        assert.deepEqual(config.choices.map((choice) => choice.value), ["change-hosts", "reinstall", "uninstall", "details", "exit"]);
        assert.equal(config.choices.some((choice) => choice.value === "init"), false);
        return "change-hosts";
      },
      promptCheckbox: async (config) => {
        checkboxConfig = config;
        return ["claude", "dsh"];
      },
      update: async (receivedTarget, lifecycleOptions) => {
        updateCall = { target: receivedTarget, lifecycleOptions };
        return { status: "updated", target: receivedTarget, hosts: lifecycleOptions.hosts, writtenPaths: [], removedPaths: [], changedPaths: [] };
      },
      stream,
      env: { NO_COLOR: "1" }
    });
    assert.equal(result.action, "change-hosts");
    assert.deepEqual(updateCall, { target, lifecycleOptions: { hosts: ["claude", "dsh"] } });
    assert.deepEqual(checkboxConfig.choices.map(({ value, checked }) => ({ value, checked })), [
      { value: "claude", checked: false },
      { value: "dsh", checked: true }
    ]);
  }

  {
    const { stream } = streamFor();
    let updateCall = null;
    const result = await runInteractiveDoveSetup({
      target,
      inspect: async () => ({
        target,
        projectIntegration: { state: "uninitialized" },
        setup: { mode: "adopt", reason: "adoptable", allowedActions: ["adopt", "details", "exit"] }
      }),
      promptSelect: async (config) => {
        assert.deepEqual(config.choices.map((choice) => choice.value), ["adopt", "details", "exit"]);
        return "adopt";
      },
      promptCheckbox: async () => ["dsh"],
      update: async (receivedTarget, lifecycleOptions) => {
        updateCall = { target: receivedTarget, lifecycleOptions };
        return { status: "adopted", target: receivedTarget, hosts: lifecycleOptions.hosts, writtenPaths: [], removedPaths: [], changedPaths: [] };
      },
      stream,
      env: { NO_COLOR: "1" }
    });
    assert.equal(result.action, "adopt");
    assert.deepEqual(updateCall, { target, lifecycleOptions: { hosts: ["dsh"] } });
  }
}

async function assertSourceBuilds() {
  for (const entryPoint of ["src/core/index.mjs", "bin/dove.mjs"]) {
    await build({ absWorkingDir: ROOT, entryPoints: [entryPoint], bundle: true, write: false, platform: "node", format: "esm", external: ["node:*"], logLevel: "silent" });
  }
}

assertDoveAgentPersona();
assertSkillManifest();
assertCanonicalTerminology();
assertHostPolicy();
assertGeneratedAdapters();
assertAmbientRouting();
assertPackagedAgentPolicy();
assertUserFacingCliOutput();
assertPublicDocumentationBoundaries();
assertResearchDefaultsOwnership();
assertTrellisSpecMirrors();
assertRuntimeCli();
await assertInteractiveHostSelection();
await assertInteractiveLifecycleMenus();
await assertSourceBuilds();

console.log(JSON.stringify({ status: "passed" }, null, 2));

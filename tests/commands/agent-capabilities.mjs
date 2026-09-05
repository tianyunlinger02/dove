import assert from "node:assert/strict";

import {
  COMMAND_SURFACE_BY_ID,
  COMMAND_SURFACES,
  HOST_ADAPTER_POLICY,
  PACKAGE_GENERATED_SUPPORT_PATHS,
  PROJECT_HOST_IDS
} from "../../src/core/command-manifest.mjs";
import {
  DOVE_AGENT_CURIOSITY,
  DOVE_AGENT_DIRECT_JUDGMENT,
  DOVE_AGENT_FRAME,
  DOVE_AGENT_NAME,
  DOVE_AGENT_PERSONA_BULLETS,
  DOVE_AGENT_STOPPING,
  renderDoveAgentInstructions
} from "../../src/core/dove-agent-persona.mjs";
import {
  DOVE_AGENT_DEFINITION,
  DOVE_AGENT_SURFACES,
  generatedDoveAgentEntries,
  renderClaudeDoveAgent
} from "../../src/core/dove-agent-definition.mjs";
import { USER_RESPONSE_POLICY } from "../../src/core/user-response-policy.mjs";
import { EXA_WEB_SUPPORT_SKILL_PATH } from "../../src/core/web-access-integration.mjs";
import {
  generatedAdapterEntries,
  renderCommandAdapter
} from "../../scripts/generate-command-adapters.mjs";
import {
  EXPECTED_HOST_IDS,
  EXPECTED_SKILL_IDS,
  SEMANTIC_SECTION_FIELDS,
  actionCapabilities,
  assertDoveAgentSurfaceSemantics,
  assertMatchesAll,
  assertMatchesNone,
  assertUnique,
  contractAction,
  contractActions,
  contractText,
  semanticContractText,
  semanticSectionText,
  skillContract,
  text
} from "./common.mjs";

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

function assertCapabilityIncludes(command, expected) {
  const actual = new Set(actionCapabilities(command));
  for (const capability of expected) assert.ok(actual.has(capability), `${command.id} must expose capability ${capability}`);
}

function assertNoUnsafeResearchSurfaceLanguage(entries) {
  for (const entry of entries) {
    for (const { label, pattern } of UNSAFE_RESEARCH_SURFACE_PATTERNS) {
      assert.doesNotMatch(entry.content, pattern, `${entry.label} must not contain unsafe research-surface language: ${label}`);
    }
  }
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

function sharedCapabilityReturnText(command) {
  const contract = skillContract(command);
  const returnWith = Array.isArray(contract.returnWith) ? contract.returnWith.join("\n") : "";
  if (returnWith) return `Return with\n${returnWith}`;
  const lastSection = Array.isArray(contract.semanticSections) ? contract.semanticSections.at(-1) : null;
  if (/Return with|Return to Dove's research judgment|Shared capability return/iu.test(lastSection?.title ?? "")) return semanticSectionText(lastSection);
  const responsibility = contract.responsibilities.find((item) => /Inspected evidence|Return with what was inspected|what was inspected/iu.test(String(item)));
  assert.ok(responsibility, `${command.id} needs a shared capability return responsibility`);
  return String(responsibility);
}

function assertSharedCapabilityReturnIsConcise(command) {
  const sharedReturn = sharedCapabilityReturnText(command);
  assert.match(sharedReturn, /Return with|Dove's research judgment/iu, `${command.id} shared capability return must send work back to Dove judgment`);
  assert.match(sharedReturn, /inspected evidence|what was inspected|actually inspected|inspected or changed|changed/iu, `${command.id} shared capability return must preserve inspected-evidence semantics`);
  assert.match(sharedReturn, /material change|what changed|material decision.*changed|what remains unresolved|unresolved/iu, `${command.id} shared capability return must preserve decision-change semantics`);
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
  assert.match(value, /separate autonomy Skill|default.*substantive rounds/isu);
  assert.doesNotMatch(value, /Do not expose Auto|Auto as a Skill/iu);
}

function assertSourceCapabilitySemantics(command) {
  const sourceWork = contractAction(command, "source-research");
  const value = semanticContractText(command);
  assert.ok(sourceWork && !sourceWork.readOnly, "Source retrieval must be work-capable when useful");
  assertCapabilityPatterns(command, [
    { label: "external theory and related-work acquisition", patterns: [/external theory|related work|route changes that depend on external theory/isu] },
    { label: "source identity and claim-support checking", patterns: [/citation identity.*claim support|identity.*metadata.*supports?|verify identity.*metadata.*supports?/isu] },
    { label: "bounded bibliography DOI identity checks without ledger", patterns: [/bounded bibliography DOI identity check|verify only the requested entries.*do not create a ledger|without.*ledger/isu] },
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
  assert.match(sourceWork.instruction, /identity.*metadata.*actual content.*source for a claim|citation checks.*claim support/isu);
  assert.match(value, /bounded bibliography DOI identity checks?|requested entries.*ledger/isu);
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
    { label: "Dove run receipt judgment boundary", patterns: [/dove run start\|status\|resume\|finalize\|compare|\.dove\/runs\/|run receipts.*Experiment Markdown/isu] },
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
    { label: "user-specified target and evidence-grounded drafting", patterns: [/user-specified manuscript|user specifies a manuscript|specified evidence|evidence needed for its material claims|available evidence|relevant material/iu] },
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
  assert.match(semanticContractText(command), /without reading Claims merely because Draft was invoked|Claim note is directly relevant/iu);
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
    { label: "data or logic to figure-caption-claim alignment", patterns: [/source data or mechanism logic.*visual encoding.*caption.*nearby text.*manuscript claim|source data or logic aligned.*actual rendered figure.*caption.*manuscript claim/isu] },
    { label: "targeted revision of figure and manuscript context", patterns: [/targeted changes|editable source|plotting code|caption|nearby (?:text|manuscript text)|export settings/isu] },
    { label: "editable final delivery", patterns: [/final figure|route-native editable source|later modification|plotting code|SVG|vector|layered|mixed raster/isu] },
    { label: "no invented scientific material", patterns: [/must not invent|do not invent/iu] }
  ]);
}

function assertReviewCapabilitySemantics(command) {
  const sections = assertSemanticSections(command, { min: 5 });
  assertSemanticSectionOrder(command, [
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
    /local paragraph|figure, citation, or method review|requested scope|do not force the full-paper four questions/isu
  ]);
  assertMatchesAll(value, "dove.review four-question and heading semantics", [
    /four full-paper questions|ask four questions/iu,
    /method answers? the (?:research )?question|method answer/iu,
    /field judgment is correct|correct for the field/iu,
    /venue fit|fit the target venue/iu,
    /strongest reasonable objection|strongest.*objection/iu,
    /Verdict.*Blocking issues.*Grounding basis.*Author-side next actions|Blocking issues.*Grounding basis/isu
  ]);
  assertMatchesAll(reviewHandoff?.instruction ?? "", "dove.review handoff", [
    /near-submission|highly complete/iu,
    /genuinely isolated|isolated.*reviewer context|reviewer context.*isolated/isu,
    /isolated, persistent, recoverable reviewer context|host provides|reviewer session/isu,
    /resume or rerun.*whole-paper rounds.*same review id|same review id.*reviewer session/isu,
    /complete frozen material list|whole-paper|complete paper/isu,
    /only those listed materials/iu,
    /author side.*obtained.*venue or literature material|venue or literature material.*included.*frozen handoff/isu,
    /grounding is missing.*limit venue or literature conclusions|limit venue or literature conclusions.*listed materials/isu,
    /runtime is unavailable|host.*(?:provide|provides).*isolated/isu,
    /continue feasible author-side work without counting it as independent review/isu
  ]);
  assertMatchesAll(reviewImport?.instruction ?? "", "dove.review import", [
    /append.*faithfully|faithfully.*append|Preserve.*faithfully/isu,
    /actual text|actual `dove-review` return|user-pasted review/isu,
    /same review id and round when known|round.*when known/isu,
    /corresponding `\.dove\/reviews\/` round report|report\.md/isu,
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
  assert.match(rebuttalAction, /Do not rerun review for cosmetic|use `dove review rerun` when substantive evidence|old recommendation no longer covers the current full version/isu);
  assert.match(rebuttalAction, /preserving accurate claim strength|claim strength|resolve, reduce, or honestly bound/isu);
  assert.doesNotMatch(contractText(command), /claim acceptance[^.]*as proof|reviewer controls Dove/iu);
}

export function assertDoveAgentPersona() {
  assert.equal(DOVE_AGENT_NAME, "dove");
  assert.equal(DOVE_AGENT_DEFINITION.id, "dove");
  assert.equal(DOVE_AGENT_DEFINITION.publicName, "Dove");
  assert.equal(DOVE_AGENT_DEFINITION.title, "dove");
  assert.match(DOVE_AGENT_DEFINITION.description, /main research agent.*--agent dove|bounded independent subagent.*scoped research investigations/iu);
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

export function assertSkillManifest() {
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
    assert.ok(Array.isArray(contract.returnWith) && contract.returnWith.length > 0, `${label} needs a concise Return with footer`);
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

export function assertHostPolicy() {
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

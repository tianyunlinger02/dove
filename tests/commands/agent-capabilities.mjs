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
import * as researchContract from "../../src/core/dove-research-contract.mjs";
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
import { assertUserResponsePolicy } from "./ambient-docs.mjs";

const { DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS } = researchContract;

const RETIRED_RESEARCH_MODEL_PHRASES = Object.freeze([
  "layer enum",
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
  assert.match(sharedReturn, /next (?:useful|feasible) action[^.\n]*only when[^.\n]*(?:helps|useful|relevant)/iu, `${command.id} return should explain a useful next action, not force a closing suggestion`);
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

// Capabilities apply substantive judgment; completed operations remain evidence
// facts. Reuse these checks for the manifest and the rendered capability body.
export function assertCapabilityJudgment(value, id, label = id) {
  const patterns = {
    "dove.research": [
      /shared substantive quality criteria[^.\n]*problems[^.\n]*candidates[^.\n]*claims[^.\n]*components/iu,
      /evidence confidence[^.\n]*current.purpose satisfaction[^.\n]*separately/iu,
      /novel[^.\n]*remaining contribution[^.\n]*not how much literature/iu,
      /well.investigated incremental idea[^.\n]*remains incremental/iu,
      /route and investment decisions[^.\n]*joint conditions[^.\n]*overall tradeoffs[^.\n]*evaluation table[^.\n]*useful/iu,
      /novelty[^.\n]*N0–N4[^.\n]*theory[^.\n]*T0–T4[^.\n]*only when[^.\n]*(?:user|project).provided definitions[^.\n]*available[^.\n]*actually been inspected/iu,
      /preserve their meanings[^.\n]*not a combined score or global admission threshold/iu,
      /N1 coverage[^.\n]*not an improvement over N0/iu,
      /N4 search standing[^.\n]*does not mean foundational innovation/iu,
      /do not convert[^.\n]*shared quality grades[^.\n]*require duplicate ratings/iu
    ],
    "dove.status": [
      /existing materials[^.\n]*substantive quality[^.\n]*evidence confidence[^.\n]*current.purpose satisfaction/iu,
      /otherwise[^.\n]*rating undetermined/iu,
      /distinguish scientific progress[^.\n]*enabling engineering[^.\n]*delivery facts/iu,
      /evaluation table[^.\n]*tradeoffs and unknowns[^.\n]*without treating completed checks as high quality/iu,
      /do not treat[^.\n]*checks[^.\n]*run receipts[^.\n]*engineering receipts[^.\n]*navigation as scientific progress/iu,
      /(?:do not|never) start validation[^.\n]*maintain documents[^.\n]*(?:missing level|evidence gap)/iu
    ],
    "dove.source": [
      /found leads[^.\n]*verified citation identity[^.\n]*inspected relevant full text[^.\n]*checked a specific claim/iu,
      /source.use facts, not novelty grades/iu,
      /novelty[^.\n]*remaining substantive contribution[^.\n]*search depth[^.\n]*confidence/iu,
      /retrieval alone[^.\n]*not inspection/iu,
      /claim verification[^.\n]*support[^.\n]*contradiction[^.\n]*insufficient coverage[^.\n]*not necessarily support/iu,
      /nearby work[^.\n]*problem[^.\n]*inputs\/outputs[^.\n]*assumptions[^.\n]*mechanism[^.\n]*claim[^.\n]*same granularity/iu,
      /subtract covered contributions[^.\n]*reassess[^.\n]*remaining difference[^.\n]*independence[^.\n]*value/iu,
      /unchecked full text[^.\n]*does not establish absence of overlap/iu,
      /stop searching[^.\n]*retrieval[^.\n]*not change[^.\n]*decision/iu
    ],
    "dove.experiment": [
      /specified design[^.\n]*working execution chain[^.\n]*work facts, not quality grades/iu,
      /evaluation validity[^.\n]*establish, refute, or bound[^.\n]*particular claim/iu,
      /valid negative result[^.\n]*complete an experiment[^.\n]*advance knowledge[^.\n]*without supporting[^.\n]*method/iu,
      /nonsignificant[^.\n]*do not establish no effect/iu,
      /what was learned[^.\n]*decision it changes[^.\n]*not run completion as scientific success/iu,
      /before expanding investment[^.\n]*joint conditions[^.\n]*upper bounds[^.\n]*attainability[^.\n]*evaluation reliability, and minimum worthwhile benefit/iu,
      /no single successful check[^.\n]*scaling[^.\n]*scientific uncertainty/iu,
      /(?:existing material|authorized validation)/iu
    ],
    "dove.draft": [
      /outline[^.\n]*complete draft[^.\n]*evidence check[^.\n]*actual delivery[^.\n]*work facts, not scientific quality grades/iu,
      /expression[^.\n]*misleading[^.\n]*weak[^.\n]*accurate and usable[^.\n]*compelling/iu,
      /writing completeness[^.\n]*independent of contribution and evidence strength/iu,
      /polished manuscript[^.\n]*unsupported central claim/iu,
      /user decisions[^.\n]*goal or expression[^.\n]*not establish stronger facts/iu,
      /common assumptions[^.\n]*limits together[^.\n]*rather than repeating/iu,
      /core gaps constrain[^.\n]*conclusions/iu,
      /local wording task[^.\n]*local[^\n]*without restarting research/iu
    ],
    "dove.figure": [
      /visual plan[^.\n]*rendered visual[^.\n]*materials and meaning checked[^.\n]*final use context[^.\n]*work facts, not quality grades/iu,
      /judge accuracy[^.\n]*clarity[^.\n]*insight[^.\n]*actual usability/iu,
      /misleading encoding[^.\n]*remains poor after inspection/iu,
      /substantive revisions[^.\n]*preserve nearby claims and evidence[^.\n]*not merely improve appearance/iu,
      /standalone preview[^.\n]*does not establish final.context readiness/iu,
      /materials around each figure or panel[^.\n]*evidence or mechanism job/iu,
      /distinguish schematic explanation from data evidence/iu,
      /local figure edits[^.\n]*do not trigger[^.\n]*whole.project audit/iu
    ],
    "dove.review": [
      /核心问题[^.\n]*core goal[^.\n]*分支问题[^.\n]*affected dependent work[^.\n]*局部问题[^.\n]*local quality/u,
      /evidence sufficiency separately[^.\n]*rather than equating missing evidence with refutation/iu,
      /rather than equating[^.\n]*repair effort with severity/iu,
      /reasoned objections[^.\n]*cited evidence[^.\n]*not new empirical evidence or automatic proof/iu
    ],
    "dove.rebuttal": [
      /finding understood[^.\n]*response path grounded[^.\n]*needed revisions implemented[^.\n]*effect checked[^.\n]*processing facts, not resolution grades/iu,
      /concern[^.\n]*resolved, reduced, or still limiting[^.\n]*whole argument[^.\n]*without new scientific defects/iu,
      /compare local repair[^.\n]*shared.cause redesign[^.\n]*alternative routes[^.\n]*further evidence[^.\n]*rather than defaulting[^.\n]*smallest reply/iu,
      /(?:group|merge)[^.\n]*same root cause[^.\n]*definition[^.\n]*mechanism[^.\n]*evidence[^.\n]*expression gaps/iu,
      /(?:preserve|preserving)[^.\n]*coverage of each material finding/iu,
      /written response[^.\n]*does not establish[^.\n]*issue is resolved/iu,
      /author self.check[^.\n]*does not mean reviewer acceptance/iu
    ],
    "dove.lessons": [
      /tentative, grounded, or tested through reuse under stated conditions[^.\n]*evidence facts, not grades of usefulness/iu,
      /validity[^.\n]*conditions[^.\n]*counterexamples[^.\n]*transfer value/iu,
      /reuse may refute advice rather than strengthen it/iu,
      /repeated citation[^.\n]*recording[^.\n]*application alone[^.\n]*does not improve[^.\n]*lesson[^.\n]*scientific progress/iu,
      /reusable insight[^.\n]*basis[^.\n]*conditions[^.\n]*counterexamples[^.\n]*limits/iu,
      /optional researcher.owned advisory documents[^.\n]*not package.owned defaults/iu
    ]
  }[id];
  assert.ok(patterns, `${label} needs capability-specific substantive judgment`);
  assertMatchesAll(value, label, patterns);
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
    { label: "discriminating evidence work", patterns: [/discriminating action|small diagnostics|diagnostic experiments?|source checks|artifact inspections/iu] },
    { label: "result absorption before continuation", patterns: [/reassess.*proposition.*result.*continue|absorb.*result|what it changes/isu] }
  ]);
  assert.match(researchProgression, /confirmed or provisional mainline|Follow the confirmed or provisional mainline/iu);
  assert.match(researchProgression, /reassess[^.\n]*original proposition[^.\n]*result[^.\n]*continue/iu);
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
    { label: "identity and support as separate judgments", patterns: [/metadata identity[^.\n]*not full.text inspection or claim support/iu] },
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

// Experiment owns these checks; neither ambient theory nor the shared author
// stance can stand in for an actual evaluation chain and identifiable controls.
export function assertExperimentScientificEvaluation(value, label) {
  assertMatchesAll(value, label, [
    /claim-driven[^\n]*real problem[^\n]*key uncertainty[^\n]*primary prediction[^\n]*strongest (?:simple )?alternative[^\n]*minimum sufficient evidence/iu,
    /evaluation chain[^\n]*input[^\n]*each method's actual output[^\n]*basis[^\n]*compared against[^\n]*metric measures[^\n]*between-method comparison/iu,
    /reference[^\n]*applicability[^\n]*target object and granularity/iu,
    /justify[^\n]*proxy[^\n]*method's own output[^\n]*evaluation basis[^\n]*not merely[^\n]*file's existence/iu,
    /failed, missing, invalid, or excluded outputs[^\n]*results and denominators/iu,
    /without silently retaining only the successful intersection[^\n]*or automatically assigning every failure zero/iu,
    /Where applicable[^\n]*same evaluation units[^\n]*paired comparisons[^\n]*differences and uncertainty[^\n]*sample dependence/iu,
    /Protect final-test independence[^\n]*training[^\n]*tuning[^\n]*calibration[^\n]*method selection/iu,
    /ablations[^\n]*actual code, configuration, and outputs[^\n]*beyond the named component/iu,
    /information access[^\n]*preprocessing[^\n]*training budget[^\n]*numerical scale[^\n]*edit magnitude[^\n]*postprocessing[^\n]*also change/iu,
    /Distinguish[^\n]*full implementation winning[^\n]*component's gain under the given control[^\n]*support for a scientific mechanism/iu,
    /controls cannot identify the core contribution[^.\n]*compare[^.\n]*repair[^.\n]*evaluation redesign[^.\n]*identifiable alternative mechanism or route[^.\n]*stopping the branch/iu,
    /more runs do not repair identification/iu,
    /current conclusion within actual evidence[^.\n]*overall.best authorized action[^.\n]*rather than defaulting to minimal controls or claim narrowing/iu,
    /new data, methods, evaluation chains, or decision-relevant gaps[^\n]*existing code, samples, and outputs where sufficient/iu,
    /diagnostic only when necessary and authorized/iu,
    /Small samples[^\n]*chain semantics and implementation[^\n]*not population-level statistical sufficiency/iu,
    /design-only[^\n]*trace materials read-only[^\n]*plan with unverified parts[^\n]*without running diagnostics or experiments/iu,
    /reference, pairing, and data-split reasoning only where it fits/iu,
    /do not impose[^\n]*ground truth[^\n]*paired designs[^\n]*train\/test splits[^\n]*no-ground-truth[^\n]*non-paired[^\n]*purely theoretical/iu,
    /Interpret results[^\n]*evaluation chain[^\n]*actual control differences[^\n]*anomalies before treating them as evidence/iu
  ]);
}

function assertExperimentCapabilitySemantics(command) {
  assertExperimentScientificEvaluation(semanticContractText(command), "Experiment capability");
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
    { label: "central experiment basis", patterns: [/real problem.*key uncertainty.*route decision|problem.*key uncertainty.*strongest (?:simple )?alternative/isu] },
    { label: "investigate missing central basis", patterns: [/central basis is missing.*pause central design.*inspect actual project material/isu] },
    { label: "claim-driven discrimination", patterns: [/natural-language named prediction|primary prediction|minimum sufficient evidence|positive, negative, or ambiguous outcomes/iu] },
    { label: "execution validity before scientific evidence", patterns: [/anomal(?:ous|ies).*before (?:using|treating) them as evidence|unstable.*scientific evidence/isu] },
    { label: "execution-validity coverage", patterns: [/implementation.*data.*configuration.*environment.*randomness.*metrics.*analysis|implementation.*data shortcuts.*configuration drift.*baselines.*randomness.*metrics.*analysis|implementation.*data.*configuration.*baselines.*randomness.*metrics.*analysis|configuration.*data.*metrics.*actual code.*logs.*outputs/isu] },
    { label: "results grounded in actual run materials", patterns: [/methods.*configuration.*data.*metrics.*run counts.*result numbers.*actual code.*logs.*outputs|actual code.*logs.*outputs.*data files.*user material|run receipts/isu] },
    { label: "Dove run receipt judgment boundary", patterns: [/dove run start\|status\|resume\|finalize\|compare|\.dove\/runs\/|run receipts.*Experiment Markdown/isu] },
    { label: "observation interpretation separation", patterns: [/what was observed.*what it means.*why it matters.*what happens next|separate what was observed/isu] },
    { label: "scoped evidence", patterns: [/data.*scale.*settings.*implementation|conditions actually tested|evidence scope/isu] }
  ]);
  const actions = contractActions(command);
  const designIndex = actions.findIndex((item) => item.capability === "experiment-design");
  const executionIndex = actions.findIndex((item) => item.capability === "experiment-execution");
  const planIndex = actions.findIndex((item) => item.capability === "research-document-maintenance" && /save.*prospective plan/iu.test(item.instruction));
  assert.ok(planIndex > designIndex && planIndex < executionIndex, "Experiment must expose a prospective save action between design and execution, not only a post-run note");
  const plan = actions[planIndex];
  assert.equal(plan.readOnly, false);
  assert.equal(plan.persistencePolicy, "standard-research");
  assertMatchesAll(plan.persistWhen, "prospective plan trigger", [/new central execution.*requested and permitted/iu, /record, update, or save/iu, /continuation context.*useful/iu]);
  assertMatchesAll(plan.instruction, "prospective save action", [
    /Only for newly authorized central execution.*needs recording/iu,
    /select.*Experiment document.*save.*prospective plan.*before execution/iu,
    /what it tests.*prediction.*alternative.*procedure.*results.*judged/iu,
    /same document.*later actual results/iu,
    /Design-only.*existing-result analysis.*retrospective.*diagnostics.*do not require a new document/iu
  ]);
  assertMatchesAll(executionInstruction, "execution must consume the saved plan", [
    /execute only after.*prospective plan.*saved.*then append.*same Experiment document/iu,
    /existing-result analysis or retrospective.*do not imply a prior plan existed/iu,
    /evaluation chain.*actual control differences.*anomalies before treating.*evidence/iu
  ]);
  assert.match(designInstruction, /claim-driven comparison.*evaluation chain/iu);
  assert.match(executionInstruction, /Execute only when requested and permitted|when requested and permitted/iu);
  assert.match(`${executionInstruction}\n${interpretationInstruction}`, /actual code|logs|outputs|data files|configuration|metrics/iu);
  assert.match(`${executionInstruction}\n${interpretationInstruction}`, /anomal(?:ous|ies)|unstable|hard-to-reproduce|scientific evidence|expected and actual/iu);
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

  assert.ok(reviewerWork.instruction.includes(DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS), "Review action must use the canonical four questions");
  const rendered = renderCommandAdapter("claude", command);
  assert.equal(rendered.split(DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS).length - 1, 1, "Review must render one canonical four-question definition, not divergent copies");
  assert.match(rendered, /same four full-paper questions above/iu, "Independent Review must reuse the complete definition rather than a shortened version");
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
    /author-retrieved venue or literature grounding[^.\n]*frozen-material judgment/iu,
    /Include[^.\n]*grounding inspected above[^.\n]*frozen-material judgment/iu,
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
  assert.match(DOVE_AGENT_DIRECT_JUDGMENT, /judgment[^.\n]*when useful[^.\n]*next move[^.\n]*stop before unrequested execution or recording/iu);

  for (const textValue of [renderDoveAgentInstructions(), renderClaudeDoveAgent()]) {
    assertDoveAgentSurfaceSemantics(textValue, "Dove agent surface");
    assert.doesNotMatch(textValue, /\b(?:PICOS|PRISMA|risk-of-bias|GRADE|meta-analysis)\b/iu, "Dove agent surface must leave systematic-review details to Source");
    assert.doesNotMatch(textValue, /exact project-relative frozen material list|review round.*target venue.*frozen material scope|whole current version.*not only a diff/isu, "Dove agent surface must leave detailed review handoff and provenance to the Review Skill");
    assert.doesNotMatch(textValue, /actual Skill call to `dove:review`|latest material state receives a current Review `PASS`|Review gate/iu);
    assert.doesNotMatch(textValue, /planner.*builder.*reviewer.*three roles|user-switchable.*planner|Planner.*Builder\/Author.*Reviewer/isu);
  }

  const agentEntries = generatedDoveAgentEntries();
  assert.deepEqual(agentEntries.map((entry) => entry.relativePath), [DOVE_AGENT_SURFACES.claude]);
  assert.equal(agentEntries[0].content, renderClaudeDoveAgent());
}

export function assertSkillManifest() {
  assert.equal(Object.hasOwn(researchContract, "DOVE_RESEARCH_MATURITY"), false, "Retired research maturity must not survive as a compatibility export");
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
    assertCapabilityJudgment(semanticContractText(command), command.id);
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
        assert.match(item.instruction, /Lessons materials[^.\n]*absent[^.\n]*work without them/iu, `${label} must remain usable without Lessons`);
        assert.match(item.instruction, /fallible guidance[^.\n]*never as evidence/iu, `${label} Lessons must not certify current claims`);
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
  assert.doesNotMatch(serialized, /Review gate|Auto-gate|(?:runtime|automatic) contribution scor(?:e|ing)|return `PASS`|return `REVISE`|verdictEnum|strictImportSchema|same-context independent|same context independent/iu, "Skills must not recreate review gates, runtime scoring states, schemas, enums, or same-context pseudo-independence");
  assert.doesNotMatch(serialized, /fixed closing synthesis|numbered steps/iu, "Skills must not preserve retired fixed-synthesis or numbered-step language");
  assert.doesNotMatch(serialized, /"(?:maturityLevel|researchLevel|impactLevel|noveltyScore|theoryScore|promotionRule|acceptanceGate)"\s*:/u, "Natural-language levels must not become runtime fields or automatic gates");

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

  assertUserResponsePolicy(USER_RESPONSE_POLICY.join("\n"), "Canonical user response policy");
}

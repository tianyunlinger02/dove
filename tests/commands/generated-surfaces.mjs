import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  COMMAND_SURFACES,
  PACKAGE_DOCUMENTATION_PATHS,
  PROJECT_HOST_IDS,
  adapterPathForCommand,
  packageResourcePath
} from "../../src/core/command-manifest.mjs";
import { renderDoveAgentInstructions } from "../../src/core/dove-agent-persona.mjs";
import {
  generatedDoveAgentEntries,
  renderClaudeDoveAgent
} from "../../src/core/dove-agent-definition.mjs";
import {
  PAPER_SEARCH_SUPPORT_SKILL_PATH,
  renderPaperSearchSupportSkill
} from "../../src/core/paper-search-integration.mjs";
import {
  generatedAdapterEntries,
  generatedClaudeAmbientProjectEntries,
  renderCommandAdapter
} from "../../scripts/generate-command-adapters.mjs";
import {
  ROOT,
  actionCapabilities,
  assertDoveAgentSurfaceSemantics,
  assertSemanticDeletionsRejected,
  assertUnique,
  contractActions,
  skillContract
} from "./common.mjs";

import { assertSharedAuthorStance, assertSharedResearchJudgment } from "./ambient-docs.mjs";
import { assertExperimentScientificEvaluation } from "./agent-capabilities.mjs";

const AMBIGUOUS_ROUTE_TERM_PATTERNS = Object.freeze([
  { label: "approved route", pattern: /\bapproved route\b/iu },
  { label: "support route", pattern: /\bsupport route\b/iu },
  { label: "source path", pattern: /\bsource path\b/iu },
  { label: "business adapters", pattern: /\bbusiness adapters\b/iu },
  { label: "the other MCP", pattern: /\bthe other MCP\b/iu },
  { label: "unavailable or unapproved", pattern: /\bunavailable or unapproved\b/iu }
]);

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
  let previousIndex = -1;
  for (const item of contractActions(entry.command)) {
    const index = entry.content.indexOf(item.instruction);
    assert.ok(index > previousIndex, `${label} must render ${entry.command.id} actions in order without exposing internal capability ids`);
    previousIndex = index;
  }
}

function renderedSection(value, title) {
  const heading = `### ${title}\n\n`;
  const start = value.indexOf(heading);
  assert.ok(start >= 0, `rendered instructions need section ${title}`);
  const end = value.indexOf("\n### ", start + heading.length);
  return value.slice(start + heading.length, end < 0 ? undefined : end);
}

function assertInstruction(value, locator, patterns, label) {
  const matches = value.split("\n").filter((line) => line.startsWith("- ") && locator.test(line));
  assert.equal(matches.length, 1, `${label} needs one actionable instruction matching ${locator}`);
  for (const pattern of patterns) assert.match(matches[0], pattern, `${label} must preserve ${pattern}`);
  return matches[0];
}

// Claude commands inherit their shared context from either the ordinary rule or
// the explicit agent. DSH Skills stand alone. Never demand the shared theory
// paragraph inside an individual Research/Experiment action.
export function assertFinalEntrypointWiring() {
  const rule = generatedClaudeAmbientProjectEntries().find((entry) => entry.destinationPath === ".claude/rules/dove.md")?.content;
  assert.ok(rule, "Claude ambient rule must be reachable");
  const agent = renderClaudeDoveAgent();
  for (const entry of generatedAdapterEntries()) {
    const contexts = entry.hostId === "claude"
      ? [["Claude rule + command", rule], ["Claude agent + command", agent]]
      : [["DSH standalone Skill", ""]];
    for (const [context, prefix] of contexts) {
      const label = `${context} ${entry.command.id}`;
      const value = [prefix, entry.content].filter(Boolean).join("\n\n");
      assertSharedResearchJudgment(value, label);
      assertSemanticDeletionsRejected(value, label, assertSharedResearchJudgment, [
        /Before committing to or materially changing/iu,
        /core proposition/iu,
        /simple alternatives/iu,
        /distinguishing predictions/iu,
        /as needed/iu,
        /to (?:choose or revise|change) the method/iu,
        /statistical identification/iu,
        /without skipping necessary run-validity checks/iu,
        /urgent protection/iu,
        /conditions still hold/iu,
        /decision-changing gaps/iu,
        /not the whole project again for each agent/iu,
        /comparison that cannot identify the contribution/iu,
        /alone does not establish/iu,
        /alone are not research progress/iu,
        /not the facts/iu,
        /Answer and stop for pure judgment or bounded requests/iu
      ]);
      if (entry.command.id === "dove.status") {
        // Ambient author context may be present in Claude, but the actual Status
        // command overrides action/maintenance; DSH must not receive it at all.
        assertRenderedCapabilityWiring(entry);
        if (entry.hostId === "dsh") {
          assert.match(value, /For Status[^\n]*only to inspect and report[^\n]*do not execute research actions or maintain documents/iu);
          assert.doesNotMatch(value, /^## Author stance$|After delegation|perform the feasible next in-scope step|Maintain Dove research Markdown/mu);
        }
      } else {
        assertSharedAuthorStance(value, label);
        assertSemanticDeletionsRejected(value, label, assertSharedAuthorStance, [
          /main session/iu,
          /full user context/iu,
          /synthesizes decisive evidence/iu,
          /subtask applicability/iu,
          /unverified limits/iu,
          /resolves contradictions/iu,
          /without redoing every subtask/iu,
          /majority opinion/iu,
          /not scientific judgment/iu,
          /not own the mainline or important user communication/iu,
          /do not indefinitely postpone accepting counterevidence/iu,
          /does not erase/iu,
          /does not await user approval/iu,
          /Read-only requests authorize inspection and reporting, not execution or recording/iu
        ]);
      }
    }
  }
}

function assertSubmissionCompletion(value, label) {
  for (const pattern of [
    /submission-completion goal.*completion needs author-side scientific sufficiency.*current independent `dove-review`.*same full version.*real delivery readiness/iu,
    /Unavailable isolated review.*requirement unmet, not waived/iu,
    /bounded local review.*can finish without becoming a submission-completion goal/iu
  ]) assert.match(value, pattern, `${label} must keep current independent full review mandatory for submission, not for bounded work`);
}

function assertAuthoritativeManuscript(value, label) {
  for (const pattern of [
    /preserve.*current authoritative manuscript format/iu,
    /identify.*source.*build or export path.*actual venue requirements/iu,
    /Only for a new manuscript.*default to LaTeX when the venue accepts it.*otherwise.*required format/iu,
    /Inspect.*actual submission output.*compiled output for LaTeX/iu,
    /propagate.*(?:changes|revisions|edits).*authoritative source/iu
  ]) assert.match(value, pattern, `${label} must preserve the actual authoritative manuscript, not impose LaTeX`);
}

// These checks inspect final host instructions independently of manifest string
// identity. They protect textual behavior and ordering, not model execution.
export function assertRenderedCapabilityWiring(entry) {
  const label = generatedSurfaceLabel(entry);
  const value = entry.content;
  const actions = entry.command.id === "dove.review" ? value : renderedSection(value, "Ways Dove may proceed");
  switch (entry.command.id) {
    case "dove.research": {
      assertInstruction(actions, /Follow the confirmed or provisional mainline/iu, [
        /choose[^\n]*discriminating action[^\n]*perform[^\n]*permitted host tools[^\n]*reassess[^\n]*continue/iu,
        /reassess[^.\n]*original proposition[^.\n]*result[^.\n]*continue/iu,
        /submission goal.*Review.*current whole-paper judgment.*before declaring completion/iu
      ], label);
      break;
    }
    case "dove.status":
      assertInstruction(actions, /Read `\.dove\/research\/RESEARCH\.md`/u, [
        /only.*summaries and linked details needed/iu,
        /visible conversation.*necessary current project materials.*distinguish live work from durable research notes/iu,
        /conflicts or stale notes.*without silently reconciling/iu,
        /without inferring the mainline from the latest Review or Run receipt alone/iu,
        /absent.*say so naturally.*do not modify files/iu
      ], label);
      break;
    case "dove.source":
      assertInstruction(actions, /Discover, retrieve/iu, [
        /verify identity and metadata first.*direct DOI lookup before fuzzy title search/iu,
        /failed lookup is unknown/iu,
        /Metadata identity is not full-text inspection or claim support.*inspect actual content before using.*claim/iu,
        /Split compound claims.*material parts.*report each as supported, contradicted, or uncovered.*inspected content.*passage or evidence.*limits/iu,
        /Partial support is not support for the whole sentence/iu,
        /recommend only the supported wording without automatically editing the manuscript/iu,
        /explicit systematic work.*ordinary paper finding.*single fact checks stay proportional/iu,
        /unavailable.*say what is missing.*continue.*other material/iu
      ], label);
      break;
    case "dove.experiment": {
      const capability = value.slice(value.indexOf("## How Dove approaches this work"));
      assertExperimentScientificEvaluation(capability, label);
      const design = assertInstruction(actions, /For new design/iu, [
        /claim-driven comparison and evaluation chain/iu,
        /central basis is missing[^\n]*pause central design[^\n]*inspect actual project material or relevant sources[^\n]*rather than inventing/iu,
        /new data, methods, evaluation chains, or decision-relevant gaps[^\n]*existing code, samples, and outputs where sufficient/iu,
        /diagnostic only when necessary and authorized/iu,
        /Small samples[^\n]*chain semantics and implementation[^\n]*not population-level statistical sufficiency/iu,
        /design-only[^\n]*read-only[^\n]*plan with unverified parts[^\n]*without running diagnostics or experiments/iu,
        /Analyze existing results directly.*retrospective.*rather than inventing prior design/iu
      ], label);
      const plan = assertInstruction(actions, /Only for newly authorized central execution/iu, [
        /central execution that needs recording.*select.*Experiment document.*save the prospective plan there before execution begins/iu,
        /what it tests.*prediction.*alternative.*procedure.*results.*judged/iu,
        /same document.*later actual results/iu,
        /Design-only.*existing-result analysis.*retrospective.*exploratory diagnostics do not require a new document/iu
      ], label);
      const execution = assertInstruction(actions, /Execute only when requested and permitted/iu, [
        /methods, configuration, data, metrics, run counts, and result numbers from actual code, logs, outputs/iu,
        /Interpret results[^\n]*evaluation chain[^\n]*actual control differences[^\n]*anomalies before treating them as evidence/iu,
        /execute only after[^\n]*prospective plan[^\n]*successfully saved[^\n]*then append[^\n]*actual procedure, result[^\n]*deviation[^\n]*evidence scope[^\n]*same Experiment document/iu,
        /existing-result analysis or retrospective.*do not imply a prior plan existed/iu,
        /what was observed.*what it means.*why it matters.*what happens next/iu
      ], label);
      assertTextOrder(actions, design, plan, `${label} design then prospective save`);
      assertTextOrder(actions, plan, execution, `${label} prospective save then execution and append`);
      break;
    }
    case "dove.draft": {
      const edit = assertInstruction(actions, /Read the target and relevant material/iu, [
        /Propagate authorized edits.*real build or export path.*inspect.*actual output before claiming.*current/iu,
        /assessment-only.*findings without edits/iu
      ], label);
      assertAuthoritativeManuscript(edit, label);
      assert.match(value, /Preserve certainty, causality, scope, generality, quantitative qualifiers, and novelty.*say what changed before changing the text/iu, `${label} must explain claim changes before editing`);
      break;
    }
    case "dove.figure": {
      const plan = assertInstruction(actions, /Create a compact Figure brief/iu, [/planning-only or assessment-only.*without creating files/iu], label);
      const creation = assertInstruction(actions, /For creation, choose/iu, [
        /plot quantitative figures from real data with reproducible code.*editable.*SVG.*exposed host image/iu,
        /Render the actual figure and write its caption from the inspected data or mechanism logic/iu,
        /do not invent data, results, or method details/iu
      ], label);
      const inspection = assertInstruction(actions, /Open or view the actual rendered figure/iu, [
        /not just filenames or thumbnails.*realistic final dimensions.*manuscript context/iu,
        /source data or mechanism logic.*visual encoding.*rendered panels.*caption.*nearby text.*layout fit.*manuscript claim/iu
      ], label);
      const revision = assertInstruction(actions, /For revision, make targeted changes/iu, [/rerender and inspect.*before delivery/iu], label);
      const delivery = assertInstruction(actions, /Deliver the final figure file/iu, [/caption.*route-native editable source.*later modification/iu], label);
      for (const [first, second] of [[plan, creation], [creation, inspection], [inspection, revision], [revision, delivery]]) assertTextOrder(actions, first, second, label);
      break;
    }
    case "dove.review": {
      const selfCheck = renderedSection(value, "Author-side scientific self-check");
      const grounding = assertInstruction(selfCheck, /For whole-paper author-side self-check/iu, [
        /official venue sources.*formal requirements.*inspected relevant published work/iu,
        /published practice does not replace official rules/iu,
        /Import, context inspection, or bounded local review does not trigger.*search by itself/iu
      ], label);
      const questions = assertInstruction(selfCheck, /For the complete paper, ask four questions/iu, [
        /method answer the research question/iu,
        /mechanisms, terms, comparisons, literature, counterexamples, and limits correct for the field/iu,
        /contribution, evidence, scope, and expression fit the target venue and its readers/iu,
        /strongest reasonable objection.*evidence or revision needed to answer it/iu,
        /citation identity.*claim support.*claim strength.*unsupported facts.*anomalous results/iu,
        /local paragraph, figure, citation, or method review.*requested scope.*do not force.*or start an independent handoff/iu
      ], label);
      assertTextOrder(selfCheck, grounding, questions, `${label} grounding before full-paper judgment`);
      assert.equal((value.match(/ask four questions:/gu) ?? []).length, 1, `${label} must define all four questions only once`);
      const independent = renderedSection(value, "Independent `dove-review`");
      assert.match(independent, /whole current frozen paper, not only a diff.*same four full-paper questions above/iu);
      assertSubmissionCompletion(independent, label);
      assert.match(independent, /Verdict.*Blocking issues.*Grounding basis.*Author-side next actions/iu);
      const handoff = assertInstruction(independent, /Start `dove-review` only from/iu, [
        /current complete paper.*authoritative manuscript source in its existing format and actual submission output.*appendices or supplements.*target venue/iu,
        /compiled output for LaTeX/iu,
        /author-retrieved venue or literature grounding[^.\n]*frozen-material judgment/iu,
        /Include[^.\n]*grounding inspected above[^.\n]*frozen-material judgment/iu,
        /only those listed materials.*Read-only access.*no web, MCP, private author conversations, or unlisted files/iu,
        /isolated, persistent, recoverable reviewer context.*resume or rerun.*whole-paper rounds.*same review id and reviewer session/iu,
        /grounding is missing.*limit venue or literature conclusions.*runtime is unavailable.*without counting it as independent review/iu
      ], label);
      assertTextOrder(value, grounding, handoff, `${label} inspect grounding before frozen handoff`);
      assert.doesNotMatch(independent, /authoritative LaTeX source and compiled output/iu, `${label} must not require LaTeX for every handoff`);
      assert.match(independent, /Do not restart it to avoid prior objections/iu);
      const returned = renderedSection(value, "Returned review or existing context");
      assertInstruction(returned, /When the user supplies a `dove-review` return/iu, [
        /append the actual text faithfully.*same review id and round when known/iu,
        /Do not revise author artifacts, start a new review, rewrite the return, or add author interpretation unless asked/iu
      ], label);
      assert.match(returned, /Import and inspection do not automatically begin author response, revision, venue search, paper search, or a new handoff/iu);
      const delivery = renderedSection(value, "Delivery readiness");
      assert.match(delivery, /official venue (?:rules|requirements)/iu);
      assert.match(delivery, /delivery readiness separate(?:ly)? from scientific acceptability/iu);
      assertInstruction(delivery, /When delivery review is requested or genuinely limiting/iu, [
        /inspect[^.\n]*actual venue-facing package[^.\n]*requirements[^.\n]*report[^.\n]*delivery gaps/iu
      ], label);
      break;
    }
    case "dove.rebuttal": {
      assertInstruction(actions, /Read the Review document/iu, [
        /same review id and round.*reviewed material list.*current material state.*actual artifacts/iu,
        /each material finding.*source, experiment, method, analysis, expression, figure, or venue-fit problem.*requested revisions/iu,
        /new citations.*identity and inspected-content support through Source.*new results.*actual Experiment materials before using them.*Then draft the response/iu,
        /Do not rerun review for cosmetic or response-only edits.*rerun.*substantive evidence.*old recommendation no longer covers the current full version/iu
      ], label);
      const validation = assertInstruction(actions, /Check that each response and requested revision/iu, [
        /Propagate requested revisions.*build or export path.*inspect the output before claiming.*current/iu
      ], label);
      assertAuthoritativeManuscript(validation, label);
      assert.match(value, /Compare original claim, reviewer interpretation, planned response, and revised claim.*certainty, causality, scope, quantitative qualifiers, novelty, and contribution do not change silently/iu);
      assert.match(value, /Do not overwrite original returns|do not overwrite original returns/iu);
      break;
    }
    case "dove.lessons":
      assertInstruction(actions, /Read "\.dove\/research\/lessons\/LESSONS\.md"/u, [
        /directly relevant or plausibly useful/iu,
        /Reuse Lessons already read in the active context/iu,
        /Do not create or modify files during reading.*do not treat Lessons as evidence/iu
      ], label);
      assertInstruction(actions, /When an experience/iu, [
        /inspire current or subsequent work.*improve judgment.*expand the candidate space.*prevent repeated mistakes/iu,
        /preserve.*reusable insight and relevant conditions.*narrowest suitable researcher-owned Lessons document/iu,
        /Avoid recording routine progress, transient status/iu,
        /Do not create lesson IDs, frontmatter, an application ledger, or treat Lessons as evidence/iu
      ], label);
      break;
    default:
      assert.fail(`${label} needs an explicit capability wiring audit`);
  }
}

function assertWiringRejectsRegressions(entries) {
  const regressions = [
    ["dove.research", "reassess the original proposition against the result", "accept the completed subtask as success"],
    ["dove.source", "Partial support is not support for the whole sentence", "Partial support is support for the whole sentence"],
    ["dove.experiment", "save the prospective plan there before execution begins", "save the prospective plan there after execution finishes"],
    ["dove.experiment", "then append the actual procedure", "then replace the plan with the actual procedure"],
    ["dove.draft", "Only for a new manuscript", "For every existing manuscript"],
    ["dove.figure", "Render the actual figure and write its caption", "Render the actual figure without writing its caption"],
    ["dove.review", "grounding inspected above", "grounding merely found"],
    ["dove.review", "current independent `dove-review`", "historical author-side review"],
    ["dove.review", "same four full-paper questions above", "only the venue-fit question"],
    ["dove.review", "or start an independent handoff", "and start an independent handoff"],
    ["dove.rebuttal", "inspect the output before claiming", "claim without inspecting the output"],
    ["dove.status", "do not modify files", "repair the files"],
    ["dove.lessons", "do not treat Lessons as evidence", "treat Lessons as evidence"]
  ];
  for (const entry of entries) {
    for (const [id, before, after] of regressions.filter(([id]) => id === entry.command.id)) {
      const content = entry.content.replaceAll(before, after);
      assert.notEqual(content, entry.content, `${entry.hostId} ${id} regression probe must alter the instruction`);
      assert.throws(() => assertRenderedCapabilityWiring({ ...entry, content }), { code: "ERR_ASSERTION" }, `${entry.hostId} ${id} must reject ${after}`);
    }
    if (entry.command.id === "dove.experiment") {
      assertSemanticDeletionsRejected(entry.content, generatedSurfaceLabel(entry),
        (content) => assertRenderedCapabilityWiring({ ...entry, content }), [
          /each method's actual output/iu,
          /target object and granularity/iu,
          /justify any proxy/iu,
          /denominators/iu,
          /without silently retaining only the successful intersection/iu,
          /or automatically assigning every failure zero/iu,
          /same evaluation units/iu,
          /sample dependence/iu,
          /Protect final-test independence/iu,
          /actual code, configuration, and outputs/iu,
          /information access/iu,
          /training budget/iu,
          /numerical scale/iu,
          /edit magnitude/iu,
          /component's gain under the given control/iu,
          /repair the minimum necessary comparison or explicitly limit the conclusion/iu,
          /more runs do not repair identification/iu,
          /authorized useful exploration may continue/iu,
          /only when necessary and authorized/iu,
          /not population-level statistical sufficiency/iu,
          /without running diagnostics or experiments/iu,
          /do not impose/iu,
          /successfully saved/iu,
          /actual control differences/iu
        ]);
      const lines = entry.content.split("\n");
      const plan = lines.findIndex((line) => /^- Only for newly authorized central execution/u.test(line));
      const execution = lines.findIndex((line) => /^- Execute only when requested and permitted/u.test(line));
      assert.ok(plan >= 0 && execution > plan);
      [lines[plan], lines[execution]] = [lines[execution], lines[plan]];
      assert.throws(() => assertRenderedCapabilityWiring({ ...entry, content: lines.join("\n") }), { code: "ERR_ASSERTION" }, `${entry.hostId} must reject execution before prospective persistence even when every keyword remains`);
    }
  }
}

function assertGeneratedSurfaceLinkMaintenanceSemantics(entries) {
  const value = entries.map((entry) => entry.content).join("\n");
  assert.match(value, /ordinary Markdown links?/iu, "generated command surfaces must mention ordinary Markdown links");
  assert.match(value, /project-relative artifact paths?/iu, "generated command surfaces must mention project-relative artifact paths");
  assert.match(value, /when useful(?: for recovery)?|only when useful|useful for recovery/iu, "generated command surfaces must keep optional when-useful recovery semantics");

  assert.match(value, /human-readable notes?|human prose|not a structured (?:figure )?store/iu, "generated command surfaces must keep research notes natural rather than structured stores");
}

function assertRenderedSemanticSectionOrder(entry) {
  const sections = entry.command.contract?.semanticSections;
  if (!Array.isArray(sections) || sections.length === 0) return;
  let previousIndex = -1;
  for (const section of sections.filter((item) => item.title !== "Return with")) {
    const index = entry.content.indexOf(`### ${section.title}`);
    assert.ok(index > previousIndex, `${entry.command.id} generated adapter must render semantic section ${section.title} in contract order`);
    previousIndex = index;
  }
  const returnIndex = entry.content.lastIndexOf("### Return with");
  assert.ok(returnIndex > previousIndex, `${entry.command.id} generated adapter must render Return with last`);
}

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

function actualGeneratedFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function assertGeneratedFileMatches(relativePath, expectedContent) {
  assert.equal(actualGeneratedFile(relativePath), `${expectedContent.trimEnd()}\n`, `${relativePath} must match its canonical renderer`);
}

function assertTextOrder(value, first, second, label) {
  const firstIndex = value.indexOf(first);
  const secondIndex = value.indexOf(second);
  assert.ok(firstIndex >= 0, `${label} must include ${first}`);
  assert.ok(secondIndex > firstIndex, `${label} must mention ${second} after ${first}`);
}

function assertIdentityStates(value, label) {
  const normalized = value.toLowerCase().replace(/not-found/gu, "not found");
  for (const term of ["verified", "conflict", "not found", "unknown"]) {
    assert.ok(normalized.includes(term), `${label} must distinguish DOI identity state ${term}`);
  }
}

function assertNegativeOnlySourceStorageTerms(value, label) {
  const sentences = value.split(/\n+|(?<=\.)\s+/u).filter((sentence) => /\b(?:databases?|caches?|trust scores?|DOI ledgers?|BibTeX parsers?|research hashes?)\b/iu.test(sentence));
  assert.ok(sentences.length > 0, `${label} must explicitly reject source database/cache/trust-score machinery`);
  for (const sentence of sentences) {
    assert.match(sentence, /\b(?:do not|not add|avoid|no|must not)\b/iu, `${label} must mention source storage machinery only as a prohibition: ${sentence}`);
  }
}

function assertNoDoiIdentityFallbackOrFullTextConflation(value, label) {
  assert.doesNotMatch(value, /DOI[^.\n]{0,180}\bfallback\b|\bfallback\b[^.\n]{0,180}DOI/iu, `${label} must not attach fallback chains to DOI identity lookup`);
  assert.doesNotMatch(value, /direct DOI metadata lookup[^.\n]{0,180}(?:download_with_fallback|full[- ]text|database|cache|trust score|BibTeX)/iu, `${label} must keep direct DOI metadata lookup separate from full text and storage machinery`);
  assert.doesNotMatch(value, /metadata identity (?:verification|verified)[^.\n]{0,120}(?:means|establishes|proves|confirms)[^.\n]{0,120}(?:full[- ]text|claim support)/iu, `${label} must not turn metadata identity into full-text inspection or claim support`);
}

export function assertCanonicalTerminology() {
  assertNoAmbiguousRouteTerms([
    { label: "canonical rendered Dove agent instructions", content: renderDoveAgentInstructions() },
    { label: "canonical rendered Claude Dove agent", content: renderClaudeDoveAgent() },
    ...generatedDoveAgentEntries().map((entry) => ({ label: `generated Dove agent ${entry.relativePath}`, content: entry.content })),
    ...generatedAdapterEntries().map((entry) => ({ label: `generated ${entry.hostId} ${entry.command.id}`, content: entry.content })),
    ...generatedClaudeAmbientProjectEntries().map((entry) => ({ label: `ambient/support guidance ${entry.destinationPath}`, content: entry.content })),
    ...packageDocumentEntries()
  ]);
}

export function assertSourceIdentityGuidanceProjection() {
  const source = COMMAND_SURFACES.find((command) => command.id === "dove.source");
  assert.ok(source, "canonical Dove Source command must exist");
  const sourceWork = contractActions(source).find((item) => item.capability === "source-research");
  assert.ok(sourceWork, "canonical Dove Source must include source-research work");
  assertTextOrder(sourceWork.instruction, "direct DOI lookup", "fuzzy title search", "canonical Source DOI identity guidance");
  assertIdentityStates(source.contract.responsibilities.join("\n"), "canonical Source DOI identity guidance");
  assert.match(sourceWork.instruction, /failed lookup is unknown/iu, "canonical Source must classify failed lookup as unknown");
  assert.match(sourceWork.instruction, /Metadata identity is not full-text inspection or claim support/iu, "canonical Source must separate metadata identity from full text and claim support");
  assert.match(source.contract.boundaries.join("\n"), /transient by default.*Source notes or bibliography entries.*materially affect/isu, "canonical Source must keep DOI checks transient by default");
  assert.match(source.contract.responsibilities.join("\n"), /bounded bibliography DOI identity check.*only the requested entries/isu, "canonical Source must permit requested bounded bibliography checks");
  assert.doesNotMatch(source.contract.nonGoals.join("\n"), /Do not batch-scan bibliographies/iu, "canonical Source must not prohibit its bounded bibliography capability");
  assert.match(source.contract.nonGoals.join("\n"), /BibTeX parsers/iu, "canonical Source must reject BibTeX parser machinery");

  const sourceEntries = generatedAdapterEntries().filter((entry) => entry.command.id === "dove.source");
  assert.equal(sourceEntries.length, PROJECT_HOST_IDS.length, "Dove Source must project to each host exactly once");
  for (const entry of sourceEntries) {
    assertGeneratedFileMatches(entry.relativePath, entry.content);
    assert.equal(entry.content, renderCommandAdapter(entry.hostId, source), `${entry.relativePath} must be rendered from the canonical Source command`);
    assert.ok(entry.content.includes(sourceWork.instruction), `${entry.relativePath} must contain the canonical Source DOI instruction`);
    assertNoDoiIdentityFallbackOrFullTextConflation(entry.content, entry.relativePath);
    assertNegativeOnlySourceStorageTerms(entry.content, entry.relativePath);
  }

  const paperSearchEntry = generatedClaudeAmbientProjectEntries().find((entry) => entry.destinationPath === PAPER_SEARCH_SUPPORT_SKILL_PATH);
  assert.ok(paperSearchEntry, "hidden paper-search support guidance must be generated");
  assert.equal(paperSearchEntry.content, renderPaperSearchSupportSkill(), "hidden paper-search guidance must come from paper-search integration");
  assertGeneratedFileMatches(packageResourcePath("claude", PAPER_SEARCH_SUPPORT_SKILL_PATH), paperSearchEntry.content);
  assertTextOrder(paperSearchEntry.content, "get_crossref_paper_by_doi", "fuzzy title search", "paper-search DOI identity guidance");
  assertIdentityStates(paperSearchEntry.content, "paper-search DOI identity guidance");
  assert.match(paperSearchEntry.content, /empty result is not-found/iu, "paper-search guidance must classify empty DOI lookup as not-found");
  assert.match(paperSearchEntry.content, /MCP, permission, or network failure is unknown/iu, "paper-search guidance must classify MCP and network failure as unknown");
  assert.match(paperSearchEntry.content, /Metadata identity is not full-text inspection or claim support/iu, "paper-search guidance must separate metadata identity from full text and claim support");
  assert.match(paperSearchEntry.content, /Inspect actual paper content before saying it supports a scientific claim/iu, "paper-search guidance must require actual content for claim support");
  assert.match(paperSearchEntry.content, /Update an ordinary Source note or bibliography only when.*materially changes/isu, "paper-search guidance must keep DOI checks transient unless material");
  assert.match(paperSearchEntry.content, /bounded bibliography DOI identity check.*requested entries in the current manuscript/isu, "paper-search must support bounded manuscript bibliography checks");
  assert.doesNotMatch(paperSearchEntry.content, /Do not batch-scan bibliographies/iu, "paper-search must not forbid the requested bounded check");
  assertNoDoiIdentityFallbackOrFullTextConflation(paperSearchEntry.content, "paper-search guidance");
  assertNegativeOnlySourceStorageTerms(paperSearchEntry.content, "paper-search guidance");
}

export function assertGeneratedAdapters() {
  const entries = generatedAdapterEntries();
  const agentEntries = generatedDoveAgentEntries();
  assert.equal(entries.length, COMMAND_SURFACES.length * PROJECT_HOST_IDS.length);
  assertGeneratedSurfaceLinkMaintenanceSemantics(entries);
  assertWiringRejectsRegressions(entries);
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
    assert.match(entry.content, /### When to use\n\n/u);
    assert.match(entry.content, /### Scope and changes\n\n/u);
    assert.match(entry.content, /### Using host tools\n\n/u);
    assertGeneratedSurfaceUsesCurrentRenderer(entry);
    assertRenderedActions(entry);
    assertRenderedCapabilityWiring(entry);

    if (Array.isArray(contract.semanticSections) && contract.semanticSections.length > 0) {
      assertRenderedSemanticSectionOrder(entry);
      assert.doesNotMatch(entry.content, /^#### /mu, "semantic command adapters should not reintroduce nested renderer labels");
    } else {
      if (contract.responsibilities.length > (contract.returnWith?.length ?? 0)) assert.match(entry.content, /### What Dove will examine\n\n/u);
      if (contract.actions.length > 0) assert.match(entry.content, /### Ways Dove may proceed\n\n/u);
      if (contract.nonGoals.length > 0) assert.match(entry.content, /### What this should not replace\n\n/u);
    }
    if (contract.clarification.length > 0) assert.match(entry.content, /### When Dove needs input\n\n/u);

    assert.match(entry.content, /### Return with\n\n/u, "Skill adapters must end with the concise Return with footer");
    assert.ok(entry.content.lastIndexOf("### Return with") > entry.content.indexOf("### Using host tools"), `${entry.command.id} Return with footer must appear near the end`);
    if (entry.hostId === "claude") {
      assert.match(entry.content, /argument-hint:/u, "Claude command adapters may expose an argument hint");
      const argumentMatches = entry.content.match(/\$ARGUMENTS/gu) ?? [];
      assert.equal(argumentMatches.length, 1, `${entry.relativePath} must include $ARGUMENTS exactly once`);
    }
    if (entry.hostId === "dsh") {
      assert.doesNotMatch(entry.content, /\$ARGUMENTS|argument-hint:|\/dove:|<[^>]+>/u, "DSH filesystem Skills must not advertise Claude command arguments or placeholder syntax");
    }
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

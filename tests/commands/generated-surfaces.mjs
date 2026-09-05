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
  assertUnique,
  contractActions,
  skillContract
} from "./common.mjs";

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
  for (const item of contractActions(entry.command)) {
    assert.ok(entry.content.includes(item.instruction), `${label} must render ${entry.command.id} action instruction without exposing its internal capability id`);
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

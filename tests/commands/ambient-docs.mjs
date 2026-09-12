import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { renderProjectIntegrationResult } from "../../src/cli/project-integration-output.mjs";
import { renderDoveHome } from "../../src/cli/terminal-output.mjs";
import { renderClaudeDoveAgent } from "../../src/core/dove-agent-definition.mjs";
import { renderDoveAuthorStanceSection, renderDoveReviewerStanceSection, renderDoveSharedResearchContractSection } from "../../src/core/dove-agent-persona.mjs";
import { DOVE_RESEARCH_QUALITY_CRITERIA, DOVE_RESEARCH_QUALITY_REFERENCE_PATHS, renderDoveResearchQualityReference } from "../../src/core/dove-research-contract.mjs";
import { USER_RESPONSE_POLICY } from "../../src/core/user-response-policy.mjs";
import { RESEARCH_DEFAULT_DIRECTORY_PATHS, RESEARCH_DEFAULT_DOCUMENTS, RESEARCH_DEFAULT_PATHS } from "../../src/core/research-defaults.mjs";
import { PAPER_SEARCH_MCP_FRAGMENT, PAPER_SEARCH_PACKAGE_SPECIFIER, PAPER_SEARCH_SUPPORT_SKILL_PATH } from "../../src/core/paper-search-integration.mjs";
import { EXA_MCP_FRAGMENT, EXA_WEB_SUPPORT_SKILL_PATH, WEB_FETCH_DENY_PERMISSION } from "../../src/core/web-access-integration.mjs";
import { generatedAdapterEntries, generatedClaudeAmbientProjectEntries } from "../../scripts/generate-command-adapters.mjs";
import { ROOT, assertDoveAgentRoleSemantics, assertMatchesAll, assertSharedResearchContractOnce } from "./common.mjs";

export function assertUserResponsePolicy(value, label) {
  assertMatchesAll(value, label, [/natural Chinese/iu, /precedence/iu, /plain language/iu, /substantive progress/iu, /End naturally/iu]);
}

const QUALITY_DIMENSIONS = [
  /Problem value/iu, /Novelty/iu, /Mechanism and theory quality/iu,
  /Method quality and feasibility/iu, /Data and evaluation quality/iu,
  /Implementation quality/iu, /Experiment and evidence value/iu,
  /Expression and delivery quality/iu
];

export function assertSharedResearchJudgment(value, label) {
  assert.ok(value.includes(renderDoveSharedResearchContractSection()), `${label}: canonical short-core projection`);
  assertMatchesAll(value, label, [
    ...QUALITY_DIMENSIONS,
    /substantive quality/iu, /evidence and judgment confidence/iu,
    /current-use sufficiency/iu, /work-completion facts/iu,
    /unknown/iu, /joint necessary conditions/iu,
    /proactively read/iu, /full quality reference/iu, /substantive grading/iu,
    /material route selection/iu, /major investment/iu, /experiment scale-up/iu,
    /core-claim/iu, /submission-completion/iu, /decisive counterevidence/iu,
    /task-identity changes/iu, /cross-dimensional tradeoffs/iu,
    /checklist/iu, /already-read guidance/iu,
    /unavailable/iu, /task continuity/iu,
    /refutation/iu, /user's decision/iu,
    /same granularity/iu, /upper-bound limits/iu, /invalid evaluation/iu,
    /scientific advance/iu, /engineering support/iu, /read-only requests/iu
  ]);
}

export function assertQualityReference() {
  const reference = renderDoveResearchQualityReference();
  // Protect coverage and canonical projection without parsing punctuation, level
  // counts, or adjective order into an executable grading scheme.
  assertMatchesAll(reference, "Full reference", QUALITY_DIMENSIONS);
  for (const criterion of DOVE_RESEARCH_QUALITY_CRITERIA) assert.ok(reference.includes(criterion));
  assertMatchesAll(reference, "Full reference domain guidance", [
    /subtracting covered contributions/iu, /counterexamples/iu,
    /joint conditions/iu, /final-test boundaries/iu, /unknown, failed, and not applicable/iu,
    /do not average ordinal levels/iu, /Auxiliary scoring is allowed/iu,
    /normal|same confirmed problem/iu, /provisional candidate/iu,
    /without waiting for approval/iu, /negative result/iu,
    /no-ground|do not demand a theorem/iu, /not scientific acceptance/iu,
    /grants no tool or material access/iu
  ]);
  const core = renderDoveSharedResearchContractSection();
  assertSharedResearchJudgment(core, "Short core");
  assert.ok(core.length < reference.length / 2, "The standing core is smaller than the on-demand reference");
  for (const criterion of DOVE_RESEARCH_QUALITY_CRITERIA) assert.ok(!core.includes(criterion));
}

export function assertSharedAuthorStance(value, label) {
  assert.ok(value.includes(renderDoveAuthorStanceSection()), `${label}: canonical author stance projection`);
  assertMatchesAll(value, label, [/mainline/iu, /delegation/iu, /objections/iu, /read-only/iu, /authorization/iu, /submission-completion/iu]);
}

export function assertAmbientRouting() {
  const entries = generatedClaudeAmbientProjectEntries();
  assert.deepEqual(entries.map(({ destinationPath }) => destinationPath), [".claude/rules/dove.md", PAPER_SEARCH_SUPPORT_SKILL_PATH, EXA_WEB_SUPPORT_SKILL_PATH]);
  const byPath = new Map(entries.map(({ destinationPath, content }) => [destinationPath, content]));
  const rule = byPath.get(".claude/rules/dove.md");
  assertSharedResearchJudgment(rule, "Claude rule");
  assertSharedAuthorStance(rule, "Claude rule");
  assertUserResponsePolicy(rule, "Claude rule");
  assert.ok(rule.includes(DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.claude));
  assert.match(rule, /DOCTOR\.md/u);
  assert.match(rule, /Lessons/u);
  for (const resourcePath of [PAPER_SEARCH_SUPPORT_SKILL_PATH, EXA_WEB_SUPPORT_SKILL_PATH]) {
    const support = byPath.get(resourcePath);
    assert.match(support, /user-invocable: false/u);
    assert.match(support, /permissions permit/iu);
    assert.match(support, /material or action/iu);
  }
  assert.match(byPath.get(PAPER_SEARCH_SUPPORT_SKILL_PATH), /use_scihub: false/u);
  assert.deepEqual(PAPER_SEARCH_MCP_FRAGMENT, { type: "stdio", command: "uvx", args: ["--from", PAPER_SEARCH_PACKAGE_SPECIFIER, "paper-search-mcp"] });
  assert.deepEqual(EXA_MCP_FRAGMENT, { url: "https://mcp.exa.ai/mcp", type: "http" });
  assert.equal(WEB_FETCH_DENY_PERMISSION, "WebFetch");
  for (const entry of generatedAdapterEntries()) {
    if (entry.hostId === "claude") {
      assert.equal(entry.content.includes("## Shared researcher judgment"), false);
      assert.equal(entry.content.includes("## Author stance"), false);
    } else {
      assertSharedResearchJudgment(entry.content, entry.command.id);
      assert.ok(entry.content.includes(DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.dsh));
      assertUserResponsePolicy(entry.content, entry.command.id);
      if (entry.command.id === "dove.status") {
        assert.equal(entry.content.includes("## Author stance"), false);
        assert.match(entry.content, /only to inspect and report/iu);
      } else assertSharedAuthorStance(entry.content, entry.command.id);
    }
  }
}

export function assertPackagedAgentPolicy() {
  const agent = renderClaudeDoveAgent();
  assertDoveAgentRoleSemantics(agent, "Packaged agent");
  const rule = generatedClaudeAmbientProjectEntries().find(({ destinationPath }) => destinationPath === ".claude/rules/dove.md").content;
  const context = `${rule}\n\n${agent}`;
  assertSharedResearchContractOnce(context, "Rule + agent");
  assertSharedAuthorStance(context, "Rule + agent");
  for (const instruction of USER_RESPONSE_POLICY) assert.equal(context.split(instruction).length - 1, 1);
  const reviewer = renderDoveReviewerStanceSection();
  assertMatchesAll(reviewer, "Reviewer duties", [
    /frozen materials/iu, /recommending author-side work/iu,
    /Do not establish missing grounding/iu, /listed frozen materials/iu,
    /full quality reference/iu, /package guidance/iu, /not evidence/iu,
    /Retain your own review history/iu, /complete current frozen version/iu,
    /strongest reasonable objection/iu, /requested scope/iu
  ]);
  assert.equal(reviewer.includes("## Author stance"), false);
}

export function assertPublicDocumentationBoundaries() {
  const read = (name) => fs.readFileSync(path.join(ROOT, "docs", name), "utf8");
  const usage = read("USAGE.md");
  const installation = read("INSTALL.md");
  const packaging = read("PACKAGING.md");
  for (const document of [usage, installation, packaging]) {
    assert.match(document, /RESEARCH_QUALITY\.md/u);
    assert.match(document, /read-only/iu);
  }
  for (const state of ["uninitialized", "current", "needs-update", "blocked"]) assert.ok(installation.includes(`\`${state}\``));
  assertMatchesAll(usage, "Usage", [/same Dove/iu, /bounded/iu, /real manuscript context/iu, /LaTeX/iu, /dove run/u, /not independent external review/iu]);
  assertMatchesAll(packaging, "Packaging", [/generated adapters/iu, /release validation/iu, /cannot prove/iu, /rollback/iu]);
}

export function assertUserFacingCliOutput() {
  assert.match(renderDoveHome({ state: "current" }), /进入支持的宿主/u);
  assert.match(renderDoveHome({ state: "needs-update" }), /dove update/u);
  for (const hosts of [["claude"], ["dsh"]]) {
    const output = renderProjectIntegrationResult("init", { status: "initialized", target: "/workspace/example-project", hosts, writtenPaths: [], removedPaths: [], changedPaths: [] });
    if (hosts.includes("claude")) {
      assert.match(output, /直接提出科研请求/u);
      assert.match(output, /SessionStart/u);
      assert.match(output, /状态栏空缺时/u);
      assert.match(output, /WebFetch/u);
    } else {
      assert.match(output, /filesystem Skills/u);
      assert.equal(output.includes("Exa MCP"), false);
    }
  }
}

export function assertResearchDefaultsOwnership() {
  assert.deepEqual(RESEARCH_DEFAULT_DOCUMENTS.map(({ path: documentPath }) => documentPath), [RESEARCH_DEFAULT_PATHS.overview]);
  assert.deepEqual(RESEARCH_DEFAULT_DIRECTORY_PATHS, [RESEARCH_DEFAULT_PATHS.root]);
  assert.match(RESEARCH_DEFAULT_DOCUMENTS[0].content, /researcher-owned entry/iu);
}

export function assertTrellisSpecMirrors() {
  for (const layer of ["frontend", "guides"]) {
    const source = path.join(ROOT, ".trellis/spec", layer);
    const template = path.join(ROOT, "src/templates/markdown/spec", layer);
    const names = (dir) => fs.readdirSync(dir).filter((name) => name.endsWith(".md")).sort();
    assert.deepEqual(names(template), names(source));
    for (const name of names(source)) assert.ok(fs.readFileSync(path.join(source, name)).equals(fs.readFileSync(path.join(template, name))), `${layer}/${name}`);
  }
}

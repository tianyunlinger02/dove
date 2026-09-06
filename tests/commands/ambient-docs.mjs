import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { renderProjectIntegrationResult } from "../../src/cli/project-integration-output.mjs";
import { renderDoveHome } from "../../src/cli/terminal-output.mjs";
import { renderClaudeDoveAgent } from "../../src/core/dove-agent-definition.mjs";
import { renderDoveReviewerStanceSection, renderDoveSharedResearchContractSection } from "../../src/core/dove-agent-persona.mjs";
import { USER_RESPONSE_POLICY } from "../../src/core/user-response-policy.mjs";
import {
  RESEARCH_DEFAULT_DIRECTORY_PATHS,
  RESEARCH_DEFAULT_DOCUMENTS,
  RESEARCH_DEFAULT_PATHS,
  RESEARCH_LESSON_TOPICS,
  planResearchDefaults
} from "../../src/core/research-defaults.mjs";
import {
  PAPER_SEARCH_MCP_FRAGMENT,
  PAPER_SEARCH_PACKAGE_SPECIFIER,
  PAPER_SEARCH_SUPPORT_SKILL_PATH
} from "../../src/core/paper-search-integration.mjs";
import {
  EXA_MCP_FRAGMENT,
  EXA_WEB_SUPPORT_SKILL_PATH,
  WEB_FETCH_DENY_PERMISSION
} from "../../src/core/web-access-integration.mjs";
import { generatedAdapterEntries, generatedClaudeAmbientProjectEntries } from "../../scripts/generate-command-adapters.mjs";
import { ROOT, assertDoveAgentSurfaceSemantics } from "./common.mjs";

const EXPECTED_AMBIENT_PATHS = [
  ".claude/rules/dove.md",
  PAPER_SEARCH_SUPPORT_SKILL_PATH,
  EXA_WEB_SUPPORT_SKILL_PATH
];

function assertSharedResearchJudgment(value, label) {
  for (const pattern of [
    /Before committing to or materially changing.*direction, method, hypothesis, evaluation target, or central experiment.*(?:theory|mechanism) grounding proportionate to the decision/isu,
    /assumptions.*applicability.*testable predictions.*failure conditions.*alternative explanations/isu,
    /When external knowledge can change the judgment.*inspect.*targeted theory or related work.*grounded recommendation/isu,
    /If grounding is insufficient.*targeted reading, derivation, or explicitly exploratory diagnostics.*hypotheses and routes may remain provisional/isu,
    /Reuse sufficient inspected grounding rather than repeatedly searching literature/iu,
    /debugging and local operations do not require a full theory review/iu,
    /contribution, mechanism, novelty, and positioning.*method validity.*evidence quality.*argument, writing, and figures.*delivery last/isu,
    /highest-level active limitation.*trace it to.*method, evidence, experiment, analysis, source, figure, argument, or artifact.*change that judgment/isu,
    /scientific value.*result quality.*time.*resources.*opportunity cost.*rework risk.*downstream effects.*whole research path/isu,
    /small discriminating diagnostic or source check.*decide between routes before larger work/iu,
    /Before treating unstable, irreproducible, anomalously bad, or unusually strong results as evidence.*inspect the implementation, data, configuration, environment, randomness, metrics, analysis scripts, and interpretation/isu,
    /Citation identity, full-text inspection, and support for a claim are separate judgments/iu,
    /claim strength within the evidence.*generality, quantitative qualifiers, and novelty/isu,
    /include material counterevidence rather than selecting only supportive results/iu,
    /Recheck earlier summaries.*against current materials.*rather than treating them as proof.*revise optimistic judgments.*broader evidence or grounded Review contradicts them/isu,
    /Answer and stop for pure judgment or bounded requests.*only exposed, permitted host tools/isu
  ]) assert.match(value, pattern, `${label}: shared judgment boundary ${pattern}`);
  assert.doesNotMatch(value, /always (?:search|retrieve|review) (?:the )?literature|(?:complete|exhaustive) theory review before (?:any|every) (?:action|diagnostic)/iu, `${label}: theory must not become an execution gate`);
}

function assertSharedAuthorStance(value, label) {
  for (const pattern of [
    /user-confirmed Workspace mainline, intended contribution.*completion meaning.*material change to that anchor belongs to the user/isu,
    /direction is open.*clearly provisional research question or route/isu,
    /active confirmed research context.*feasible next in-scope step.*continue while an effective mainline action remains/isu,
    /Read-only requests authorize inspection and reporting, not execution or recording/iu,
    /Before narrowing a contribution, first try any feasible in-mainline.*(?:method|experiment).*could support it.*only when inspected evidence or a real limit requires it/isu,
    /user confirmation.*changes the confirmed mainline or completion meaning/iu,
    /limits on actions, not automatic limits on the research mainline.*one path is blocked.*other effective in-mainline paths before calling the research blocked/isu,
    /user-confirmed submission-completion goal.*author-side scientific sufficiency.*current independent `dove-review`.*same full version.*real delivery readiness/isu,
    /Unavailable isolated review leaves that requirement unmet, not waived/iu,
    /bounded local review, edit, figure, or other task can finish without becoming a submission-completion goal/iu
  ]) assert.match(value, pattern, `${label}: author boundary ${pattern}`);
}

export function assertAmbientRouting() {
  const entries = generatedClaudeAmbientProjectEntries();
  assert.deepEqual(entries.map((entry) => entry.destinationPath), EXPECTED_AMBIENT_PATHS);
  const byPath = new Map(entries.map((entry) => [entry.destinationPath, entry.content]));
  const rule = byPath.get(".claude/rules/dove.md");
  const paperSearch = byPath.get(PAPER_SEARCH_SUPPORT_SKILL_PATH);
  const webReader = byPath.get(EXA_WEB_SUPPORT_SKILL_PATH);
  assert.match(rule, /shared researcher judgment/iu);
  assert.match(rule, /one complete (?:Dove )?research agent|same research collaboration/iu);
  assert.match(rule, /nine Skills.*(?:same research collaboration|current decision|optional specialist methods)|optional specialist capabilities/isu);
  assert.match(rule, /research requests in the current conversation/iu);
  assert.match(rule, /answer, clarify, or use a Dove capability when useful/iu);
  assert.match(rule, /Ask when ambiguity would change the next useful action/iu);
  assertSharedResearchJudgment(rule, "Ordinary Claude rule");
  assertSharedAuthorStance(rule, "Ordinary Claude rule");
  assert.equal((rule.match(/^## Author stance$/gmu) ?? []).length, 1, "Ordinary Claude uses one shared author section");
  assert.match(rule, /real paper and webpage reading tools/iu);
  assert.match(rule, /search snippets can guide discovery/iu);
  assert.match(rule, /do not replace unretrieved paper or webpage content with shell, `curl`, or ad hoc fetch substitutes/iu);
  assert.match(rule, /Record concise natural-language notes in `\.dove\/install\/DOCTOR\.md` only for explicit feedback about Dove itself or actual Dove integration, routing, Skill, document, or guidance failures/iu);
  assert.match(rule, /Preserve reusable ordinary research or collaboration experience as Lessons instead/iu);
  assert.doesNotMatch(rule, /hidden `dove-intake`|dove-intake|UserPromptSubmit.*zero-write|Stop hook|Stop-hook|Stop does not drive|plain-language rendering path|说人话/iu);
  assert.doesNotMatch(rule, /dove-paper-search|hosted `exa`|built-in `WebFetch`|built-in `WebSearch`|MCP|severity fields|fixed template|Do not ask the user to run `dove doctor`/iu);
  assert.doesNotMatch(entries.map((entry) => entry.destinationPath).join("\n"), /dove-intake/iu);
  assert.doesNotMatch(rule, /dove-lessons-intake|manage_dove|public Dove MCP|semantic ID/iu);
  assert.match(paperSearch, /user-invocable: false/u);
  assert.match(paperSearch, /Search, verify metadata, retrieve, and read academic papers through the pinned dove-paper-search project MCP/iu);
  assert.match(paperSearch, /academic paper discovery, metadata verification, retrieval, or full-text reading materially helps/iu);
  assert.match(paperSearch, /get_crossref_paper_by_doi/u);
  assert.match(paperSearch, /direct lookup before fuzzy title search/iu);
  assert.match(paperSearch, /verified, conflict, not-found, or unknown/iu);
  assert.match(paperSearch, /Metadata identity is not full-text inspection or claim support/iu);
  assert.match(paperSearch, /use_scihub: false/u);
  assert.match(paperSearch, /current host actually exposes and current user\/project permissions permit/iu);
  assert.match(paperSearch, /academic paper discovery, metadata lookup, download, or full text was not obtained through `dove-paper-search`/iu);
  assert.match(paperSearch, /choose any exposed and permitted material or action that can still advance the question: `WebSearch` discovery snippets, Exa ordinary webpage\/documentation\/venue\/known-URL text when exposed, local project material, user-provided material, theory, experiment, or analysis/iu);
  assert.match(paperSearch, /Do not install dependencies or substitute a CLI, shell, `curl`, or ad hoc fetch script for this MCP, and do not follow a fixed substitute sequence/iu);
  assert.match(paperSearch, /Use built-in `WebSearch` for discovery when appropriate/iu);
  assert.match(paperSearch, /project `exa` MCP for ordinary webpages and known URLs/iu);
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

  for (const entry of generatedAdapterEntries()) {
    if (entry.hostId === "claude") {
      assert.doesNotMatch(entry.content, /^## (?:Shared researcher judgment|Author stance)$/mu, "Claude commands must not duplicate the ambient sections");
      continue;
    }
    assertSharedResearchJudgment(entry.content, `${entry.command.id} DSH projection`);
    assert.doesNotMatch(entry.content, /\.claude\/rules|claude --agent|ambient rule/iu, "DSH must not depend on Claude-only researcher context");
    assert.equal((entry.content.match(/^## Research judgment$/gmu) ?? []).length, 1, "DSH uses one compact shared section");
    assert.equal((entry.content.match(/Before committing to or materially changing/gu) ?? []).length, 1, "DSH must not repeat theory text already supplied by a capability");
    if (entry.command.id === "dove.status") {
      assert.match(entry.content, /For Status.*only to inspect and report.*do not execute research actions or maintain documents/isu);
      assert.doesNotMatch(entry.content, /^## Author stance$|first try any feasible in-mainline|perform the feasible next in-scope step|Maintain Dove research Markdown/mu, "Status must not receive author execution or maintenance duties");
    } else {
      assertSharedAuthorStance(entry.content, `${entry.command.id} DSH projection`);
      const authorSection = entry.content.split("## Author stance\n")[1].split(/\n## /u)[0];
      assert.doesNotMatch(authorSection, /Maintain Dove research Markdown|Author-side Review is Dove's own/iu, "Compact author context leaves specialist recording and review operations to the capability");
    }
  }
}

export function assertPackagedAgentPolicy() {
  const agentText = renderClaudeDoveAgent();
  assert.ok(USER_RESPONSE_POLICY.length > 0);
  assertDoveAgentSurfaceSemantics(agentText, "Packaged Dove agent");
  assertSharedResearchJudgment(agentText, "Explicit and bounded Dove agent");
  assertSharedAuthorStance(agentText, "Explicit and bounded Dove agent");
  assert.match(agentText, /explicit main research agent.*--agent dove.*bounded independent subagent.*do not delegate work needing the full user conversation, important clarification, or ongoing author-side mainline ownership/isu);
  assert.doesNotMatch(agentText, /actual Skill call to `dove:review`|latest material state receives a current Review `PASS`|Review gate/iu);
  assert.doesNotMatch(agentText, /Keep three primary roles distinct|Planner frames|Builder\/Author performs|Reviewer returns/iu);

  const reviewer = renderDoveReviewerStanceSection();
  const prompt = `${renderDoveSharedResearchContractSection()}\n\n${reviewer}`;
  assert.match(prompt, /grounding proportionate to the decision/iu);
  assert.match(prompt, /Before treating.*unusually strong results as evidence/iu);
  for (const pattern of [
    /shared theory, validity, and action-selection principles only to judging the frozen materials and recommending author-side work/iu,
    /Do not establish missing grounding through new research, run diagnostics, execute experiments, or perform author revisions/iu,
    /Reconstruct and challenge the contribution from the frozen materials.*do not inherit or endorse the author's mainline/isu,
    /read-only and limited to the listed frozen materials/iu,
    /Do not use.*web tools, shell commands, Edit, Write, Bash, MCP, or any unlisted path/isu,
    /not include enough venue rules or literature grounding.*judgment is limited instead of fetching or inferring it/isu,
    /complete current manuscript.*not only a diff/isu,
    /does the method answer the research question.*correct for the field.*fit the target venue.*strongest reasonable objection/isu,
    /Keep a bounded local review within its requested scope/iu,
    /Verdict, Blocking issues, Grounding basis, and Author-side next actions/iu
  ]) assert.match(reviewer, pattern);
  assert.doesNotMatch(prompt, /^## Author stance$|first try any feasible in-mainline|perform the feasible next in-scope step|Maintain Dove research Markdown/mu);
}

export function assertPublicDocumentationBoundaries() {
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
  assert.match(usage, /generation.*revision.*checking|best available tool|draw.*generate.*revise.*inspect/isu);
  assert.match(usage, /LaTeX source/iu);
  assert.match(usage, /unless the target venue requires another format|venue.*(?:does not provide or accept|lacks|required|requires).*LaTeX/isu);
  assert.match(packaging, /generated adapters/iu);
  assert.match(packaging, /release validation/iu);
  assert.match(packaging, /run receipt behavior|\.dove\/runs|dove run/iu);
  assert.match(packaging, /cannot prove that Dove chose or performed the right research action/iu);
  assert.doesNotMatch(packaging, /Review gate|actual `dove-review` actually ran|runtime Skill call/iu);
}

export function assertUserFacingCliOutput() {
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
  assert.match(initOutput, /SessionStart hook 与 WebFetch 禁用/u);
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

export function assertResearchDefaultsOwnership() {
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

export function assertTrellisSpecMirrors() {
  const sourceDir = path.join(ROOT, ".trellis/spec/frontend");
  const templateDir = path.join(ROOT, "src/templates/markdown/spec/frontend");
  const sourceNames = fs.readdirSync(sourceDir).filter((name) => name.endsWith(".md")).sort();
  const templateNames = fs.readdirSync(templateDir).filter((name) => name.endsWith(".md")).sort();
  assert.deepEqual(templateNames, sourceNames);
  for (const name of sourceNames) assert.ok(fs.readFileSync(path.join(templateDir, name)).equals(fs.readFileSync(path.join(sourceDir, name))), name);
}

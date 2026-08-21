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
  renderClaudeDoveAgent,
  renderOpenCodeDoveAgent
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
const EXPECTED_HOST_IDS = ["opencode", "codex", "cursor", "agents", "claude"];
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
    claude: ".claude/agents/dove.md",
    opencode: ".opencode/agents/dove.md"
  });
  assert.deepEqual(PACKAGE_GENERATED_SUPPORT_PATHS.filter((pathName) => pathName.includes("/agents/dove.md")), [
    ".claude/agents/dove.md",
    ".opencode/agents/dove.md"
  ]);

  const persona = DOVE_AGENT_PERSONA_BULLETS.join("\n");
  assert.ok(persona.includes(DOVE_AGENT_FRAME));
  assert.ok(persona.includes(DOVE_AGENT_CURIOSITY));
  assert.ok(persona.includes(DOVE_AGENT_STOPPING));
  assert.ok(DOVE_AGENT_PERSONA_BULLETS.length >= 5, "Dove persona must remain substantive without becoming a workflow checklist");
  assert.match(DOVE_AGENT_DIRECT_JUDGMENT, /weigh current evidence, task risk, user preference, and the research mainline/iu);
  assert.match(DOVE_AGENT_DIRECT_JUDGMENT, /stop without executing, recording, launching subagents, or creating tasks unless the user explicitly asks/iu);

  for (const textValue of [renderDoveAgentInstructions(), renderClaudeDoveAgent(), renderOpenCodeDoveAgent()]) {
    for (const bullet of DOVE_AGENT_PERSONA_BULLETS) assert.ok(textValue.includes(bullet), "Dove agent surface must include every canonical persona bullet");
    assert.match(textValue, /one complete research agent/iu);
    assert.match(textValue, /flat Dove commands are capability entrances/iu);
    assert.match(textValue, /Maintain Dove research Markdown only when the user explicitly asks to record, update, or save/iu);
    assert.match(textValue, /Auto is the same Dove persona under explicit multi-round autonomy/iu);
    assert.doesNotMatch(textValue, /planner.*builder.*reviewer.*three roles|user-switchable.*planner|Planner.*Builder\/Author.*Reviewer/isu);
  }

  const agentEntries = generatedDoveAgentEntries();
  assert.deepEqual(agentEntries.map((entry) => entry.relativePath), [DOVE_AGENT_SURFACES.claude, DOVE_AGENT_SURFACES.opencode]);
  assert.equal(agentEntries[0].content, renderClaudeDoveAgent());
  assert.equal(agentEntries[1].content, renderOpenCodeDoveAgent());
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
        if (step.readOnly) assert.equal(step.persistWhen, "never", `${label}/${mode.id} read-only steps cannot maintain research Markdown`);
        if (step.persistWhen !== "never") assert.equal(step.capability, "research-document-maintenance", `${label}/${mode.id} persistence is only for optional research Markdown maintenance`);
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
  assert.match(sourceWork.instruction, /retrieve, save when useful, read, and verify/iu);
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
  assert.match(designInstruction, /project material.*relevant sources.*smaller diagnostic/iu);
  assert.match(designInstruction, /do not invent a substitute experiment/iu);
  assert.ok(designInstruction.indexOf("real problem") < designInstruction.indexOf("For a new experiment"), "Experiment purpose must precede experiment planning");
  assert.match(experimentText, /design-only.*stop before execution/isu);
  assert.match(experimentText, /analysis of existing results.*directly/isu);
  assert.match(experimentText, /retrospective.*rather than.*prospective/isu);
  assert.match(experimentText, /actual procedure, result, and any deviation that changes the interpretation/isu);
  assert.doesNotMatch(experimentText, /denominator accounting|supports and cannot establish|actual provenance/iu);

  const review = COMMAND_SURFACE_BY_ID["dove.review"];
  const reviewText = text(review);
  assert.equal(review.workflow.status, "user-managed-review-document");
  assert.match(reviewText, /separate reviewer chosen and managed by the user/iu);
  assert.match(reviewText, /prepare a new review/iu);
  assert.match(reviewText, /import a returned review/iu);
  assert.match(reviewText, /inspect existing review context/iu);
  assert.match(reviewText, /use Rebuttal for substantive response, revision, and follow-up work/isu);
  assert.doesNotMatch(reviewText, /ReviewExchange|reviewId|findingId|verdictEnum|strictImportSchema/u);

  const lessons = COMMAND_SURFACE_BY_ID["dove.lessons"];
  const lessonsText = text(lessons);
  assert.match(lessonsText, /researcher-owned Lessons documents/iu);
  assert.match(lessonsText, /Do not write project-specific guidance into package-managed built-in Lessons themes/iu);
  assert.doesNotMatch(lessonsText, /maintain supported reusable guidance in the relevant theme under `lessons\/`/iu);

  const auto = COMMAND_SURFACE_BY_ID["dove.auto"];
  const autoText = text(auto);
  assert.equal(auto.workflow.status, "explicit-multi-round-autonomy");
  assert.deepEqual(auto.workflow.modes[0].steps.map((step) => step.capability), [
    "research-document-reading",
    "mainline-boundary-recommendation",
    "lesson-reading",
    "project-exploration",
    "autonomous-research-work",
    "experiment-work",
    "review-handoff",
    "research-document-maintenance",
    "research-synthesis"
  ]);
  assert.match(autoText, /Require an existing.*RESEARCH\.md/isu);
  assert.match(autoText, /create a concise ordinary project recommendation only if the user requested a saved artifact/isu);
  assert.match(autoText, /without a default round count/iu);
  assert.doesNotMatch(autoText, /task database|execution ledger.*create|scientific authority|current claim boundaries|adverse evidence/iu);
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
  assert.match(policy, /host file and research tools directly/iu);
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
  assert.deepEqual(agentEntries.map((entry) => entry.relativePath), [".claude/agents/dove.md", ".opencode/agents/dove.md"]);
  for (const entry of agentEntries) {
    assert.match(entry.content, /# Dove Agent/u);
    assert.match(entry.content, /one complete research agent/iu);
    assert.match(entry.content, /## Dove research-agent persona/u);
    for (const bullet of DOVE_AGENT_PERSONA_BULLETS) assert.ok(entry.content.includes(bullet));
    assert.doesNotMatch(entry.relativePath, /dove-(?:planner|builder|reviewer)|dove-reviewer/u);
    assert.doesNotMatch(entry.content, /three primary roles|Planner.*Builder\/Author.*Reviewer/isu);
  }
  for (const entry of entries) {
    assert.equal(entry.relativePath, adapterPathForCommand(entry.hostId, entry.command));
    assert.equal(entry.content, renderCommandAdapter(entry.hostId, entry.command));
    assert.match(entry.content, /^---\n/um);
    assert.match(entry.content, /## Internal workflow\n\nInternal guidance only; never use this workflow as the final report outline\./u);
    assert.doesNotMatch(entry.content, /Dove MCP tools|Call `(?:query|manage)_dove|semantic ID/iu);
    assert.doesNotMatch(entry.content, /No file write is required|Persist only when:/u);
    assert.match(entry.content, /objective and proportional/iu);
    if (entry.content.includes("research-document-maintenance")) {
      assert.match(entry.content, /user explicitly asks to record, update, or save Dove research context/iu);
      assert.match(entry.content, /research mainline, conclusion, decision, or priority/iu);
      assert.doesNotMatch(entry.content, /Maintain Dove research Markdown only when the work creates durable research value/iu);
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
    "保存到 lessons"
  ]) assert.equal(isHighConfidenceAmbientWorkPrompt(prompt), true, `${prompt} must remain eligible for Dove intake`);

  const entries = generatedClaudeAmbientProjectEntries();
  assert.deepEqual(entries.map((entry) => entry.relativePath), EXPECTED_AMBIENT_PATHS);
  const byPath = new Map(entries.map((entry) => [entry.relativePath, entry.content]));
  const rule = byPath.get(".claude/rules/dove.md");
  const intake = byPath.get(".claude/skills/dove-intake/SKILL.md");
  const paperSearch = byPath.get(PAPER_SEARCH_SUPPORT_SKILL_PATH);
  const ordinary = `${rule}\n${intake}`;
  assert.match(ordinary, /zero-write/iu);
  assert.match(ordinary, /one complete research agent/iu);
  assert.match(ordinary, /capability entrances, not separate personas/iu);
  assert.doesNotMatch(ordinary, /Planner.*Builder\/Author.*Reviewer/isu);
  assert.match(ordinary, /smallest suitable Dove Skill/iu);
  assert.match(ordinary, /Never select Auto/iu);
  assert.match(ordinary, /judgment-only prompts/iu);
  assert.match(ordinary, /weigh current evidence, task risk, user preference, and the research mainline/iu);
  assert.match(ordinary, /stop without executing, recording, launching subagents, or creating tasks unless the user explicitly asks/iu);
  assert.match(rule, /user explicitly names Dove while giving feedback, criticism, correction, or an improvement request about it/iu);
  assert.match(rule, /append a concise natural-language note to `\.dove\/install\/DOCTOR\.md`/iu);
  assert.match(rule, /reusable feedback about ordinary research or collaboration without explicitly naming Dove/iu);
  assert.match(rule, /relevant Lessons Markdown instead/iu);
  assert.match(rule, /Do not write `\.dove\/install\/DOCTOR\.md` during a Stop-hook continuation/iu);
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
  const agentsText = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
  for (const bullet of USER_RESPONSE_POLICY) assert.equal(agentsText.split(bullet).length - 1, 1);
  assert.match(agentsText, /one complete research agent/iu);
  assert.match(agentsText, /hunches, first impressions, and user preferences as hypotheses or tradeoff signals/iu);
  assert.match(agentsText, /Bring research drive/iu);
  assert.match(agentsText, /turn gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves/iu);
  assert.match(agentsText, /layered means rather than equal goals/iu);
  assert.match(agentsText, /neither rushing into aggressive execution nor over-defending/iu);
  assert.match(agentsText, /return the recommendation directly and stop/iu);
  assert.match(agentsText, /Bring research drive/iu);
  assert.match(agentsText, /turn gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves/iu);
  assert.match(agentsText, /judgment-only prompts, give the judgment and stop/iu);
  assert.doesNotMatch(agentsText, /Keep three primary roles distinct|Planner frames|Builder\/Author performs|Reviewer returns/iu);
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
assertResearchDefaultsOwnership();
assertTrellisSpecMirrors();
assertRuntimeCli();
await assertSourceBuilds();

console.log(JSON.stringify({ status: "passed" }, null, 2));

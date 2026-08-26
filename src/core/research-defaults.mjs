import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  DOVE_RESEARCH_CURIOSITY,
  DOVE_RESEARCH_HUNCH,
  DOVE_RESEARCH_LAYERING,
  DOVE_RESEARCH_PROPORTIONALITY
} from "./dove-research-contract.mjs";
import { openRootedFilesystem } from "./rooted-filesystem.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";

const RESEARCH_ROOT = ARTIFACT_PATHS.researchDocumentsDir;

export const RESEARCH_DEFAULT_PATHS = Object.freeze({
  root: RESEARCH_ROOT,
  overview: ARTIFACT_PATHS.researchOverview,
  missionsDirectory: `${RESEARCH_ROOT}/missions`,
  missionsSummary: `${RESEARCH_ROOT}/missions/MISSIONS.md`,
  experimentsDirectory: `${RESEARCH_ROOT}/experiments`,
  experimentsSummary: `${RESEARCH_ROOT}/experiments/EXPERIMENTS.md`,
  sourcesDirectory: `${RESEARCH_ROOT}/sources`,
  sourcesSummary: `${RESEARCH_ROOT}/sources/SOURCES.md`,
  reviewsDirectory: `${RESEARCH_ROOT}/reviews`,
  reviewsSummary: `${RESEARCH_ROOT}/reviews/REVIEWS.md`,
  claimsDirectory: `${RESEARCH_ROOT}/claims`,
  claimsSummary: `${RESEARCH_ROOT}/claims/CLAIMS.md`,
  lessonsDirectory: `${RESEARCH_ROOT}/lessons`,
  lessonsSummary: ARTIFACT_PATHS.researchLessons,
  decisionMaking: `${RESEARCH_ROOT}/lessons/decision-making.md`,
  researchMethod: `${RESEARCH_ROOT}/lessons/research-method.md`,
  experimentsAndEvidence: `${RESEARCH_ROOT}/lessons/experiments-and-evidence.md`,
  engineeringAndValidation: `${RESEARCH_ROOT}/lessons/engineering-and-validation.md`,
  writingAndReview: `${RESEARCH_ROOT}/lessons/writing-and-review.md`,
  collaborationAndEnvironment: `${RESEARCH_ROOT}/lessons/collaboration-and-environment.md`,
  importedLessons: `${RESEARCH_ROOT}/lessons/imported-lessons.md`
});

const RETIRED_RESEARCH_PATHS = Object.freeze({
  additionalLessons: `${RESEARCH_ROOT}/lessons/additional-lessons.md`,
  topLevelLessons: `${RESEARCH_ROOT}/LESSONS.md`
});

const OVERVIEW_LINKS = Object.freeze([
  "- [Missions](missions/MISSIONS.md)",
  "- [Experiments](experiments/EXPERIMENTS.md)",
  "- [Sources](sources/SOURCES.md)",
  "- [Reviews](reviews/REVIEWS.md)",
  "- [Claims](claims/CLAIMS.md)",
  "- [Lessons](lessons/LESSONS.md)"
]);

const LESSON_LINKS = Object.freeze([
  "- [Decision making](decision-making.md)",
  "- [Research method](research-method.md)",
  "- [Experiments and evidence](experiments-and-evidence.md)",
  "- [Engineering and validation](engineering-and-validation.md)",
  "- [Writing and review](writing-and-review.md)",
  "- [Collaboration and environment](collaboration-and-environment.md)"
]);

export const IMPORTED_LESSONS_LINK = "- [Imported legacy Lessons](imported-lessons.md)";

const BUILT_IN_LESSON_NOTICE = "This is a Dove built-in Lesson. `dove update` replaces this file. Put project-specific guidance in a separate naturally named Lessons file and link it from `LESSONS.md`.";

const SUMMARY_DOCUMENTS = Object.freeze([
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.overview,
    title: "# Research",
    blocks: Object.freeze([
      "This overview keeps the current research mainline, material progress, important conclusions and limits, linked work, and next priorities concise and recoverable."
    ]),
    navigationHeading: "## Research areas",
    navigationLines: OVERVIEW_LINKS
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.missionsSummary,
    title: "# Missions",
    blocks: Object.freeze([
      "Use this summary to connect bounded research goals, substantive work, current conclusions, decisions, and useful next branches. Add or revise natural links when Mission documents change."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.experimentsSummary,
    title: "# Experiments",
    blocks: Object.freeze([
      "Use this summary to connect experiments that matter to a research decision. Keep each prospective plan and its later execution and results in the same naturally named document."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.sourcesSummary,
    title: "# Sources",
    blocks: Object.freeze([
      "Use this summary to connect sources that materially inform the work and record what was actually inspected and learned when durable context is useful."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.reviewsSummary,
    title: "# Reviews",
    blocks: Object.freeze([
      "Use this summary to connect Review documents for direct reviewer-perspective critiques, separate review handoffs, actual returned Markdown, author handling, and follow-up. Keep scopes, prompts, returns, and author-side work clearly separated in the relevant Review document."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.claimsSummary,
    title: "# Claims",
    blocks: Object.freeze([
      "Use this summary to organize important research claims when that improves the work. Keep the claim, its current basis, and the decision or next action it affects clear."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.lessonsSummary,
    title: "# Lessons",
    blocks: Object.freeze([
      "Lessons are fallible, reviewable guidance for future work. They are not research evidence, scientific validation, permission, or a completion certificate. Treat the six built-in themes as package-managed references; when durable project-specific guidance warrants maintenance, update or create a researcher-owned Lessons file and link it here."
    ]),
    navigationHeading: "## Themes",
    navigationLines: LESSON_LINKS
  })
]);

export const RESEARCH_LESSON_TOPICS = Object.freeze([
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.decisionMaking,
    title: "# Decision making",
    intro: "Use these principles to choose and stop work according to real value rather than presentation or sunk cost.",
    paragraphs: Object.freeze([
      "Prefer work that advances the real research goal or resolves an important uncertainty. Navigation, record keeping, local metrics, demonstrations, and surface progress matter only when they improve the next decision or substantive result.",
      DOVE_RESEARCH_LAYERING,
      "Choose the feasible action most likely to change the research decision. Use suitable existing code, data, models, tools, compute, prior results, and user preferences to accelerate the chosen question, but do not let available resources or preferences redefine it without saying why.",
      "After a meaningful result, commit to the strongest route, switch when another explanation or approach becomes better, or stop when further feasible work is unlikely to resolve the important uncertainty.",
      "Judge progress by the real path from representative input to a useful result, not by the amount of analysis, validation, or documentation produced."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.researchMethod,
    title: "# Research method",
    intro: "Use these principles to keep the problem, hypothesis, mechanism, and route scientifically meaningful.",
    paragraphs: Object.freeze([
      "Start from the real research question and the conditions in which the answer must matter. Inspect the actual project and relevant external work before letting available methods, metrics, or publication pressure redefine the problem.",
      DOVE_RESEARCH_HUNCH,
      DOVE_RESEARCH_CURIOSITY,
      "When the route is open, generate materially different explanations or approaches. Use theory to derive different expectations, compare the serious candidates under the actual use conditions, and do not commit to the first plausible or easiest one.",
      "Choose work that can distinguish the serious candidates or expose the key mechanism. A small diagnostic, source investigation, analysis, prototype, or experiment is valuable when its possible outcomes would lead to different research decisions; do not treat missing evidence as a reason to stop before seeking the evidence that matters.",
      "When theory and results disagree, revisit the theory, test, and route rather than defending the current story or automatically adding experiments. Use the result to commit, switch, or stop."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.experimentsAndEvidence,
    title: "# Experiments and evidence",
    intro: "Use experiments when they are the best way to change a research decision.",
    paragraphs: Object.freeze([
      "Before treating an experiment as central, establish the real problem, key uncertainty, or route decision it should resolve. If that basis is not yet established, pause central experiment design and inspect the actual project material, relevant sources, or smaller low-risk diagnostic needed to investigate the problem; do not invent a substitute experiment or stop at merely admitting the basis is missing.",
      "For new execution, state what is being tested and how the result will be judged before running it. Use comparisons or diagnostics that can distinguish the serious candidates under the conditions that matter.",
      "Experiments, validation, audits, and documents are means. When they cannot change or protect the mainline decision, more of them becomes fake rigor or fake progress rather than better research.",
      "Prefer the real task over convenient proxies when the real task is feasible. Record the actual result and any deviation or failure that changes its interpretation when it has durable recovery or evidence value, then use it to continue, change, or stop the route."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.engineeringAndValidation,
    title: "# Engineering and validation",
    intro: "Use these principles to turn implementation checks into trustworthy end-to-end software results without overstating them.",
    paragraphs: Object.freeze([
      "Implement the smallest complete path that serves the real task. Keep concepts and data authority clear across input, execution, output, and interpretation, and remove obsolete paths rather than accumulating fallback, shadow state, duplicate rules, and switches. When a gap blocks progress, name the smallest concrete probe or repair that could unblock the mainline rather than ending at the gap itself.",
      "Diagnose the shared cause of failures and make the actual repair; do not let investigation, bookkeeping, or local checks replace the requested result, and do not manufacture a valid-looking output through unrelated defaults, swallowed errors, or skipped problem cases.",
      "Validate in proportion to the consequence of the change, using the real interface or artifact when that matters. Stop when the real path works well enough for the requested purpose rather than accumulating redundant checks.",
      DOVE_RESEARCH_PROPORTIONALITY,
      "Do not cause real harm or lose user content. Preserve unrelated project changes, protect credentials and sensitive data, and obtain explicit confirmation before destructive or outward-facing actions."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.writingAndReview,
    title: "# Writing and review",
    intro: "Use these principles to make papers and reviews follow a clear research argument.",
    paragraphs: Object.freeze([
      "Build the paper or report around a clear argument: an important problem, a specific gap, a falsifiable hypothesis or mechanism, fair evidence, and an explicit capability boundary. Organize the account around that argument rather than the chronology of development and patches. When you read as a reviewer, test the claim, evidence, method, novelty, limitations, and likely reader confusion before deciding what to ask or revise.",
      "Explain what is genuinely new by identifying the prior obstacle that is removed and separating the contribution from inherited models, public data, tools, simulators, and external services. Compare the nearest work on the actual task, information, supervision, use conditions, protocol, mechanism, real user need, and supporting evidence rather than merely listing sources or iterating an internal novelty story.",
      "Describe enough of the method, evidence conditions, adverse evidence, provenance, and experiment conditions for the reader to understand how and why the result was produced. Organize important results around the research or contribution promise they test and explain how they change the argument.",
      "Keep the paper focused on the strongest supported contribution. Revise or remove claims when a result changes the argument rather than surrounding them with defensive qualification."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.collaborationAndEnvironment,
    title: "# Collaboration and environment",
    intro: "Use these principles to communicate decisions clearly and execute safely in the environment that actually exists.",
    paragraphs: Object.freeze([
      "Use the user's requested language and format. State the result or judgment clearly, explain difficult ideas in ordinary language before specialized terms, and do not bury the answer under internal workflow detail.",
      "Treat user preferences as collaboration and risk signals that matter, but weigh them against current evidence, task risk, and the research mainline when they conflict.",
      "Complete the current bounded request when the available context permits it, and ask only when a material ambiguity changes the work. Parallelize only genuinely independent tasks, preserve unrelated user changes, and do not commit, push, publish, or perform destructive cleanup without the required user direction or confirmation.",
      "Before using platform-specific commands, confirm the actual operating system, shell, path conventions, and available toolchain, then use that environment's native commands instead of trying Windows, Linux, and macOS commands by guesswork.",
      "For compute-intensive work, inspect the actual hardware and deployment constraints. Use suitable available GPUs and sufficiently capable models when the task benefits from them; do not default without evidence to CPU, small memory, weak models, or overly frugal settings, and do not retain an unrequested CPU fallback when the real deployment does not need one."
    ])
  })
]);

function renderDocument({ title, blocks = [], navigationHeading = null, navigationLines = [] }) {
  const parts = [title, ...blocks];
  if (navigationLines.length > 0) parts.push(navigationHeading, navigationLines.join("\n"));
  return `${parts.join("\n\n")}\n`;
}

function topicDocument(topic) {
  return renderDocument({ title: topic.title, blocks: [BUILT_IN_LESSON_NOTICE, topic.intro, ...topic.paragraphs] });
}

export const RESEARCH_DEFAULT_DOCUMENTS = Object.freeze([
  ...SUMMARY_DOCUMENTS.map((document) => Object.freeze({ path: document.path, content: renderDocument(document) })),
  ...RESEARCH_LESSON_TOPICS.map((topic) => Object.freeze({ path: topic.path, content: topicDocument(topic) }))
]);

export const RESEARCH_DEFAULT_FILE_PATHS = Object.freeze(RESEARCH_DEFAULT_DOCUMENTS.map((document) => document.path));
export const RESEARCH_DEFAULT_DIRECTORY_PATHS = Object.freeze([
  RESEARCH_DEFAULT_PATHS.root,
  RESEARCH_DEFAULT_PATHS.missionsDirectory,
  RESEARCH_DEFAULT_PATHS.experimentsDirectory,
  RESEARCH_DEFAULT_PATHS.sourcesDirectory,
  RESEARCH_DEFAULT_PATHS.reviewsDirectory,
  RESEARCH_DEFAULT_PATHS.claimsDirectory,
  RESEARCH_DEFAULT_PATHS.lessonsDirectory
]);

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function canonicalRoot(root, fsOps) {
  const resolved = path.resolve(root);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}

function decodeMarkdown(bytes, relativePath) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch (error) {
    throw new Error(`${relativePath} must contain valid UTF-8 Markdown.`, { cause: error });
  }
  if (text.includes("\0")) throw new Error(`${relativePath} contains null bytes.`);
  return text;
}

function absentState(relativePath) {
  return { relativePath, exists: false, type: "absent", bytes: null, text: null, sha256: null, mode: null };
}

function readFileState(anchor, relativePath, options = {}) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return absentState(relativePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${relativePath} must be a regular file without symbolic links.`);
  const bytes = anchor.readFile(relativePath);
  return {
    relativePath,
    exists: true,
    type: "file",
    bytes,
    text: options.decode === false ? null : decodeMarkdown(bytes, relativePath),
    sha256: sha256(bytes),
    mode: stat.mode & 0o7777
  };
}

function assertRealDirectoryIfPresent(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error(`${relativePath} must be a real directory.`);
  return stat !== null;
}

function expectedState(state) {
  return state.exists
    ? { exists: true, type: "file", sha256: state.sha256, mode: state.mode }
    : { exists: false, type: "absent", sha256: null, mode: null };
}

function exactLinePresent(text, line) {
  return text.split(/\r?\n/u).includes(line);
}

function exactMarkdownBlockPresent(text, block) {
  let offset = 0;
  while (offset <= text.length) {
    const index = text.indexOf(block, offset);
    if (index === -1) return false;
    const end = index + block.length;
    const startsAtLineBoundary = index === 0 || (index === 1 && text[0] === "﻿") || text[index - 1] === "\n";
    const endsAtLineBoundary = end === text.length || text[end] === "\n" || text.startsWith("\r\n", end);
    if (startsAtLineBoundary && endsAtLineBoundary) return true;
    offset = index + 1;
  }
  return false;
}

function appendSeparator(text) {
  if (!text) return "";
  if (text.endsWith("\n\n")) return "";
  if (text.endsWith("\n")) return "\n";
  return "\n\n";
}

function appendByteSeparator(bytes) {
  if (bytes.length === 0) return Buffer.alloc(0);
  if (bytes.subarray(-4).equals(Buffer.from("\r\n\r\n")) || bytes.subarray(-2).equals(Buffer.from("\n\n"))) return Buffer.alloc(0);
  if (bytes.subarray(-2).equals(Buffer.from("\r\n"))) return Buffer.from("\r\n");
  if (bytes.at(-1) === 0x0a) return Buffer.from("\n");
  return Buffer.from("\n\n");
}

export function appendExactMarkdownBlocks(original, blocks) {
  let result = String(original);
  for (const raw of blocks) {
    const block = String(raw).trimEnd();
    if (!block || exactMarkdownBlockPresent(result, block)) continue;
    result += `${appendSeparator(result)}${block}\n`;
  }
  return result;
}

export function appendExactMarkdownBytes(original, addition) {
  const existing = Buffer.isBuffer(original) ? Buffer.from(original) : Buffer.from(original ?? "");
  const appended = Buffer.isBuffer(addition) ? Buffer.from(addition) : Buffer.from(addition ?? "");
  if (appended.length === 0 || existing.indexOf(appended) !== -1) return existing;
  return Buffer.concat([existing, appendByteSeparator(existing), appended]);
}

export function appendExactMarkdownLines(original, heading, lines) {
  const missing = lines.filter((line) => !exactLinePresent(original, line));
  if (missing.length === 0) return original;
  const parts = [];
  if (heading && !exactLinePresent(original, heading)) parts.push(heading);
  parts.push(...missing);
  return appendExactMarkdownBlocks(original, [parts.join("\n")]);
}

export function readResearchDefaultsSnapshot(root, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const replace = options.mode === "replace";
  const anchor = openRootedFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
  for (const directoryPath of RESEARCH_DEFAULT_DIRECTORY_PATHS) assertRealDirectoryIfPresent(anchor, directoryPath);
  const states = new Map();
  const selectedPaths = new Set([
    ...RESEARCH_DEFAULT_FILE_PATHS,
    RETIRED_RESEARCH_PATHS.additionalLessons,
    RESEARCH_DEFAULT_PATHS.importedLessons,
    RETIRED_RESEARCH_PATHS.topLevelLessons
  ]);
  for (const relativePath of selectedPaths) {
    const opaque = relativePath === RETIRED_RESEARCH_PATHS.additionalLessons
      || relativePath === RESEARCH_DEFAULT_PATHS.importedLessons
      || relativePath === RETIRED_RESEARCH_PATHS.topLevelLessons;
    states.set(relativePath, readFileState(anchor, relativePath, { decode: !replace && !opaque }));
  }
  return { states };
}

function stateFor(snapshot, relativePath) {
  return snapshot.states.get(relativePath) ?? absentState(relativePath);
}

function setWrite(writes, snapshot, relativePath, content) {
  const bytes = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), "utf8");
  const state = stateFor(snapshot, relativePath);
  if (state.exists && state.bytes.equals(bytes)) {
    writes.delete(relativePath);
    return;
  }
  writes.set(relativePath, bytes);
}

function currentText(snapshot, writes, relativePath) {
  if (writes.has(relativePath)) return decodeMarkdown(writes.get(relativePath), relativePath);
  const state = stateFor(snapshot, relativePath);
  return state.exists ? state.text : null;
}

function removeExactMarkdownLine(original, line) {
  const escaped = line.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return original.replace(new RegExp(`^${escaped}(?:\\r?\\n|$)`, "gmu"), "");
}

function planSummaryDocument(snapshot, writes, document) {
  const state = stateFor(snapshot, document.path);
  if (!state.exists) {
    setWrite(writes, snapshot, document.path, renderDocument(document));
    return;
  }
  let content = currentText(snapshot, writes, document.path);
  if (document.path === RESEARCH_DEFAULT_PATHS.lessonsSummary) {
    content = removeExactMarkdownLine(content, "- [Additional migrated Lessons](additional-lessons.md)");
  }
  content = appendExactMarkdownLines(content, document.navigationHeading, document.navigationLines);
  setWrite(writes, snapshot, document.path, content);
}

export function planResearchDefaults(snapshot, options = {}) {
  if (!snapshot || !(snapshot.states instanceof Map)) {
    throw new Error("Research defaults planning requires a research Markdown snapshot.");
  }
  const mode = options.mode ?? "sync";
  if (!new Set(["sync", "replace"]).has(mode)) throw new Error(`Unsupported research defaults planning mode: ${mode}.`);
  const writes = new Map();
  const deletes = new Set();

  if (mode === "replace") {
    for (const document of RESEARCH_DEFAULT_DOCUMENTS) setWrite(writes, snapshot, document.path, document.content);
    return { writes, deletes };
  }

  for (const deprecatedPath of [RETIRED_RESEARCH_PATHS.topLevelLessons, RETIRED_RESEARCH_PATHS.additionalLessons]) {
    if (stateFor(snapshot, deprecatedPath).exists) deletes.add(deprecatedPath);
  }

  for (const document of SUMMARY_DOCUMENTS) planSummaryDocument(snapshot, writes, document);
  for (const topic of RESEARCH_LESSON_TOPICS) setWrite(writes, snapshot, topic.path, topicDocument(topic));

  return { writes, deletes };
}

export function researchDefaultTransactionEntries(root, snapshot, plan, options = {}) {
  const label = options.label ?? "Dove research default";
  return [
    ...[...plan.writes.entries()].map(([relativePath, content]) => ({
      root,
      relativePath,
      content,
      force: true,
      expectedState: expectedState(stateFor(snapshot, relativePath)),
      label: `${label} ${relativePath}`
    })),
    ...[...plan.deletes].map((relativePath) => ({
      root,
      relativePath,
      delete: true,
      force: true,
      expectedState: expectedState(stateFor(snapshot, relativePath)),
      label: `Retired Dove research document ${relativePath}`
    }))
  ];
}

export function prepareResearchDefaults(root, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const canonical = canonicalRoot(root, fsOps);
  const mode = options.mode ?? "sync";
  const snapshot = readResearchDefaultsSnapshot(canonical, { ...options, fsOps, mode });
  const plan = planResearchDefaults(snapshot, { mode });
  const entries = researchDefaultTransactionEntries(canonical, snapshot, plan, { label: options.label });
  return {
    root: canonical,
    snapshot,
    plan,
    entries,
    changedPaths: entries.map((entry) => entry.relativePath)
  };
}

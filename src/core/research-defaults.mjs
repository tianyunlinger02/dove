import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

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
  additionalLessons: `${RESEARCH_ROOT}/lessons/additional-lessons.md`,
  importedLessons: `${RESEARCH_ROOT}/lessons/imported-lessons.md`,
  retiredTopLevelLessons: `${RESEARCH_ROOT}/LESSONS.md`
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

export const ADDITIONAL_LESSONS_LINK = "- [Additional migrated Lessons](additional-lessons.md)";
export const IMPORTED_LESSONS_LINK = "- [Imported legacy Lessons](imported-lessons.md)";

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
      "Use this summary to connect bounded research goals, their material work and failures, evidence-bounded conclusions, limitations, and useful next branches. Add or revise natural links when Mission documents change."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.experimentsSummary,
    title: "# Experiments",
    blocks: Object.freeze([
      "Use this summary to connect experiments that matter to the research argument. Keep each prospective plan and its later execution, results, failures, deviations, limitations, and uncertainty in the same naturally named document."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.sourcesSummary,
    title: "# Sources",
    blocks: Object.freeze([
      "Use this summary to connect source notes that materially inform the work, including what was actually inspected, relevant conditions, conflicts, and limitations. A source explanation is useful when available but is not mandatory."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.reviewsSummary,
    title: "# Reviews",
    blocks: Object.freeze([
      "Use this summary to connect user-managed Review documents. Keep the declared artifact scope, prompt, actual returned Markdown, limitations, author handling, and follow-up together in the relevant Review document."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.claimsSummary,
    title: "# Claims",
    blocks: Object.freeze([
      "Use this summary to organize important claims and their evidence boundaries when that improves the research. Preserve support, counter-evidence, missing evidence, uncertainty, and what the current work cannot establish."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.lessonsSummary,
    title: "# Lessons",
    blocks: Object.freeze([
      "Lessons are fallible, reviewable guidance for future work. They are not research evidence, scientific validation, permission, or a completion certificate; maintain the existing relevant theme or create a naturally named Markdown file when durable guidance warrants it."
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
      "Prefer work that advances the real research goal or resolves an important uncertainty. Navigation, record keeping, local metrics, demonstrations, and surface progress are useful only when they improve the next decision or substantive result.",
      "Choose routes by expected research value rather than sunk cost. Use suitable existing code, data, models, tools, compute, and prior results to accelerate the chosen question, but do not let available resources redefine that question or justify weaker evidence.",
      "Stop or change a route when reasoning or evidence shows it cannot support the needed conclusion. Preserve failures, missing work, and uncertainty instead of adding patches or rewriting the success criterion around them.",
      "Judge completion on the real path from representative input to a usable final result under the actual standard. Software checks, logs, model output, and internal review are bounded evidence, not proof of scientific correctness or research completion."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.researchMethod,
    title: "# Research method",
    intro: "Use these principles to keep the problem, hypothesis, mechanism, and claimed scope scientifically meaningful.",
    paragraphs: Object.freeze([
      "Start from an important real problem and a defensible knowledge gap. Define the intended input, output, use conditions, and evaluation target, then inspect relevant external work, strong nearby methods, and counterexamples before judging novelty or value.",
      "State a falsifiable hypothesis before committing to an implementation: what relationship or mechanism is expected, what observable result should change, what would weaken the hypothesis, which alternatives remain, and what evidence can distinguish them.",
      "Prefer one clear core insight and a coherent mechanism over accumulations of routing rules, repair steps, and fallback layers. A simpler diagnostic prototype is useful when it tests the key uncertainty rather than quietly shrinking the research question.",
      "Information used by the method must be available under the real use conditions and free of target leakage or shortcuts.",
      "Explore broadly before committing to a research route, then compare and pressure-test the serious alternatives rather than pursuing the first plausible option. When theory and evidence conflict, reconsider the theory, the experiment, and the route itself; choose the next action that best clarifies the disagreement instead of assuming more experiments are needed."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.experimentsAndEvidence,
    title: "# Experiments and evidence",
    intro: "Use these principles to make experiments discriminating, fair, and honest about what they establish.",
    paragraphs: Object.freeze([
      "Use experiments to resolve a real research decision: test a core hypothesis, distinguish an important alternative, decide whether a route should continue, or bound a meaningful failure mode. For new execution, state what is being tested and how the result will be judged before running it.",
      "Use strong, nearby, and fair baselines. Align the information, data split, supervision, model and compute budget, attempts, post-processing, evaluation protocol, and failed-sample accounting where possible, and disclose material differences that remain.",
      "Prefer evidence from the real end-to-end task, supported by discriminating controls, counterfactuals, and diagnostics. A non-crashing output, small qualitative example, code check, or log can establish a local fact but cannot substitute for the capability being claimed.",
      "Keep complete denominators and preserve positive, negative, null, mixed, failed, stopped, invalid, and timed-out outcomes. Record material deviations and enough actual procedure and artifacts to interpret what the result supports and cannot establish."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.engineeringAndValidation,
    title: "# Engineering and validation",
    intro: "Use these principles to turn implementation checks into trustworthy end-to-end software results without overstating them.",
    paragraphs: Object.freeze([
      "Implement the smallest complete path that serves the real task. Keep concepts and data authority clear across input, execution, output, and interpretation, and remove obsolete paths rather than accumulating fallback, shadow state, duplicate rules, and switches.",
      "Diagnose the shared cause of failures and make the actual repair; do not let investigation, bookkeeping, or local checks replace the requested result. Preserve visible failures and do not manufacture a valid-looking output through unrelated defaults, truncation, swallowed errors, skipped steps, or removed problem cases.",
      "Validate in proportion to the consequence and uncertainty of the change, using the real interface or artifact when that matters. Report exactly what was implemented and observed; software checks and local execution do not by themselves establish scientific correctness, reproducibility, production readiness, or research completion.",
      "Do not cause real harm or lose user content. Preserve unrelated project changes, protect credentials and sensitive data, and obtain explicit confirmation before destructive or outward-facing actions."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.writingAndReview,
    title: "# Writing and review",
    intro: "Use these principles to make papers and reviews follow a clear, evidence-bounded argument.",
    paragraphs: Object.freeze([
      "Build the paper or report around a clear argument: an important problem, a specific gap, a falsifiable hypothesis or mechanism, fair evidence, and an explicit capability boundary. Organize the account around that argument rather than the chronology of development and patches.",
      "Explain what is genuinely new by identifying the prior obstacle that is removed and separating the contribution from inherited models, public data, tools, simulators, and external services. Compare the nearest work on the actual task, information, supervision, use conditions, protocol, and mechanism rather than merely listing sources.",
      "Describe enough of the method and experiment conditions for the reader to understand how and why the result was produced. Organize important results around the research or contribution promise they test, state what each result supports, weakens, or cannot establish, and connect figures, tables, and claims to the underlying evidence.",
      "Keep every claim within the evaluated conditions. Preserve counter-evidence, failures, limitations, external dependencies, citation gaps, and uncertainty, and do not let the title, abstract, figure, or conclusion claim more than the body supports."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.collaborationAndEnvironment,
    title: "# Collaboration and environment",
    intro: "Use these principles to communicate decisions clearly and execute safely in the environment that actually exists.",
    paragraphs: Object.freeze([
      "Use the user's requested language and format. State the result or judgment clearly, explain difficult ideas in ordinary language before specialized terms, and keep material failures, limitations, uncertainty, and blockers visible without burying the answer under internal workflow detail.",
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
  return renderDocument({ title: topic.title, blocks: [topic.intro, ...topic.paragraphs] });
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
    RESEARCH_DEFAULT_PATHS.additionalLessons,
    RESEARCH_DEFAULT_PATHS.importedLessons,
    RESEARCH_DEFAULT_PATHS.retiredTopLevelLessons
  ]);
  for (const relativePath of selectedPaths) states.set(relativePath, readFileState(anchor, relativePath, { decode: !replace }));

  const lessonMarkdownStates = new Map();
  if (!replace && anchor.tryLstat(RESEARCH_DEFAULT_PATHS.lessonsDirectory)) {
    for (const entry of anchor.readdir(RESEARCH_DEFAULT_PATHS.lessonsDirectory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.name.endsWith(".md")) continue;
      const relativePath = `${RESEARCH_DEFAULT_PATHS.lessonsDirectory}/${entry.name}`;
      if (entry.isSymbolicLink() || !entry.isFile()) throw new Error(`${relativePath} must be a regular Markdown file without symbolic links.`);
      const state = states.get(relativePath) ?? readFileState(anchor, relativePath);
      states.set(relativePath, state);
      lessonMarkdownStates.set(relativePath, state);
    }
  }
  return { states, lessonMarkdownStates };
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

function planSummaryDocument(snapshot, writes, document, extraLines = []) {
  const state = stateFor(snapshot, document.path);
  if (!state.exists) {
    const content = renderDocument({
      ...document,
      navigationLines: [...document.navigationLines, ...extraLines]
    });
    setWrite(writes, snapshot, document.path, content);
    return;
  }
  let content = currentText(snapshot, writes, document.path);
  content = appendExactMarkdownBlocks(content, document.blocks);
  content = appendExactMarkdownLines(content, document.navigationHeading, [...document.navigationLines, ...extraLines]);
  setWrite(writes, snapshot, document.path, content);
}

function exactContentPresent(bytes, content) {
  return bytes.indexOf(content) !== -1;
}

function additionalLessonTexts(options) {
  const texts = options.additionalLessonTexts ?? [];
  if (!Array.isArray(texts) || texts.some((text) => typeof text !== "string")) {
    throw new Error("Research defaults additional Lessons corpus must be an array of Markdown strings.");
  }
  return texts;
}

export function planResearchDefaults(snapshot, options = {}) {
  if (!snapshot || !(snapshot.states instanceof Map) || !(snapshot.lessonMarkdownStates instanceof Map)) {
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

  const retired = stateFor(snapshot, RESEARCH_DEFAULT_PATHS.retiredTopLevelLessons);
  const additional = stateFor(snapshot, RESEARCH_DEFAULT_PATHS.additionalLessons);
  let additionalWillExist = additional.exists;
  if (options.migrateRetiredLessons !== false && retired.exists) {
    if (!additional.exists) {
      setWrite(writes, snapshot, RESEARCH_DEFAULT_PATHS.additionalLessons, retired.bytes);
    } else if (!exactContentPresent(additional.bytes, retired.bytes)) {
      setWrite(
        writes,
        snapshot,
        RESEARCH_DEFAULT_PATHS.additionalLessons,
        appendExactMarkdownBytes(additional.bytes, retired.bytes)
      );
    }
    deletes.add(RESEARCH_DEFAULT_PATHS.retiredTopLevelLessons);
    additionalWillExist = true;
  }

  for (const document of SUMMARY_DOCUMENTS) {
    const extraLines = document.path === RESEARCH_DEFAULT_PATHS.lessonsSummary && additionalWillExist
      ? [ADDITIONAL_LESSONS_LINK]
      : [];
    planSummaryDocument(snapshot, writes, document, extraLines);
  }

  const lessonCorpus = [
    ...snapshot.lessonMarkdownStates.values(),
    ...(retired.exists ? [retired] : [])
  ].map((state) => state.text);
  if (writes.has(RESEARCH_DEFAULT_PATHS.additionalLessons)) {
    lessonCorpus.push(currentText(snapshot, writes, RESEARCH_DEFAULT_PATHS.additionalLessons));
  }
  lessonCorpus.push(...additionalLessonTexts(options));

  for (const topic of RESEARCH_LESSON_TOPICS) {
    const state = stateFor(snapshot, topic.path);
    if (!state.exists) {
      setWrite(writes, snapshot, topic.path, topicDocument(topic));
      continue;
    }
    const missingParagraphs = topic.paragraphs.filter((paragraph) => !lessonCorpus.some((text) => exactMarkdownBlockPresent(text, paragraph)));
    const content = appendExactMarkdownBlocks(state.text, missingParagraphs);
    setWrite(writes, snapshot, topic.path, content);
  }

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
  const plan = planResearchDefaults(snapshot, {
    mode,
    migrateRetiredLessons: options.migrateRetiredLessons,
    additionalLessonTexts: options.additionalLessonTexts
  });
  const entries = researchDefaultTransactionEntries(canonical, snapshot, plan, { label: options.label });
  return {
    root: canonical,
    snapshot,
    plan,
    entries,
    changedPaths: entries.map((entry) => entry.relativePath)
  };
}

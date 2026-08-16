import { createRequire as __doveCreateRequire } from "node:module"; const require = __doveCreateRequire(import.meta.url);

// src/core/package-metadata.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
var injectedName = true ? "dove" : null;
var injectedVersion = true ? "3.0.0" : null;
function parseSemver(value) {
  const match = typeof value === "string" ? value.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u) : null;
  if (!match) return null;
  const prerelease = match[4]?.split(".") ?? [];
  if (prerelease.some((identifier) => /^\d+$/u.test(identifier) && identifier.length > 1 && identifier.startsWith("0"))) return null;
  return { core: match.slice(1, 4), prerelease };
}
function compareNumericIdentifier(left, right) {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}
function comparePrereleaseIdentifier(left, right) {
  const leftNumeric = /^\d+$/u.test(left);
  const rightNumeric = /^\d+$/u.test(right);
  if (leftNumeric && rightNumeric) return compareNumericIdentifier(left, right);
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}
function comparePackageVersions(left, right) {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < leftParts.core.length; index += 1) {
    const order = compareNumericIdentifier(leftParts.core[index], rightParts.core[index]);
    if (order !== 0) return order;
  }
  if (leftParts.prerelease.length === 0 || rightParts.prerelease.length === 0) {
    if (leftParts.prerelease.length === rightParts.prerelease.length) return 0;
    return leftParts.prerelease.length === 0 ? 1 : -1;
  }
  const count = Math.max(leftParts.prerelease.length, rightParts.prerelease.length);
  for (let index = 0; index < count; index += 1) {
    if (leftParts.prerelease[index] === void 0) return -1;
    if (rightParts.prerelease[index] === void 0) return 1;
    const order = comparePrereleaseIdentifier(leftParts.prerelease[index], rightParts.prerelease[index]);
    if (order !== 0) return order;
  }
  return 0;
}
function classifyPackageCompatibility(candidate, expected) {
  if (!candidate || !expected || candidate.name !== expected.name) return "identity-mismatch";
  const order = comparePackageVersions(candidate.version, expected.version);
  if (order === null) return "invalid-version";
  if (order > 0) return "newer";
  if (order < 0) return "older";
  return "current";
}
function sourcePackage() {
  const packagePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..", "package.json");
  return JSON.parse(fs.readFileSync(packagePath, "utf8"));
}
var packageMetadata = injectedName && injectedVersion ? { name: injectedName, version: injectedVersion } : sourcePackage();
if (typeof packageMetadata.name !== "string" || !packageMetadata.name) throw new Error("Dove package name is invalid.");
if (!parseSemver(packageMetadata.version)) throw new Error("Dove package version is invalid.");
var PACKAGE_NAME = packageMetadata.name;
var PACKAGE_VERSION = packageMetadata.version;

// src/core/schema.mjs
var ARTIFACT_PATHS = Object.freeze({
  doveRoot: ".dove",
  installDir: ".dove/install",
  installationManifest: ".dove/install/manifest.json",
  doctorDocument: ".dove/install/DOCTOR.md",
  transactionsDir: ".dove/install/transactions",
  archiveDir: ".dove/archive",
  researchDocumentsDir: ".dove/research",
  researchOverview: ".dove/research/RESEARCH.md",
  researchLessons: ".dove/research/lessons/LESSONS.md"
});

// src/core/user-response-policy.mjs
var USER_RESPONSE_POLICY = Object.freeze([
  "Follow the user's requested language and format.",
  "Keep material failures, limitations, and uncertainty visible; do not present software checks or model output as scientific proof."
]);

// src/core/ambient-policy.mjs
var AMBIENT_CONTEXT = "Use hidden `dove-intake` for this request.";
var AMBIENT_WORK_INTENT = /(?:\b(?:research|investigate|experiment|benchmark|source|literature|paper|manuscript|draft|figure|plot|review|rebuttal|revise|implement|build|fix|debug|test|validate|analy[sz]e|compare|audit|lesson|lessons|remember|reflect|retrospect)\b|(?:研究|调研|实验|基准|文献|来源|论文|稿件|草稿|图表|绘图|评审|审稿|回复审稿|反驳|修订|实现|构建|修复|调试|测试|验证|分析|比较|审查|检查|经验|教训|记住|记录|复盘|反思))/iu;
var CONTEXT_FOLLOW_UP = /^(?:说人话|解释(?:一下|下)?|说明(?:一下|下)?|这是什么意思|什么意思|再(?:简短|简单|短|说一遍)|简短(?:一点|些)?|简单(?:一点|些)?|总结(?:一下|下)?|换个说法|重说(?:一遍)?|展开(?:一下|下)?|继续|接着来|下一步|确认|好的|明白|收到|谢谢|多谢|感谢|why|what does (?:this|that) mean|explain|summari[sz]e|shorter|simplify|say that again|continue|go on|next|ok|okay|got it|thanks)(?:[!！,.，。?？\s]*)$/iu;
function isHighConfidenceAmbientWorkPrompt(prompt) {
  if (typeof prompt !== "string") return false;
  const normalized = prompt.normalize("NFKC").trim();
  if (!normalized || normalized.startsWith("/") || CONTEXT_FOLLOW_UP.test(normalized)) return false;
  return AMBIENT_WORK_INTENT.test(normalized);
}
var DOVE_CLAUDE_SETTINGS_PATH = ".claude/settings.json";
var DOVE_CLAUDE_AMBIENT_RULE_PATH = ".claude/rules/dove.md";
var DOVE_CLAUDE_AMBIENT_SKILL_PATH = ".claude/skills/dove-intake/SKILL.md";
var DOVE_CLAUDE_AMBIENT_HOOK_COMMAND = 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"';
var DOVE_CLAUDE_STOP_HOOK_COMMAND = 'dove hook stop --project "$CLAUDE_PROJECT_DIR"';
var DOVE_CLAUDE_AMBIENT_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([
    Object.freeze({
      type: "command",
      command: DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
      timeout: 10
    })
  ])
});
var DOVE_CLAUDE_STOP_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([
    Object.freeze({
      type: "command",
      command: DOVE_CLAUDE_STOP_HOOK_COMMAND,
      timeout: 10
    })
  ])
});
function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function sameKeys(value, keys) {
  return plainObject(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}
function exactManagedHook(value, command) {
  if (!sameKeys(value, ["hooks"]) || !Array.isArray(value.hooks) || value.hooks.length !== 1) return false;
  const hook = value.hooks[0];
  return sameKeys(hook, ["command", "timeout", "type"]) && hook.type === "command" && hook.command === command && hook.timeout === 10;
}
function referencesManagedHook(value, eventName) {
  if (!plainObject(value) || !Array.isArray(value.hooks)) return false;
  return value.hooks.some((hook) => {
    if (!plainObject(hook) || typeof hook.command !== "string") return false;
    if (eventName === "UserPromptSubmit") {
      return hook.command.includes("dove hook user-prompt-submit") || hook.command.includes("dove-user-prompt-submit-package.mjs");
    }
    return hook.command.includes("dove hook stop");
  });
}
function mergeManagedHook(entries, eventName, command, managedEntry) {
  const exactEntries = entries.filter((entry) => exactManagedHook(entry, command));
  const conflictingEntries = entries.filter((entry) => referencesManagedHook(entry, eventName) && !exactManagedHook(entry, command));
  if (exactEntries.length > 1 || conflictingEntries.length > 0) {
    throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} already defines a conflicting Dove-managed ${eventName} hook.`);
  }
  return exactEntries.length === 1 ? { entries, changed: false } : { entries: [...entries, managedEntry], changed: true };
}
function mergeClaudeAmbientSettings(settings) {
  if (!plainObject(settings)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} must contain a JSON object.`);
  if (settings.hooks !== void 0 && !plainObject(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  const hooks = settings.hooks ?? {};
  const promptHooks = hooks.UserPromptSubmit;
  const stopHooks = hooks.Stop;
  if (promptHooks !== void 0 && !Array.isArray(promptHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.UserPromptSubmit must be an array.`);
  if (stopHooks !== void 0 && !Array.isArray(stopHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.Stop must be an array.`);
  const prompt = mergeManagedHook(promptHooks ?? [], "UserPromptSubmit", DOVE_CLAUDE_AMBIENT_HOOK_COMMAND, DOVE_CLAUDE_AMBIENT_HOOK_ENTRY);
  const stop = mergeManagedHook(stopHooks ?? [], "Stop", DOVE_CLAUDE_STOP_HOOK_COMMAND, DOVE_CLAUDE_STOP_HOOK_ENTRY);
  if (!prompt.changed && !stop.changed) return { settings, changed: false };
  return {
    settings: {
      ...settings,
      hooks: {
        ...hooks,
        UserPromptSubmit: prompt.entries,
        Stop: stop.entries
      }
    },
    changed: true
  };
}
function ambientContextForPrompt(prompt) {
  return isHighConfidenceAmbientWorkPrompt(prompt) ? AMBIENT_CONTEXT : null;
}
function renderClaudeAmbientRule() {
  return `# Dove

${USER_RESPONSE_POLICY.join("\n")}

Dove has ten flat Skills: research, status, source, experiment, draft, figure, review, rebuttal, lessons, and explicit-only auto.

The prompt hook selects hidden intake only for clear work requests. Intake routing is zero-write and never selects Auto. Slash commands keep their explicit routing.

When the user explicitly names Dove while giving feedback, criticism, correction, or an improvement request about it, or when Dove's own Skill, hook, project integration, routing, document behavior, or guidance actually fails during use, append a concise natural-language note to \`.dove/install/DOCTOR.md\`. When the user gives reusable feedback about ordinary research or collaboration without explicitly naming Dove, preserve it in the relevant Lessons Markdown instead. Preserve what happened, its user impact, and useful context. Do not create IDs, statuses, severity fields, counters, frontmatter, or a fixed template. Do not record ordinary research uncertainty, project bugs, external tool failures, or general conversation merely because Dove is active. Do not ask the user to run \`dove doctor\` for this feedback channel.
`;
}
function renderClaudeAmbientSkill() {
  return `---
name: dove-intake
description: Route a clear work request to the smallest suitable Dove Skill.
user-invocable: false
---

# Dove intake

Select research, status, source, experiment, draft, figure, review, rebuttal, or lessons, then continue the user's request with normal host tools. Never select Auto. Routing itself is zero-write. Ask only when a material ambiguity blocks the work.
`;
}

// src/core/ambient-hook.mjs
function parseHookPayload(input) {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Dove UserPromptSubmit hook received malformed JSON.");
  }
  if (payload?.hook_event_name !== "UserPromptSubmit") {
    throw new Error("Dove UserPromptSubmit hook received an unsupported or missing hook event.");
  }
  if (typeof payload?.prompt !== "string") {
    throw new Error("Dove UserPromptSubmit hook requires a string prompt.");
  }
  return payload;
}
function userPromptSubmitOutput(input) {
  const payload = parseHookPayload(input);
  const additionalContext = ambientContextForPrompt(payload.prompt);
  if (additionalContext === null) return null;
  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext
    }
  };
}

// src/core/stop-hook.mjs
function parseStopPayload(input) {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Dove Stop hook received malformed JSON.");
  }
  if (payload?.hook_event_name !== "Stop") {
    throw new Error("Dove Stop hook received an unsupported or missing hook event.");
  }
  return payload;
}
function stopHookOutput(input) {
  const payload = parseStopPayload(input);
  if (payload.stop_hook_active === true) return null;
  if (typeof payload.last_assistant_message !== "string" || payload.last_assistant_message.trim() === "") return null;
  return {
    decision: "block",
    reason: "\u8BF4\u4EBA\u8BDD"
  };
}

// src/core/research-defaults.mjs
import crypto from "node:crypto";
import fs3 from "node:fs";
import path3 from "node:path";

// src/core/rooted-filesystem.mjs
import fs2 from "node:fs";
import path2 from "node:path";
function realpathNative(fsOps, targetPath) {
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(targetPath) : fsOps.realpathSync(targetPath);
}
function normalizeRelativePath(relativePath, label = "Filesystem path") {
  if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error(`${label} must be a non-empty relative path.`);
  if (relativePath.includes("\0") || path2.posix.isAbsolute(relativePath) || path2.win32.isAbsolute(relativePath) || relativePath.startsWith("\\\\")) {
    throw new Error(`${label} must stay inside the rooted workspace: ${relativePath}`);
  }
  const supplied = relativePath.replace(/\\/gu, "/");
  const normalized = path2.posix.normalize(supplied);
  if (supplied !== normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`${label} must stay inside the rooted workspace: ${relativePath}`);
  }
  return normalized;
}
var RootedFilesystem = class {
  constructor(root, options = {}) {
    this.fsOps = options.fsOps ?? fs2;
    this.root = realpathNative(this.fsOps, path2.resolve(root));
    const stat = this.fsOps.lstatSync(this.root);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Rooted workspace must be a real directory: ${this.root}`);
  }
  normalize(relativePath, label) {
    return normalizeRelativePath(relativePath, label);
  }
  displayPath(relativePath) {
    const normalized = this.normalize(relativePath);
    const target = path2.resolve(this.root, ...normalized.split("/"));
    const relative = path2.relative(this.root, target);
    if (relative === "" || relative === ".." || relative.startsWith(`..${path2.sep}`) || path2.isAbsolute(relative)) {
      throw new Error(`Filesystem path must stay inside the rooted workspace: ${relativePath}`);
    }
    return target;
  }
  assertParentChain(relativePath) {
    const normalized = this.normalize(relativePath);
    let current = this.root;
    for (const component of normalized.split("/").slice(0, -1)) {
      current = path2.join(current, component);
      let stat;
      try {
        stat = this.fsOps.lstatSync(current);
      } catch (error) {
        if (error?.code === "ENOENT") return;
        throw error;
      }
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Rooted directory component must be a real directory: ${path2.relative(this.root, current)}`);
    }
  }
  lstat(relativePath) {
    this.assertParentChain(relativePath);
    return this.fsOps.lstatSync(this.displayPath(relativePath));
  }
  tryLstat(relativePath) {
    try {
      return this.lstat(relativePath);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }
  exists(relativePath) {
    return this.tryLstat(relativePath) !== null;
  }
  inspectRegularFile(relativePath) {
    const stat = this.lstat(relativePath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Rooted read target must be a regular file: ${relativePath}`);
    return stat;
  }
  readFile(relativePath) {
    this.inspectRegularFile(relativePath);
    return Buffer.from(this.fsOps.readFileSync(this.displayPath(relativePath)));
  }
  writeNewFile(relativePath, content, options = {}) {
    this.assertParentChain(relativePath);
    this.fsOps.writeFileSync(this.displayPath(relativePath), content, {
      flag: "wx",
      mode: options.mode ?? 384,
      ...options.encoding === void 0 ? {} : { encoding: options.encoding }
    });
  }
  chmod(relativePath, mode) {
    this.inspectRegularFile(relativePath);
    this.fsOps.chmodSync(this.displayPath(relativePath), mode);
  }
  mkdir(relativePath, options = {}) {
    const normalized = this.normalize(relativePath, "Directory path");
    if (options.recursive === true) {
      let current = "";
      for (const component of normalized.split("/")) {
        current = current ? `${current}/${component}` : component;
        const stat = this.tryLstat(current);
        if (stat) {
          if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Rooted directory component is not a real directory: ${current}`);
          continue;
        }
        this.mkdir(current, { mode: options.mode });
      }
      return;
    }
    this.assertParentChain(normalized);
    this.fsOps.mkdirSync(this.displayPath(normalized), {
      recursive: false,
      ...options.mode === void 0 ? {} : { mode: options.mode }
    });
  }
  readdir(relativePath = null, options = {}) {
    const target = relativePath === null || relativePath === "" || relativePath === "." ? this.root : this.displayPath(relativePath);
    if (relativePath !== null && relativePath !== "" && relativePath !== ".") {
      const stat = this.lstat(relativePath);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Rooted directory must be a real directory: ${relativePath}`);
    }
    return this.fsOps.readdirSync(target, options);
  }
  rename(fromRelativePath, toRelativePath) {
    const from = this.normalize(fromRelativePath, "Rename source");
    const to = this.normalize(toRelativePath, "Rename destination");
    this.assertParentChain(from);
    this.assertParentChain(to);
    const sourceStat = this.fsOps.lstatSync(this.displayPath(from));
    if (sourceStat.isSymbolicLink()) throw new Error(`Rooted rename source must not be a symbolic link: ${from}`);
    const destinationStat = this.tryLstat(to);
    if (destinationStat?.isSymbolicLink()) throw new Error(`Rooted rename destination must not be a symbolic link: ${to}`);
    this.fsOps.renameSync(this.displayPath(from), this.displayPath(to));
  }
  unlink(relativePath, options = {}) {
    try {
      const stat = this.lstat(relativePath);
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Rooted unlink target must be a regular file: ${relativePath}`);
      this.fsOps.unlinkSync(this.displayPath(relativePath));
    } catch (error) {
      if (options.force === true && error?.code === "ENOENT") return;
      throw error;
    }
  }
  rmdir(relativePath, options = {}) {
    try {
      const normalized = this.normalize(relativePath);
      const stat = this.lstat(normalized);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Rooted removal target must be a real directory: ${normalized}`);
      this.fsOps.rmdirSync(this.displayPath(normalized));
    } catch (error) {
      if (options.force === true && error?.code === "ENOENT") return;
      throw error;
    }
  }
  remove(relativePath, options = {}) {
    const normalized = this.normalize(relativePath, "Removal path");
    const stat = this.tryLstat(normalized);
    if (!stat) {
      if (options.force === true) return;
      const error = new Error(`Rooted removal target does not exist: ${normalized}`);
      error.code = "ENOENT";
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Rooted removal target must not be a symbolic link: ${normalized}`);
    if (stat.isDirectory()) {
      if (options.recursive !== true) return this.rmdir(normalized);
      for (const entry of this.readdir(normalized, { withFileTypes: true })) {
        const childPath = `${normalized}/${entry.name}`;
        const childStat = this.lstat(childPath);
        if (childStat.isSymbolicLink()) throw new Error(`Rooted cleanup encountered a symbolic link: ${childPath}`);
        if (childStat.isDirectory()) this.remove(childPath, { recursive: true });
        else if (childStat.isFile()) this.unlink(childPath);
        else throw new Error(`Rooted cleanup encountered an unsupported path type: ${childPath}`);
      }
      return this.rmdir(normalized, { force: options.force });
    }
    if (stat.isFile()) return this.unlink(normalized, { force: options.force });
    throw new Error(`Rooted removal target has an unsupported path type: ${normalized}`);
  }
};
function openRootedFilesystem(root, options = {}) {
  return new RootedFilesystem(root, options);
}

// src/core/research-defaults.mjs
var RESEARCH_ROOT = ARTIFACT_PATHS.researchDocumentsDir;
var RESEARCH_DEFAULT_PATHS = Object.freeze({
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
var OVERVIEW_LINKS = Object.freeze([
  "- [Missions](missions/MISSIONS.md)",
  "- [Experiments](experiments/EXPERIMENTS.md)",
  "- [Sources](sources/SOURCES.md)",
  "- [Reviews](reviews/REVIEWS.md)",
  "- [Claims](claims/CLAIMS.md)",
  "- [Lessons](lessons/LESSONS.md)"
]);
var LESSON_LINKS = Object.freeze([
  "- [Decision making](decision-making.md)",
  "- [Research method](research-method.md)",
  "- [Experiments and evidence](experiments-and-evidence.md)",
  "- [Engineering and validation](engineering-and-validation.md)",
  "- [Writing and review](writing-and-review.md)",
  "- [Collaboration and environment](collaboration-and-environment.md)"
]);
var ADDITIONAL_LESSONS_LINK = "- [Additional migrated Lessons](additional-lessons.md)";
var IMPORTED_LESSONS_LINK = "- [Imported legacy Lessons](imported-lessons.md)";
var SUMMARY_DOCUMENTS = Object.freeze([
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
var RESEARCH_LESSON_TOPICS = Object.freeze([
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
  return `${parts.join("\n\n")}
`;
}
function topicDocument(topic) {
  return renderDocument({ title: topic.title, blocks: [topic.intro, ...topic.paragraphs] });
}
var RESEARCH_DEFAULT_DOCUMENTS = Object.freeze([
  ...SUMMARY_DOCUMENTS.map((document) => Object.freeze({ path: document.path, content: renderDocument(document) })),
  ...RESEARCH_LESSON_TOPICS.map((topic) => Object.freeze({ path: topic.path, content: topicDocument(topic) }))
]);
var RESEARCH_DEFAULT_FILE_PATHS = Object.freeze(RESEARCH_DEFAULT_DOCUMENTS.map((document) => document.path));
var RESEARCH_DEFAULT_DIRECTORY_PATHS = Object.freeze([
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
  const resolved = path3.resolve(root);
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
    mode: stat.mode & 4095
  };
}
function assertRealDirectoryIfPresent(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error(`${relativePath} must be a real directory.`);
  return stat !== null;
}
function expectedState(state2) {
  return state2.exists ? { exists: true, type: "file", sha256: state2.sha256, mode: state2.mode } : { exists: false, type: "absent", sha256: null, mode: null };
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
    const startsAtLineBoundary = index === 0 || index === 1 && text[0] === "\uFEFF" || text[index - 1] === "\n";
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
  if (bytes.at(-1) === 10) return Buffer.from("\n");
  return Buffer.from("\n\n");
}
function appendExactMarkdownBlocks(original, blocks) {
  let result = String(original);
  for (const raw of blocks) {
    const block = String(raw).trimEnd();
    if (!block || exactMarkdownBlockPresent(result, block)) continue;
    result += `${appendSeparator(result)}${block}
`;
  }
  return result;
}
function appendExactMarkdownBytes(original, addition) {
  const existing = Buffer.isBuffer(original) ? Buffer.from(original) : Buffer.from(original ?? "");
  const appended = Buffer.isBuffer(addition) ? Buffer.from(addition) : Buffer.from(addition ?? "");
  if (appended.length === 0 || existing.indexOf(appended) !== -1) return existing;
  return Buffer.concat([existing, appendByteSeparator(existing), appended]);
}
function appendExactMarkdownLines(original, heading, lines) {
  const missing = lines.filter((line) => !exactLinePresent(original, line));
  if (missing.length === 0) return original;
  const parts = [];
  if (heading && !exactLinePresent(original, heading)) parts.push(heading);
  parts.push(...missing);
  return appendExactMarkdownBlocks(original, [parts.join("\n")]);
}
function readResearchDefaultsSnapshot(root, options = {}) {
  const fsOps = options.fsOps ?? fs3;
  const replace = options.mode === "replace";
  const anchor = openRootedFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
  for (const directoryPath of RESEARCH_DEFAULT_DIRECTORY_PATHS) assertRealDirectoryIfPresent(anchor, directoryPath);
  const states = /* @__PURE__ */ new Map();
  const selectedPaths = /* @__PURE__ */ new Set([
    ...RESEARCH_DEFAULT_FILE_PATHS,
    RESEARCH_DEFAULT_PATHS.additionalLessons,
    RESEARCH_DEFAULT_PATHS.importedLessons,
    RESEARCH_DEFAULT_PATHS.retiredTopLevelLessons
  ]);
  for (const relativePath of selectedPaths) states.set(relativePath, readFileState(anchor, relativePath, { decode: !replace }));
  const lessonMarkdownStates = /* @__PURE__ */ new Map();
  if (!replace && anchor.tryLstat(RESEARCH_DEFAULT_PATHS.lessonsDirectory)) {
    for (const entry of anchor.readdir(RESEARCH_DEFAULT_PATHS.lessonsDirectory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.name.endsWith(".md")) continue;
      const relativePath = `${RESEARCH_DEFAULT_PATHS.lessonsDirectory}/${entry.name}`;
      if (entry.isSymbolicLink() || !entry.isFile()) throw new Error(`${relativePath} must be a regular Markdown file without symbolic links.`);
      const state2 = states.get(relativePath) ?? readFileState(anchor, relativePath);
      states.set(relativePath, state2);
      lessonMarkdownStates.set(relativePath, state2);
    }
  }
  return { states, lessonMarkdownStates };
}
function stateFor(snapshot, relativePath) {
  return snapshot.states.get(relativePath) ?? absentState(relativePath);
}
function setWrite(writes, snapshot, relativePath, content) {
  const bytes = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), "utf8");
  const state2 = stateFor(snapshot, relativePath);
  if (state2.exists && state2.bytes.equals(bytes)) {
    writes.delete(relativePath);
    return;
  }
  writes.set(relativePath, bytes);
}
function currentText(snapshot, writes, relativePath) {
  if (writes.has(relativePath)) return decodeMarkdown(writes.get(relativePath), relativePath);
  const state2 = stateFor(snapshot, relativePath);
  return state2.exists ? state2.text : null;
}
function planSummaryDocument(snapshot, writes, document, extraLines = []) {
  const state2 = stateFor(snapshot, document.path);
  if (!state2.exists) {
    const content2 = renderDocument({
      ...document,
      navigationLines: [...document.navigationLines, ...extraLines]
    });
    setWrite(writes, snapshot, document.path, content2);
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
function planResearchDefaults(snapshot, options = {}) {
  if (!snapshot || !(snapshot.states instanceof Map) || !(snapshot.lessonMarkdownStates instanceof Map)) {
    throw new Error("Research defaults planning requires a research Markdown snapshot.");
  }
  const mode = options.mode ?? "sync";
  if (!(/* @__PURE__ */ new Set(["sync", "replace"])).has(mode)) throw new Error(`Unsupported research defaults planning mode: ${mode}.`);
  const writes = /* @__PURE__ */ new Map();
  const deletes = /* @__PURE__ */ new Set();
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
    const extraLines = document.path === RESEARCH_DEFAULT_PATHS.lessonsSummary && additionalWillExist ? [ADDITIONAL_LESSONS_LINK] : [];
    planSummaryDocument(snapshot, writes, document, extraLines);
  }
  const lessonCorpus = [
    ...snapshot.lessonMarkdownStates.values(),
    ...retired.exists ? [retired] : []
  ].map((state2) => state2.text);
  if (writes.has(RESEARCH_DEFAULT_PATHS.additionalLessons)) {
    lessonCorpus.push(currentText(snapshot, writes, RESEARCH_DEFAULT_PATHS.additionalLessons));
  }
  lessonCorpus.push(...additionalLessonTexts(options));
  for (const topic of RESEARCH_LESSON_TOPICS) {
    const state2 = stateFor(snapshot, topic.path);
    if (!state2.exists) {
      setWrite(writes, snapshot, topic.path, topicDocument(topic));
      continue;
    }
    const missingParagraphs = topic.paragraphs.filter((paragraph) => !lessonCorpus.some((text) => exactMarkdownBlockPresent(text, paragraph)));
    const content = appendExactMarkdownBlocks(state2.text, missingParagraphs);
    setWrite(writes, snapshot, topic.path, content);
  }
  return { writes, deletes };
}
function researchDefaultTransactionEntries(root, snapshot, plan, options = {}) {
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
function prepareResearchDefaults(root, options = {}) {
  const fsOps = options.fsOps ?? fs3;
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

// src/core/research-documents.mjs
import fs4 from "node:fs";
import path4 from "node:path";

// src/core/strict-json.mjs
function duplicateKeyError(label, key, path12) {
  throw new Error(`${label} must not contain duplicate JSON object keys: ${path12 === "$" ? key : `${path12}.${key}`}.`);
}
function parseJsonWithoutDuplicateKeys(text, label = "JSON input") {
  if (typeof text !== "string") throw new Error(`${label} must contain valid JSON.`);
  let index = 0;
  function skipWhitespace() {
    while (/\s/u.test(text[index] ?? "")) index += 1;
  }
  function parseString() {
    if (text[index] !== '"') throw new Error(`${label} must contain valid JSON.`);
    const start = index;
    index += 1;
    let escaped = false;
    while (index < text.length) {
      const character = text[index];
      index += 1;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') {
        return JSON.parse(text.slice(start, index));
      }
      if (character.charCodeAt(0) < 32) throw new Error(`${label} must contain valid JSON.`);
    }
    throw new Error(`${label} must contain valid JSON.`);
  }
  function parseNumber() {
    const match = text.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u);
    if (!match) throw new Error(`${label} must contain valid JSON.`);
    index += match[0].length;
  }
  function parseArray(path12) {
    index += 1;
    skipWhitespace();
    if (text[index] === "]") {
      index += 1;
      return;
    }
    let itemIndex = 0;
    while (true) {
      parseValue(`${path12}[${itemIndex}]`);
      itemIndex += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      if (text[index] !== ",") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      skipWhitespace();
    }
  }
  function parseObject(path12) {
    index += 1;
    skipWhitespace();
    if (text[index] === "}") {
      index += 1;
      return;
    }
    const keys = /* @__PURE__ */ new Set();
    while (true) {
      const key = parseString();
      if (keys.has(key)) duplicateKeyError(label, key, path12);
      keys.add(key);
      skipWhitespace();
      if (text[index] !== ":") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      parseValue(path12 === "$" ? `$.${key}` : `${path12}.${key}`);
      skipWhitespace();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      if (text[index] !== ",") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      skipWhitespace();
    }
  }
  function parseValue(path12) {
    skipWhitespace();
    const character = text[index];
    if (character === "{") parseObject(path12);
    else if (character === "[") parseArray(path12);
    else if (character === '"') parseString();
    else if (character === "-" || /\d/u.test(character ?? "")) parseNumber();
    else if (text.startsWith("true", index)) index += 4;
    else if (text.startsWith("false", index)) index += 5;
    else if (text.startsWith("null", index)) index += 4;
    else throw new Error(`${label} must contain valid JSON.`);
    skipWhitespace();
  }
  try {
    parseValue("$");
    skipWhitespace();
    if (index !== text.length) throw new Error(`${label} must contain valid JSON.`);
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${label} must not contain duplicate`)) throw error;
    throw new Error(`${label} must contain valid JSON.`);
  }
}

// src/core/research-documents.mjs
var V2_FORMAT_PATH = ".dove/format.json";
var V2_FORMAT = "dove-research-v2";
var RESEARCH_DOCUMENT_PATHS = Object.freeze({ ...RESEARCH_DEFAULT_PATHS });
var SUMMARY_ENTRIES = Object.freeze([
  Object.freeze(["missions", RESEARCH_DOCUMENT_PATHS.missionsDirectory, RESEARCH_DOCUMENT_PATHS.missionsSummary]),
  Object.freeze(["experiments", RESEARCH_DOCUMENT_PATHS.experimentsDirectory, RESEARCH_DOCUMENT_PATHS.experimentsSummary]),
  Object.freeze(["sources", RESEARCH_DOCUMENT_PATHS.sourcesDirectory, RESEARCH_DOCUMENT_PATHS.sourcesSummary]),
  Object.freeze(["reviews", RESEARCH_DOCUMENT_PATHS.reviewsDirectory, RESEARCH_DOCUMENT_PATHS.reviewsSummary]),
  Object.freeze(["claims", RESEARCH_DOCUMENT_PATHS.claimsDirectory, RESEARCH_DOCUMENT_PATHS.claimsSummary]),
  Object.freeze(["lessons", RESEARCH_DOCUMENT_PATHS.lessonsDirectory, RESEARCH_DOCUMENT_PATHS.lessonsSummary])
]);
function messageFor(error) {
  return error instanceof Error ? error.message : String(error);
}
function canonicalRoot2(root, fsOps) {
  const resolved = path4.resolve(root);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}
function readMarkdown(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return null;
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${relativePath} must be a regular file without symbolic links.`);
  }
  let markdown;
  try {
    markdown = new TextDecoder("utf-8", { fatal: true }).decode(anchor.readFile(relativePath));
  } catch (error) {
    throw new Error(`${relativePath} must contain valid UTF-8 Markdown.`, { cause: error });
  }
  if (markdown.includes("\0")) throw new Error(`${relativePath} contains null bytes.`);
  return markdown;
}
function inspectDirectory(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return false;
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${relativePath} must be a real directory.`);
  return true;
}
function emptyResult(state2, fields = {}) {
  return {
    healthy: true,
    state: state2,
    root: RESEARCH_DOCUMENT_PATHS.root,
    overview: null,
    summaries: {
      missions: null,
      experiments: null,
      sources: null,
      reviews: null,
      claims: null,
      lessons: null
    },
    missingSummaries: SUMMARY_ENTRIES.map(([, , summaryPath]) => summaryPath),
    ...fields
  };
}
function inspectResearchDocuments(root, options = {}) {
  const fsOps = options.fsOps ?? fs4;
  let anchor;
  try {
    anchor = openRootedFilesystem(canonicalRoot2(root, fsOps), { ...options, fsOps });
    const directory = anchor.tryLstat(RESEARCH_DOCUMENT_PATHS.root);
    if (!directory) {
      const format = anchor.tryLstat(V2_FORMAT_PATH);
      if (format) {
        if (format.isSymbolicLink() || !format.isFile()) {
          throw new Error(`${V2_FORMAT_PATH} must be a regular file without symbolic links.`);
        }
        const marker = parseJsonWithoutDuplicateKeys(
          new TextDecoder("utf-8", { fatal: true }).decode(anchor.readFile(V2_FORMAT_PATH)),
          V2_FORMAT_PATH
        );
        if (marker?.format === V2_FORMAT && Object.keys(marker).length === 1) {
          return emptyResult("previous-research-format", { exportCommand: "dove export-research" });
        }
      }
      return emptyResult("absent");
    }
    if (directory.isSymbolicLink() || !directory.isDirectory()) {
      throw new Error(`${RESEARCH_DOCUMENT_PATHS.root} must be a real directory.`);
    }
    const overview2 = readMarkdown(anchor, RESEARCH_DOCUMENT_PATHS.overview);
    const summaries = {};
    const missingSummaries = [];
    for (const [name, directoryPath, summaryPath] of SUMMARY_ENTRIES) {
      const directoryExists = inspectDirectory(anchor, directoryPath);
      const markdown = directoryExists ? readMarkdown(anchor, summaryPath) : null;
      summaries[name] = markdown === null ? null : { path: summaryPath };
      if (markdown === null) missingSummaries.push(summaryPath);
    }
    return {
      healthy: true,
      state: "current",
      root: RESEARCH_DOCUMENT_PATHS.root,
      overview: overview2 === null ? null : { path: RESEARCH_DOCUMENT_PATHS.overview },
      summaries,
      missingSummaries
    };
  } catch (error) {
    return {
      healthy: false,
      state: "invalid",
      root: RESEARCH_DOCUMENT_PATHS.root,
      overview: null,
      summaries: {
        missions: null,
        experiments: null,
        sources: null,
        reviews: null,
        claims: null,
        lessons: null
      },
      missingSummaries: [],
      error: messageFor(error)
    };
  }
}

// src/core/research-export.mjs
import crypto3 from "node:crypto";
import fs6 from "node:fs";
import path6 from "node:path";

// src/core/file-set-transaction.mjs
import crypto2 from "node:crypto";
import fs5 from "node:fs";
import path5 from "node:path";
var MAX_CLEANUP_WARNINGS = 20;
var ENTRY_FIELDS = /* @__PURE__ */ new Set(["root", "relativePath", "content", "encoding", "force", "delete", "deleteEmptyDirectory", "expectedState", "label"]);
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function sha2562(content) {
  return crypto2.createHash("sha256").update(content).digest("hex");
}
function state(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return { exists: false, type: "absent", sha256: null, mode: null };
  if (stat.isSymbolicLink()) return { exists: true, type: "symlink", sha256: null, mode: stat.mode & 4095 };
  if (stat.isDirectory()) return { exists: true, type: "directory", sha256: null, mode: stat.mode & 4095 };
  if (!stat.isFile()) return { exists: true, type: "other", sha256: null, mode: stat.mode & 4095 };
  return { exists: true, type: "file", sha256: sha2562(anchor.readFile(relativePath)), mode: stat.mode & 4095 };
}
function sameState(left, right) {
  return left.exists === right.exists && left.type === right.type && left.sha256 === right.sha256 && left.mode === right.mode;
}
function expectedState2(raw, index) {
  if (raw === void 0) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Transactional write entry ${index} expectedState must be an object.`);
  const keys = Object.keys(raw).sort();
  if (keys.join(",") !== "exists,mode,sha256,type") throw new Error(`Transactional write entry ${index} expectedState must contain exactly exists, type, sha256, and mode.`);
  if (typeof raw.exists !== "boolean" || !["absent", "directory", "file"].includes(raw.type)) throw new Error(`Transactional write entry ${index} expectedState is invalid.`);
  if (raw.exists !== (raw.type !== "absent")) throw new Error(`Transactional write entry ${index} expectedState existence is contradictory.`);
  if (raw.exists ? !Number.isInteger(raw.mode) || raw.mode < 0 || raw.mode > 4095 : raw.mode !== null) throw new Error(`Transactional write entry ${index} expectedState mode is invalid.`);
  if (raw.type === "file") {
    if (typeof raw.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(raw.sha256)) throw new Error(`Transactional write entry ${index} expectedState file requires a lowercase SHA-256 digest.`);
  } else if (raw.sha256 !== null) {
    throw new Error(`Transactional write entry ${index} expectedState ${raw.type} must use a null digest.`);
  }
  return { exists: raw.exists, type: raw.type, sha256: raw.sha256, mode: raw.mode };
}
function parentDirectories(relativePath) {
  const directories = [];
  let current = path5.posix.dirname(relativePath);
  while (current !== ".") {
    directories.push(current);
    current = path5.posix.dirname(current);
  }
  return directories.reverse();
}
function inspectParentDirectories(anchor, relativePath) {
  for (const directoryPath of parentDirectories(relativePath)) {
    const stat = anchor.tryLstat(directoryPath);
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error(`Transactional directory component must be a real directory: ${directoryPath}`);
    if (!stat) break;
  }
}
function ensureParentDirectories(anchor, relativePath, createdDirectories) {
  for (const directoryPath of parentDirectories(relativePath)) {
    const stat = anchor.tryLstat(directoryPath);
    if (stat) {
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Transactional directory component must be a real directory: ${directoryPath}`);
      continue;
    }
    anchor.mkdir(directoryPath);
    createdDirectories.push(directoryPath);
  }
}
function removeNewTransactionParents(anchor, transaction) {
  if (anchor.exists(transaction.transactionBase) && anchor.readdir(transaction.transactionBase).length === 0) anchor.rmdir(transaction.transactionBase, { force: true });
  for (const parent of [...transaction.transactionParents].reverse()) {
    if (!parent.existed && anchor.exists(parent.relativePath) && anchor.readdir(parent.relativePath).length === 0) anchor.rmdir(parent.relativePath, { force: true });
  }
}
function assertNoUnexpectedChildren(entry, resolved) {
  const scheduledChildren = new Set(resolved.filter((candidate) => candidate.anchor === entry.anchor && candidate.deleting && path5.posix.dirname(candidate.relativePath) === entry.relativePath).map((candidate) => path5.posix.basename(candidate.relativePath)));
  const unexpected = entry.anchor.readdir(entry.relativePath).map((child) => typeof child === "string" ? child : child.name).filter((child) => !scheduledChildren.has(child));
  if (unexpected.length > 0) {
    throw new Error(`Transactional directory deletion found an unscheduled child: ${entry.relativePath}/${unexpected.sort().join(`, ${entry.relativePath}/`)}.`);
  }
}
function committedResult(entries, cleanupFailures) {
  const warnings = cleanupFailures.slice(0, MAX_CLEANUP_WARNINGS);
  return {
    writtenPaths: entries.filter((entry) => !entry.deleting).map((entry) => entry.relativePath),
    removedPaths: entries.filter((entry) => entry.deleting).map((entry) => entry.relativePath),
    changedPaths: entries.map((entry) => entry.relativePath),
    cleanupWarnings: warnings,
    omittedCleanupWarningCount: Math.max(0, cleanupFailures.length - warnings.length)
  };
}
function writeFileSetTransaction(entries, options = {}) {
  if (!Array.isArray(entries)) throw new Error("Transactional write entries must be an array.");
  const fsOps = options.fsOps ?? fs5;
  const transactionId = (options.transactionId ?? crypto2.randomUUID()).replace(/[^a-z0-9._-]/giu, "-");
  const anchors = /* @__PURE__ */ new Map();
  const resolved = [];
  const targets = /* @__PURE__ */ new Set();
  const transactions = /* @__PURE__ */ new Map();
  const promotions = [];
  const createdDirectories = /* @__PURE__ */ new Map();
  const anchorFor = (root) => {
    const canonicalRoot4 = typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(path5.resolve(root)) : fsOps.realpathSync(path5.resolve(root));
    if (!anchors.has(canonicalRoot4)) anchors.set(canonicalRoot4, openRootedFilesystem(canonicalRoot4, { fsOps }));
    return anchors.get(canonicalRoot4);
  };
  try {
    for (const [index, entry] of entries.entries()) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Transactional write entry ${index} must be an object.`);
      const unknownFields = Object.keys(entry).filter((field) => !ENTRY_FIELDS.has(field));
      if (unknownFields.length > 0) throw new Error(`Transactional write entry ${index} uses unsupported fields: ${unknownFields.join(", ")}.`);
      const anchor = anchorFor(entry.root);
      const relativePath = anchor.normalize(entry.relativePath, entry.label ?? "Transactional write path");
      const key = `${anchor.root}\0${relativePath}`;
      if (targets.has(key)) throw new Error(`Transactional write set contains duplicate target ${relativePath}.`);
      targets.add(key);
      inspectParentDirectories(anchor, relativePath);
      const previous = state(anchor, relativePath);
      const approvedState = expectedState2(entry.expectedState, index);
      if (approvedState !== null && !sameState(previous, approvedState)) throw new Error(`Transactional write approved precondition changed for ${relativePath}.`);
      const deleting = entry.delete === true;
      const deletingEmptyDirectory = deleting && entry.deleteEmptyDirectory === true;
      if (previous.exists && previous.type !== "file" && !(deletingEmptyDirectory && previous.type === "directory")) {
        throw new Error(`Transactional write target must be absent or a regular file${deletingEmptyDirectory ? " or an explicitly selected empty directory" : ""}: ${relativePath}.`);
      }
      if (deleting && !previous.exists) continue;
      if (!deleting && previous.exists && entry.force !== true) continue;
      resolved.push({
        ...entry,
        anchor,
        relativePath,
        deleting,
        deletingEmptyDirectory,
        previous,
        content: deleting ? null : Buffer.isBuffer(entry.content) ? Buffer.from(entry.content) : Buffer.from(String(entry.content ?? ""), entry.encoding ?? "utf8")
      });
    }
    if (resolved.length === 0) return committedResult([], []);
    for (const anchor of new Set(resolved.map((entry) => entry.anchor))) {
      const transactionBase = anchor.normalize(options.transactionBase ?? ".dove/install/transactions", "Transactional staging base");
      const transactionPath = `${transactionBase}/${transactionId}`;
      if (anchor.exists(transactionPath)) throw new Error(`Transactional staging path is already occupied: ${anchor.displayPath(transactionPath)}.`);
      const transactionParents = parentDirectories(`${transactionPath}/placeholder`).map((relativePath) => ({ relativePath, existed: anchor.exists(relativePath) }));
      anchor.mkdir(transactionPath, { recursive: true });
      anchor.mkdir(`${transactionPath}/backups`);
      transactions.set(anchor, { transactionBase, transactionPath, transactionParents, backupRoot: `${transactionPath}/backups` });
      createdDirectories.set(anchor, []);
    }
    for (const [index, entry] of resolved.entries()) {
      if (entry.deleting) continue;
      const parent = path5.posix.dirname(entry.relativePath);
      const temporaryName = `.${path5.posix.basename(entry.relativePath)}.${transactionId}.${index}.tmp`;
      entry.stagedPath = parent === "." ? temporaryName : `${parent}/${temporaryName}`;
      ensureParentDirectories(entry.anchor, entry.relativePath, createdDirectories.get(entry.anchor));
      entry.anchor.writeNewFile(entry.stagedPath, entry.content);
      if (entry.previous.mode !== null) entry.anchor.chmod(entry.stagedPath, entry.previous.mode);
    }
    for (const [index, entry] of resolved.entries()) {
      const transaction = transactions.get(entry.anchor);
      const promotion = { entry, backupPath: null, promoted: false };
      promotions.push(promotion);
      ensureParentDirectories(entry.anchor, entry.relativePath, createdDirectories.get(entry.anchor));
      const actual = state(entry.anchor, entry.relativePath);
      if (!sameState(actual, entry.previous)) throw new Error(`Transactional write precondition changed for ${entry.relativePath}.`);
      if (entry.deletingEmptyDirectory) assertNoUnexpectedChildren(entry, resolved);
      if (entry.previous.exists) {
        promotion.backupPath = `${transaction.backupRoot}/file-${index}`;
        entry.anchor.rename(entry.relativePath, promotion.backupPath);
      }
      if (!entry.deleting) {
        entry.anchor.rename(entry.stagedPath, entry.relativePath);
        promotion.promoted = true;
      }
    }
    const cleanupFailures = [];
    for (const [anchor, transaction] of transactions) {
      try {
        anchor.remove(transaction.transactionPath, { recursive: true, force: true });
        removeNewTransactionParents(anchor, transaction);
      } catch (cleanupError) {
        cleanupFailures.push({ path: anchor.displayPath(transaction.transactionPath), reason: errorMessage(cleanupError) });
      }
    }
    return committedResult(resolved, cleanupFailures);
  } catch (error) {
    const rollbackFailures = [];
    const attempt = (callback) => {
      try {
        callback();
      } catch (rollbackError) {
        rollbackFailures.push(errorMessage(rollbackError));
      }
    };
    for (const promotion of [...promotions].reverse()) {
      const { entry } = promotion;
      if (promotion.promoted && entry.anchor.exists(entry.relativePath)) {
        attempt(() => entry.anchor.remove(entry.relativePath, { force: true }));
      }
      if (promotion.backupPath && entry.anchor.exists(promotion.backupPath)) attempt(() => {
        if (entry.anchor.exists(entry.relativePath)) throw new Error(`Transactional rollback target is occupied: ${entry.relativePath}.`);
        entry.anchor.rename(promotion.backupPath, entry.relativePath);
      });
    }
    for (const [anchor, directories] of createdDirectories) {
      for (const directoryPath of [...directories].sort((left, right) => right.length - left.length)) attempt(() => anchor.rmdir(directoryPath, { force: true }));
    }
    for (const entry of resolved) {
      if (entry.stagedPath && entry.anchor.exists(entry.stagedPath)) attempt(() => entry.anchor.remove(entry.stagedPath, { force: true }));
    }
    for (const [anchor, transaction] of transactions) {
      attempt(() => anchor.remove(transaction.transactionPath, { recursive: true, force: true }));
      attempt(() => removeNewTransactionParents(anchor, transaction));
    }
    if (rollbackFailures.length > 0) {
      throw new Error(`Transactional write failed and rollback also failed: ${errorMessage(error)}; rollback: ${rollbackFailures.join("; ")}`, { cause: error });
    }
    throw new Error(`Transactional write failed and all staged changes were rolled back: ${errorMessage(error)}`, { cause: error });
  }
}

// src/core/research-export.mjs
var V2_FORMAT2 = "dove-research-v2";
var OLD_ROOT = ".dove";
var NEW_ROOT = ".dove/research";
var ARCHIVE_ROOT = ".dove/archive";
var REQUIRED_FILES = [".dove/format.json", ".dove/workspace.json", ".dove/LESSONS.md"];
var RECORD_DIRECTORIES = [
  ["direction-decisions", "directionDecisions"],
  ["missions", "missions"],
  ["sources", "sources"],
  ["experiments", "experiments"],
  ["claims", "claims"],
  ["review-exchanges", "reviewExchanges"],
  ["reviews", "reviews"]
];
var RECORD_DIRECTORY_PATHS = RECORD_DIRECTORIES.map(([directory]) => `.dove/${directory}`);
var SAFE_FILE_PART = /[^\p{L}\p{N}._-]+/gu;
var SAFE_RESEARCH_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var SHA256 = /^[a-f0-9]{64}$/u;
var WORKSPACE_FIELDS = /* @__PURE__ */ new Set(["workspaceId", "researchQuestion", "mainline", "contributionIntent", "currentFocus", "createdAt", "updatedAt"]);
var MISSION_FIELDS = /* @__PURE__ */ new Set(["missionId", "parentMissionId", "dependsOnMissionIds", "branchKind", "branchReason", "goal", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs", "contributionRole", "createdAt"]);
var CONCLUSION_FIELDS = /* @__PURE__ */ new Set(["missionId", "outcome", "synthesis", "failures", "limitations", "uncertainty", "sourceIds", "experimentIds", "claimIds", "recommendedBranches", "concludedAt"]);
var SOURCE_FIELDS = /* @__PURE__ */ new Set(["sourceId", "missionId", "citationKey", "title", "authors", "year", "locator", "sourceType", "summary", "conditions", "relationship", "conflicts", "limitations", "capture", "recordedAt"]);
var CAPTURE_FIELDS = /* @__PURE__ */ new Set(["path", "sha256"]);
var PLAN_FIELDS = /* @__PURE__ */ new Set(["experimentId", "missionId", "title", "hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts", "cost", "risk", "failureValue", "contributionRole", "plannedAt"]);
var RESULT_FIELDS = /* @__PURE__ */ new Set(["experimentId", "missionId", "kind", "summary", "observations", "measurements", "denominator", "hypothesisImpacts", "claimImpacts", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations", "recordedAt"]);
var MEASUREMENT_FIELDS = /* @__PURE__ */ new Set(["metric", "value", "unit", "condition", "denominatorRef", "note"]);
var HYPOTHESIS_IMPACT_FIELDS = /* @__PURE__ */ new Set(["hypothesisRef", "impact", "rationale"]);
var CLAIM_IMPACT_FIELDS = /* @__PURE__ */ new Set(["claimId", "impact", "rationale"]);
var CLAIM_FIELDS = /* @__PURE__ */ new Set(["claimId", "missionId", "statement", "supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "assessment", "storyRole", "artifactRefs", "supersedesClaimId", "revisionReason", "recordedAt"]);
var REVIEW_EXCHANGE_FIELDS = /* @__PURE__ */ new Set(["exchangeId", "missionId", "artifacts", "preparedAt"]);
var REVIEW_ARTIFACT_FIELDS = /* @__PURE__ */ new Set(["path", "sha256"]);
var REVIEW_FIELDS = /* @__PURE__ */ new Set(["reviewId", "exchangeId", "missionId", "artifacts", "status", "verdict", "summary", "rubric", "findings", "actionItems", "report", "provenance", "limitations", "reviewedAt"]);
var DIRECTION_FIELDS = /* @__PURE__ */ new Set(["decisionId", "priorDirection", "nextDirection", "reason", "evidenceRefs", "missionRefs", "decidedAt"]);
var DIRECTION_VALUE_FIELDS = /* @__PURE__ */ new Set(["researchQuestion", "mainline", "contributionIntent"]);
function canonicalRoot3(root, fsOps) {
  const resolved = path6.resolve(root);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}
function timestamp(value) {
  const date = value === void 0 ? /* @__PURE__ */ new Date() : value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Research export now must be a Date or valid timestamp.");
  return date.toISOString().replace(/[-:]/gu, "").replace(".", "-");
}
function fileState(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return { exists: false, type: "absent", sha256: null, mode: null };
  if (stat.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
  if (stat.isDirectory()) return { exists: true, type: "directory", sha256: null, mode: stat.mode & 4095 };
  if (!stat.isFile()) throw new Error(`${relativePath} must be a regular file or directory.`);
  return { exists: true, type: "file", sha256: crypto3.createHash("sha256").update(anchor.readFile(relativePath)).digest("hex"), mode: stat.mode & 4095 };
}
function expectedTransactionState(state2) {
  if (state2.exists) {
    if (state2.type !== "file") throw new Error("Research Markdown export targets must be absent or regular files.");
    return { exists: true, type: "file", sha256: state2.sha256, mode: state2.mode };
  }
  return { exists: false, type: "absent", sha256: null, mode: null };
}
function readRequired(anchor, relativePath) {
  const state2 = fileState(anchor, relativePath);
  if (!state2.exists || state2.type !== "file") throw new Error(`legacy JSON research export requires ${relativePath} as a regular file.`);
  return { relativePath, bytes: anchor.readFile(relativePath), state: state2 };
}
function strictJson(file) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
  } catch (error) {
    throw new Error(`${file.relativePath} must contain valid UTF-8 JSON.`, { cause: error });
  }
  return parseJsonWithoutDuplicateKeys(text, file.relativePath);
}
function listJson(anchor, relativeDirectory) {
  const state2 = fileState(anchor, relativeDirectory);
  if (!state2.exists) return [];
  if (state2.type !== "directory") throw new Error(`${relativeDirectory} must be a real directory.`);
  const files = [];
  for (const entry of anchor.readdir(relativeDirectory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativeDirectory} may contain only regular JSON files for export: ${entry.name}.`);
    files.push(readRequired(anchor, relativePath));
  }
  return files;
}
function plainObject2(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value;
}
function exactFields(value, fields, label) {
  plainObject2(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} contains unsupported fields: ${unknown.join(", ")}.`);
  return value;
}
function researchId(value, label) {
  if (typeof value !== "string" || !SAFE_RESEARCH_ID.test(value)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return value;
}
function nonEmptyText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be non-empty text.`);
  return value;
}
function nullableText(value, label) {
  if (value === null) return value;
  return nonEmptyText(value, label);
}
function stringArray(value, label, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${label} must be an array of non-empty strings.`);
  return value;
}
function plainArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}
function exactTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO timestamp.`);
  return value;
}
function enumeration(value, allowed, label) {
  if (!allowed.includes(value)) throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  return value;
}
function assertFilename(file, expected, label) {
  if (path6.posix.basename(file.relativePath) !== expected) throw new Error(`${file.relativePath} does not match ${label} identifier ${expected}.`);
}
function validateWorkspace(value) {
  exactFields(value, WORKSPACE_FIELDS, "legacy JSON research Workspace");
  researchId(value.workspaceId, "legacy JSON research Workspace.workspaceId");
  for (const field of ["researchQuestion", "mainline", "contributionIntent", "currentFocus"]) nonEmptyText(value[field], `legacy JSON research Workspace.${field}`);
  exactTimestamp(value.createdAt, "legacy JSON research Workspace.createdAt");
  exactTimestamp(value.updatedAt, "legacy JSON research Workspace.updatedAt");
  if (value.updatedAt < value.createdAt) throw new Error("legacy JSON research Workspace.updatedAt must not precede createdAt.");
  return value;
}
function validateMissionEntry(entry) {
  const conclusion = entry.file.relativePath.endsWith(".conclusion.json");
  if (conclusion) {
    exactFields(entry.value, CONCLUSION_FIELDS, entry.file.relativePath);
    const missionId2 = researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
    assertFilename(entry.file, `${missionId2}.conclusion.json`, "Mission conclusion");
    enumeration(entry.value.outcome, ["completed", "blocked", "stopped"], `${entry.file.relativePath}.outcome`);
    nonEmptyText(entry.value.synthesis, `${entry.file.relativePath}.synthesis`);
    for (const field of ["failures", "limitations", "uncertainty", "sourceIds", "experimentIds", "claimIds", "recommendedBranches"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
    exactTimestamp(entry.value.concludedAt, `${entry.file.relativePath}.concludedAt`);
    return { kind: "conclusion", id: missionId2 };
  }
  exactFields(entry.value, MISSION_FIELDS, entry.file.relativePath);
  const missionId = researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  assertFilename(entry.file, `${missionId}.json`, "Mission");
  if (entry.value.parentMissionId !== null) researchId(entry.value.parentMissionId, `${entry.file.relativePath}.parentMissionId`);
  for (const field of ["dependsOnMissionIds", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
  for (const field of ["goal", "contributionRole"]) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
  nullableText(entry.value.branchKind, `${entry.file.relativePath}.branchKind`);
  nullableText(entry.value.branchReason, `${entry.file.relativePath}.branchReason`);
  exactTimestamp(entry.value.createdAt, `${entry.file.relativePath}.createdAt`);
  return { kind: "mission", id: missionId };
}
function validateSourceEntry(entry) {
  exactFields(entry.value, SOURCE_FIELDS, entry.file.relativePath);
  const sourceId = researchId(entry.value.sourceId, `${entry.file.relativePath}.sourceId`);
  assertFilename(entry.file, `${sourceId}.json`, "Source");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  if (entry.value.title === null && entry.value.locator === null) throw new Error(`${entry.file.relativePath} requires title or locator.`);
  for (const field of ["citationKey", "title", "locator", "sourceType"]) if (entry.value[field] !== null) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
  stringArray(entry.value.authors, `${entry.file.relativePath}.authors`);
  if (entry.value.year !== null && !["string", "number"].includes(typeof entry.value.year)) throw new Error(`${entry.file.relativePath}.year must be text, a number, or null.`);
  if (typeof entry.value.year === "string") nonEmptyText(entry.value.year, `${entry.file.relativePath}.year`);
  if (typeof entry.value.year === "number" && !Number.isFinite(entry.value.year)) throw new Error(`${entry.file.relativePath}.year must be finite.`);
  nonEmptyText(entry.value.summary, `${entry.file.relativePath}.summary`);
  enumeration(entry.value.relationship, ["consensus", "conflict", "condition-specific", "uncovered", "testable-gap"], `${entry.file.relativePath}.relationship`);
  for (const field of ["conditions", "conflicts", "limitations"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
  if (entry.value.capture !== null) {
    exactFields(entry.value.capture, CAPTURE_FIELDS, `${entry.file.relativePath}.capture`);
    nonEmptyText(entry.value.capture.path, `${entry.file.relativePath}.capture.path`);
    if (!SHA256.test(entry.value.capture.sha256)) throw new Error(`${entry.file.relativePath}.capture.sha256 must be a lowercase SHA-256 digest.`);
  }
  exactTimestamp(entry.value.recordedAt, `${entry.file.relativePath}.recordedAt`);
  return sourceId;
}
function validateExperimentEntry(entry) {
  const plan = entry.file.relativePath.endsWith(".plan.json");
  const result = entry.file.relativePath.endsWith(".result.json");
  if (!plan && !result) throw new Error(`${entry.file.relativePath} must use .plan.json or .result.json.`);
  if (plan) {
    exactFields(entry.value, PLAN_FIELDS, entry.file.relativePath);
    const experimentId2 = researchId(entry.value.experimentId, `${entry.file.relativePath}.experimentId`);
    assertFilename(entry.file, `${experimentId2}.plan.json`, "Experiment plan");
    researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
    for (const field of ["title", "cost", "risk", "failureValue", "contributionRole"]) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
    for (const field of ["hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`, ["protocol", "inputs", "metrics", "discriminatingObservations", "stopConditions"].includes(field) ? 1 : 0);
    exactTimestamp(entry.value.plannedAt, `${entry.file.relativePath}.plannedAt`);
    return { kind: "plan", id: experimentId2 };
  }
  exactFields(entry.value, RESULT_FIELDS, entry.file.relativePath);
  const experimentId = researchId(entry.value.experimentId, `${entry.file.relativePath}.experimentId`);
  assertFilename(entry.file, `${experimentId}.result.json`, "Experiment result");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  enumeration(entry.value.kind, ["positive", "negative", "null", "mixed", "failed", "stopped"], `${entry.file.relativePath}.kind`);
  nonEmptyText(entry.value.summary, `${entry.file.relativePath}.summary`);
  for (const field of ["observations", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
  plainArray(entry.value.measurements, `${entry.file.relativePath}.measurements`).forEach((measurement, index) => {
    exactFields(measurement, MEASUREMENT_FIELDS, `${entry.file.relativePath}.measurements[${index}]`);
    nonEmptyText(measurement.metric, `${entry.file.relativePath}.measurements[${index}].metric`);
    if (!["string", "number", "boolean"].includes(typeof measurement.value) || typeof measurement.value === "number" && !Number.isFinite(measurement.value)) throw new Error(`${entry.file.relativePath}.measurements[${index}].value is invalid.`);
    for (const field of ["unit", "condition", "denominatorRef", "note"]) if (measurement[field] !== void 0) nonEmptyText(measurement[field], `${entry.file.relativePath}.measurements[${index}].${field}`);
  });
  plainObject2(entry.value.denominator, `${entry.file.relativePath}.denominator`);
  plainArray(entry.value.hypothesisImpacts, `${entry.file.relativePath}.hypothesisImpacts`).forEach((impact, index) => {
    exactFields(impact, HYPOTHESIS_IMPACT_FIELDS, `${entry.file.relativePath}.hypothesisImpacts[${index}]`);
    nonEmptyText(impact.hypothesisRef, `${entry.file.relativePath}.hypothesisImpacts[${index}].hypothesisRef`);
    enumeration(impact.impact, ["supports", "weakens", "refutes", "mixed", "unchanged", "inconclusive"], `${entry.file.relativePath}.hypothesisImpacts[${index}].impact`);
    nonEmptyText(impact.rationale, `${entry.file.relativePath}.hypothesisImpacts[${index}].rationale`);
  });
  plainArray(entry.value.claimImpacts, `${entry.file.relativePath}.claimImpacts`).forEach((impact, index) => {
    exactFields(impact, CLAIM_IMPACT_FIELDS, `${entry.file.relativePath}.claimImpacts[${index}]`);
    researchId(impact.claimId, `${entry.file.relativePath}.claimImpacts[${index}].claimId`);
    enumeration(impact.impact, ["supports", "weakens", "refutes", "mixed", "unchanged", "inconclusive"], `${entry.file.relativePath}.claimImpacts[${index}].impact`);
    nonEmptyText(impact.rationale, `${entry.file.relativePath}.claimImpacts[${index}].rationale`);
  });
  exactTimestamp(entry.value.recordedAt, `${entry.file.relativePath}.recordedAt`);
  return { kind: "result", id: experimentId };
}
function validateClaimEntry(entry) {
  exactFields(entry.value, CLAIM_FIELDS, entry.file.relativePath);
  const claimId = researchId(entry.value.claimId, `${entry.file.relativePath}.claimId`);
  assertFilename(entry.file, `${claimId}.json`, "Claim");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  for (const field of ["statement", "storyRole"]) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
  for (const field of ["supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "artifactRefs"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
  enumeration(entry.value.assessment, ["supported", "weakened", "refuted", "inconclusive", "blocked"], `${entry.file.relativePath}.assessment`);
  if (entry.value.supersedesClaimId !== null) researchId(entry.value.supersedesClaimId, `${entry.file.relativePath}.supersedesClaimId`);
  nullableText(entry.value.revisionReason, `${entry.file.relativePath}.revisionReason`);
  exactTimestamp(entry.value.recordedAt, `${entry.file.relativePath}.recordedAt`);
  return claimId;
}
function validateReviewArtifact(value, label) {
  exactFields(value, REVIEW_ARTIFACT_FIELDS, label);
  nonEmptyText(value.path, `${label}.path`);
  if (!SHA256.test(value.sha256)) throw new Error(`${label}.sha256 must be a lowercase SHA-256 digest.`);
}
function validateReviewExchangeEntry(entry) {
  exactFields(entry.value, REVIEW_EXCHANGE_FIELDS, entry.file.relativePath);
  const exchangeId = researchId(entry.value.exchangeId, `${entry.file.relativePath}.exchangeId`);
  assertFilename(entry.file, `${exchangeId}.json`, "ReviewExchange");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  plainArray(entry.value.artifacts, `${entry.file.relativePath}.artifacts`).forEach((artifact, index) => validateReviewArtifact(artifact, `${entry.file.relativePath}.artifacts[${index}]`));
  if (entry.value.artifacts.length === 0) throw new Error(`${entry.file.relativePath}.artifacts must not be empty.`);
  exactTimestamp(entry.value.preparedAt, `${entry.file.relativePath}.preparedAt`);
  return exchangeId;
}
function validateReviewEntry(entry) {
  exactFields(entry.value, REVIEW_FIELDS, entry.file.relativePath);
  const reviewId = researchId(entry.value.reviewId, `${entry.file.relativePath}.reviewId`);
  const exchangeId = researchId(entry.value.exchangeId, `${entry.file.relativePath}.exchangeId`);
  if (reviewId !== exchangeId) throw new Error(`${entry.file.relativePath} reviewId must match exchangeId.`);
  assertFilename(entry.file, `${exchangeId}.json`, "Review");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  plainArray(entry.value.artifacts, `${entry.file.relativePath}.artifacts`).forEach((artifact, index) => validateReviewArtifact(artifact, `${entry.file.relativePath}.artifacts[${index}]`));
  if (entry.value.artifacts.length === 0) throw new Error(`${entry.file.relativePath}.artifacts must not be empty.`);
  enumeration(entry.value.status, ["completed", "blocked", "failed"], `${entry.file.relativePath}.status`);
  enumeration(entry.value.verdict, ["coherent", "needs-revision", "needs-evidence", "blocked"], `${entry.file.relativePath}.verdict`);
  for (const field of ["summary", "report"]) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
  for (const field of ["rubric", "actionItems", "limitations"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`, field === "rubric" ? 1 : 0);
  plainArray(entry.value.findings, `${entry.file.relativePath}.findings`).forEach((finding, index) => {
    exactFields(finding, /* @__PURE__ */ new Set(["findingId", "severity", "summary", "linkedArtifactPaths"]), `${entry.file.relativePath}.findings[${index}]`);
    researchId(finding.findingId, `${entry.file.relativePath}.findings[${index}].findingId`);
    enumeration(finding.severity, ["low", "medium", "high"], `${entry.file.relativePath}.findings[${index}].severity`);
    nonEmptyText(finding.summary, `${entry.file.relativePath}.findings[${index}].summary`);
    stringArray(finding.linkedArtifactPaths, `${entry.file.relativePath}.findings[${index}].linkedArtifactPaths`, 1);
  });
  plainObject2(entry.value.provenance, `${entry.file.relativePath}.provenance`);
  exactTimestamp(entry.value.reviewedAt, `${entry.file.relativePath}.reviewedAt`);
  return exchangeId;
}
function validateDirectionEntry(entry) {
  exactFields(entry.value, DIRECTION_FIELDS, entry.file.relativePath);
  const decisionId = researchId(entry.value.decisionId, `${entry.file.relativePath}.decisionId`);
  assertFilename(entry.file, `${decisionId}.json`, "Direction Decision");
  for (const field of ["priorDirection", "nextDirection"]) {
    exactFields(entry.value[field], DIRECTION_VALUE_FIELDS, `${entry.file.relativePath}.${field}`);
    for (const directionField of DIRECTION_VALUE_FIELDS) nonEmptyText(entry.value[field][directionField], `${entry.file.relativePath}.${field}.${directionField}`);
  }
  nonEmptyText(entry.value.reason, `${entry.file.relativePath}.reason`);
  stringArray(entry.value.evidenceRefs, `${entry.file.relativePath}.evidenceRefs`, 1);
  stringArray(entry.value.missionRefs, `${entry.file.relativePath}.missionRefs`, 1).forEach((missionId, index) => researchId(missionId, `${entry.file.relativePath}.missionRefs[${index}]`));
  exactTimestamp(entry.value.decidedAt, `${entry.file.relativePath}.decidedAt`);
  return decisionId;
}
function uniqueIds(entries, validator, label) {
  const ids = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    const id = validator(entry);
    if (ids.has(id)) throw new Error(`legacy JSON research export found duplicate ${label} identifier: ${id}.`);
    ids.add(id);
  }
  return ids;
}
function validateV2Records(workspace, raw) {
  validateWorkspace(workspace);
  const missionKinds = raw.missions.map((entry) => ({ entry, ...validateMissionEntry(entry) }));
  const missionEntries = missionKinds.filter(({ kind }) => kind === "mission").map(({ entry }) => entry);
  const conclusionEntries = missionKinds.filter(({ kind }) => kind === "conclusion").map(({ entry }) => entry);
  const missionIds = uniqueIds(missionEntries, (entry) => entry.value.missionId, "Mission");
  const conclusionIds = uniqueIds(conclusionEntries, (entry) => entry.value.missionId, "Mission conclusion");
  for (const missionId of conclusionIds) if (!missionIds.has(missionId)) throw new Error(`Mission conclusion ${missionId} has no matching Mission.`);
  for (const entry of missionEntries) {
    const references = [...entry.value.dependsOnMissionIds, ...entry.value.parentMissionId === null ? [] : [entry.value.parentMissionId]];
    for (const reference of references) if (!missionIds.has(reference)) throw new Error(`${entry.file.relativePath} references unknown Mission ${reference}.`);
  }
  const experimentKinds = raw.experiments.map((entry) => ({ entry, ...validateExperimentEntry(entry) }));
  const planEntries = experimentKinds.filter(({ kind }) => kind === "plan").map(({ entry }) => entry);
  const resultEntries = experimentKinds.filter(({ kind }) => kind === "result").map(({ entry }) => entry);
  const planIds = uniqueIds(planEntries, (entry) => entry.value.experimentId, "Experiment plan");
  const resultIds = uniqueIds(resultEntries, (entry) => entry.value.experimentId, "Experiment result");
  const planById = new Map(planEntries.map((entry) => [entry.value.experimentId, entry.value]));
  for (const entry of resultEntries) {
    const plan = planById.get(entry.value.experimentId);
    if (!plan) throw new Error(`Experiment result ${entry.value.experimentId} has no matching prospective plan.`);
    if (plan.missionId !== entry.value.missionId) throw new Error(`Experiment result ${entry.value.experimentId} does not match its plan Mission.`);
    for (const impact of entry.value.hypothesisImpacts) if (!plan.hypothesisRefs.includes(impact.hypothesisRef)) throw new Error(`${entry.file.relativePath} references a hypothesis absent from its plan: ${impact.hypothesisRef}.`);
  }
  for (const experimentId of resultIds) if (!planIds.has(experimentId)) throw new Error(`Experiment result ${experimentId} has no matching prospective plan.`);
  const sourceIds = uniqueIds(raw.sources, validateSourceEntry, "Source");
  const claimIds = uniqueIds(raw.claims, validateClaimEntry, "Claim");
  for (const entry of [...missionEntries, ...conclusionEntries, ...raw.sources, ...raw.claims, ...planEntries, ...resultEntries, ...raw.reviewExchanges, ...raw.reviews]) {
    if (Object.hasOwn(entry.value, "missionId") && !missionIds.has(entry.value.missionId)) throw new Error(`${entry.file.relativePath} references unknown Mission ${entry.value.missionId}.`);
  }
  for (const entry of conclusionEntries) {
    for (const sourceId of entry.value.sourceIds) if (!sourceIds.has(sourceId)) throw new Error(`${entry.file.relativePath} references unknown Source ${sourceId}.`);
    for (const experimentId of entry.value.experimentIds) if (!resultIds.has(experimentId)) throw new Error(`${entry.file.relativePath} references Experiment ${experimentId} without a result.`);
    for (const claimId of entry.value.claimIds) if (!claimIds.has(claimId)) throw new Error(`${entry.file.relativePath} references unknown Claim ${claimId}.`);
  }
  for (const entry of raw.claims) if (entry.value.supersedesClaimId !== null && !claimIds.has(entry.value.supersedesClaimId)) throw new Error(`${entry.file.relativePath} supersedes unknown Claim ${entry.value.supersedesClaimId}.`);
  for (const entry of resultEntries) for (const impact of entry.value.claimImpacts) if (!claimIds.has(impact.claimId)) throw new Error(`${entry.file.relativePath} references unknown Claim ${impact.claimId}.`);
  uniqueIds(raw.directionDecisions, validateDirectionEntry, "Direction Decision");
  for (const entry of raw.directionDecisions) for (const missionId of entry.value.missionRefs) if (!missionIds.has(missionId)) throw new Error(`${entry.file.relativePath} references unknown Mission ${missionId}.`);
  const exchangeIds = uniqueIds(raw.reviewExchanges, validateReviewExchangeEntry, "ReviewExchange");
  const reviewIds = uniqueIds(raw.reviews, validateReviewEntry, "Review");
  const exchangeById = new Map(raw.reviewExchanges.map((entry) => [entry.value.exchangeId, entry.value]));
  for (const entry of raw.reviews) {
    const exchange = exchangeById.get(entry.value.exchangeId);
    if (!exchange) throw new Error(`Review ${entry.value.exchangeId} has no matching ReviewExchange.`);
    if (entry.value.missionId !== exchange.missionId || JSON.stringify(entry.value.artifacts) !== JSON.stringify(exchange.artifacts)) throw new Error(`${entry.file.relativePath} does not match its ReviewExchange scope.`);
  }
  for (const exchangeId of reviewIds) if (!exchangeIds.has(exchangeId)) throw new Error(`Review ${exchangeId} has no matching ReviewExchange.`);
}
function directoryDeleteEntries(anchor) {
  return [...RECORD_DIRECTORY_PATHS].reverse().map((relativePath) => ({
    relativePath,
    state: fileState(anchor, relativePath)
  }));
}
function valueText(value) {
  if (value === null || value === void 0 || value === "") return null;
  if (typeof value === "string") return value;
  if (["number", "boolean"].includes(typeof value)) return String(value);
  return `\`${JSON.stringify(value)}\``;
}
function section(title, value) {
  const text = valueText(value);
  return text === null ? "" : `
## ${title}

${text}
`;
}
function bulletSection(title, value) {
  if (!Array.isArray(value) || value.length === 0) return "";
  return `
## ${title}

${value.map((item) => `- ${valueText(item)}`).join("\n")}
`;
}
function readableName(value, fallback) {
  const raw = [value?.title, value?.goal, value?.statement, value?.summary, value?.missionId, value?.experimentId, value?.sourceId, value?.exchangeId, value?.reviewId, value?.decisionId, fallback].find((item) => typeof item === "string" && item.trim());
  const normalized = raw.normalize("NFKC").trim().replace(SAFE_FILE_PART, "-").replace(/^-+|-+$/gu, "").slice(0, 80);
  return normalized || fallback;
}
function uniquePath(directory, base, used) {
  let suffix = 1;
  let relativePath = `${directory}/${base}.md`;
  while (used.has(relativePath)) {
    suffix += 1;
    relativePath = `${directory}/${base}-${suffix}.md`;
  }
  used.add(relativePath);
  return relativePath;
}
function renderObject(title, value, fields) {
  let markdown = `# ${title}
`;
  for (const [field, heading] of fields) {
    markdown += Array.isArray(value?.[field]) ? bulletSection(heading, value[field]) : section(heading, value?.[field]);
  }
  return `${markdown.trimEnd()}
`;
}
function renderMission(value, conclusion) {
  let markdown = renderObject(readableName(value, "Mission"), value, [
    ["goal", "Goal"],
    ["requirements", "Requirements"],
    ["assumptions", "Assumptions"],
    ["scope", "Scope"],
    ["outOfScope", "Out of scope"],
    ["evidenceRequirements", "Evidence needs"],
    ["competingHypotheses", "Competing hypotheses"],
    ["openQuestions", "Open questions"],
    ["contextRefs", "Related material"],
    ["branchReason", "Branch context"],
    ["contributionRole", "Contribution role"]
  ]);
  if (conclusion) markdown += `
${renderObject("Recorded conclusion", conclusion, [["outcome", "Outcome"], ["synthesis", "Synthesis"], ["failures", "Failures"], ["limitations", "Limitations"], ["uncertainty", "Uncertainty"], ["recommendedBranches", "Recommended next work"]])}`;
  return markdown;
}
function renderExperiment(plan, result) {
  let markdown = renderObject(readableName(plan ?? result, "Experiment"), plan ?? {}, [
    ["title", "Why this experiment matters"],
    ["hypothesisRefs", "Hypotheses or competing explanations"],
    ["protocol", "Prospective protocol"],
    ["inputs", "Inputs"],
    ["comparisons", "Comparisons"],
    ["metrics", "Metrics"],
    ["discriminatingObservations", "Discriminating observations"],
    ["successConditions", "Success conditions"],
    ["stopConditions", "Stop conditions"],
    ["constraints", "Constraints"],
    ["expectedArtifacts", "Expected artifacts"],
    ["cost", "Cost"],
    ["risk", "Risk"],
    ["failureValue", "Failure value"]
  ]);
  if (result) markdown += `
${renderObject("Actual execution and result", result, [["kind", "Recorded outcome"], ["summary", "Summary"], ["observations", "Observations"], ["measurements", "Measurements"], ["denominator", "Denominator"], ["hypothesisImpacts", "Hypothesis impacts"], ["claimImpacts", "Claim impacts"], ["unexpectedObservations", "Unexpected observations"], ["artifactRefs", "Artifacts"], ["failures", "Failures"], ["deviations", "Deviations"], ["limitations", "Limitations"], ["uncertainty", "Uncertainty"]])}`;
  return markdown;
}
function renderSource(value) {
  return renderObject(readableName(value, "Source"), value, [["citationKey", "Citation key"], ["title", "Title"], ["authors", "Authors"], ["year", "Year"], ["locator", "Locator"], ["sourceType", "Source type"], ["summary", "What was learned"], ["conditions", "Conditions"], ["relationship", "Relationship to the work"], ["conflicts", "Conflicts"], ["limitations", "Limitations"], ["capture", "Preserved capture"]]);
}
function renderClaim(value) {
  return renderObject(readableName(value, "Claim"), value, [["statement", "Claim"], ["supportRefs", "Recorded support"], ["counterEvidenceRefs", "Recorded counter-evidence"], ["missingEvidence", "Missing evidence"], ["cannotSay", "Cannot say"], ["uncertainty", "Uncertainty"], ["assessment", "Former assessment"], ["storyRole", "Role in the argument"], ["artifactRefs", "Related artifacts"], ["revisionReason", "Revision context"]]);
}
function renderDirection(value) {
  return renderObject(readableName(value, "Direction-change"), value, [["priorDirection", "Previous direction"], ["nextDirection", "Next direction"], ["reason", "Why it changed"], ["evidenceRefs", "Recorded evidence"], ["missionRefs", "Related work"]]);
}
function renderReview(exchange, review) {
  const source = exchange ?? review ?? {};
  let markdown = renderObject(readableName(source, "Review"), source, [["artifacts", "Declared artifact scope"], ["preparedAt", "Prepared at"]]);
  if (review) markdown += `
${renderObject("Returned review", review, [["status", "Recorded status"], ["verdict", "Former verdict"], ["summary", "Summary"], ["rubric", "Rubric"], ["findings", "Findings"], ["actionItems", "Action items"], ["report", "Original report"], ["provenance", "Reported provenance"], ["limitations", "Limitations"]])}`;
  else markdown += "\n## Review return\n\nNo returned review was present in the legacy JSON research state.\n";
  return markdown;
}
function overview(workspace, links, directions) {
  const lines = ["# Research overview", "", "## Current research", "", workspace.researchQuestion ?? "Not recorded.", "", "## Mainline", "", workspace.mainline ?? "Not recorded."];
  if (workspace.contributionIntent) lines.push("", "## Contribution target", "", workspace.contributionIntent);
  if (workspace.currentFocus) lines.push("", "## Current focus", "", workspace.currentFocus);
  if (links.length > 0) lines.push("", "## Exported documents", "", ...links.map((entry) => `- [${entry.label}](${entry.link})`));
  if (directions.length > 0) lines.push("", "## Recorded direction changes", "", ...directions.map((entry) => `- [${entry.label}](${entry.link})`));
  lines.push("", "## Export note", "", "This overview was mechanically exported from legacy Dove JSON research records. Review the documents, repair natural links and names, and do not treat the export as scientific validation.", "");
  return lines.join("\n");
}
function relativeLink(from, to) {
  return path6.posix.relative(path6.posix.dirname(from), to);
}
function previewResearchExport(start, options = {}) {
  const fsOps = options.fsOps ?? fs6;
  const root = canonicalRoot3(start, fsOps);
  const anchor = openRootedFilesystem(root, { ...options, fsOps });
  const required = new Map(REQUIRED_FILES.map((relativePath) => [relativePath, readRequired(anchor, relativePath)]));
  const marker = strictJson(required.get(".dove/format.json"));
  if (!marker || marker.format !== V2_FORMAT2 || Object.keys(marker).length !== 1) throw new Error(`Research export accepts only an exact ${V2_FORMAT2} marker.`);
  const workspace = strictJson(required.get(".dove/workspace.json"));
  const lessonsBytes = required.get(".dove/LESSONS.md").bytes;
  let lessonsText;
  try {
    lessonsText = new TextDecoder("utf-8", { fatal: true }).decode(lessonsBytes);
  } catch (error) {
    throw new Error(".dove/LESSONS.md must contain valid UTF-8 Markdown.", { cause: error });
  }
  if (lessonsText.includes("\0")) throw new Error(".dove/LESSONS.md contains null bytes.");
  const raw = Object.fromEntries(RECORD_DIRECTORIES.map(([directory, key]) => [key, listJson(anchor, `.dove/${directory}`).map((file) => ({ file, value: strictJson(file) }))]));
  validateV2Records(workspace, raw);
  const archiveStamp = timestamp(options.now);
  const archiveDirectory = `${ARCHIVE_ROOT}/research-format-v2-${archiveStamp}`;
  if (fileState(anchor, archiveDirectory).exists) throw new Error(`Research export archive already exists: ${archiveDirectory}.`);
  const researchRootState = fileState(anchor, NEW_ROOT);
  if (researchRootState.exists && researchRootState.type !== "directory") throw new Error(`${NEW_ROOT} must be a real directory when legacy research is exported additively.`);
  const defaults = prepareResearchDefaults(root, {
    ...options,
    fsOps,
    label: "Dove research export defaults",
    additionalLessonTexts: [lessonsText]
  });
  const used = new Set(RESEARCH_DEFAULT_FILE_PATHS);
  if (researchRootState.exists) {
    const targetDirectories = new Set(RECORD_DIRECTORIES.map(([directory]) => directory === "review-exchanges" ? "reviews" : directory === "direction-decisions" ? "missions" : directory));
    for (const targetDirectory of targetDirectories) {
      const relativeDirectory = `${NEW_ROOT}/${targetDirectory}`;
      const directoryState = fileState(anchor, relativeDirectory);
      if (!directoryState.exists) continue;
      if (directoryState.type !== "directory") throw new Error(`${relativeDirectory} must be a real directory when legacy research is exported additively.`);
      for (const entry of anchor.readdir(relativeDirectory, { withFileTypes: true })) {
        const relativePath = `${relativeDirectory}/${entry.name}`;
        if (entry.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
        if (entry.isFile() || entry.isDirectory()) used.add(relativePath);
        else throw new Error(`${relativePath} has an unsupported file type.`);
      }
    }
  }
  const documents = [];
  const links = [];
  const directions = [];
  const add = (directory, value, fallback, content, collection = links) => {
    const target = uniquePath(`${NEW_ROOT}/${directory}`, readableName(value, fallback), used);
    documents.push({ relativePath: target, content });
    collection.push({
      label: readableName(value, fallback),
      target,
      link: relativeLink(`${NEW_ROOT}/RESEARCH.md`, target)
    });
    return target;
  };
  const conclusionByMission = new Map(raw.missions.filter((entry) => entry.file.relativePath.endsWith(".conclusion.json")).map((entry) => [entry.value?.missionId, entry.value]));
  for (const entry of raw.missions.filter((item) => !item.file.relativePath.endsWith(".conclusion.json"))) add("missions", entry.value, "Mission", renderMission(entry.value, conclusionByMission.get(entry.value?.missionId)));
  const resultByExperiment = new Map(raw.experiments.filter((entry) => entry.file.relativePath.endsWith(".result.json")).map((entry) => [entry.value?.experimentId, entry.value]));
  for (const entry of raw.experiments.filter((item) => item.file.relativePath.endsWith(".plan.json"))) add("experiments", entry.value, "Experiment", renderExperiment(entry.value, resultByExperiment.get(entry.value?.experimentId)));
  for (const entry of raw.sources) add("sources", entry.value, "Source", renderSource(entry.value));
  for (const entry of raw.claims) add("claims", entry.value, "Claim", renderClaim(entry.value));
  for (const entry of raw.directionDecisions) add("missions", entry.value, "Direction-change", renderDirection(entry.value), directions);
  const reviewByExchange = new Map(raw.reviews.map((entry) => [entry.value?.exchangeId ?? entry.value?.reviewId, entry.value]));
  const exchangeIds = /* @__PURE__ */ new Set();
  for (const entry of raw.reviewExchanges) {
    exchangeIds.add(entry.value?.exchangeId);
    add("reviews", entry.value, "Review", renderReview(entry.value, reviewByExchange.get(entry.value?.exchangeId)));
  }
  for (const entry of raw.reviews.filter((item) => !exchangeIds.has(item.value?.exchangeId ?? item.value?.reviewId))) add("reviews", entry.value, "Review", renderReview(null, entry.value));
  const desiredWrites = new Map(defaults.plan.writes);
  const desiredDeletes = new Set(defaults.plan.deletes);
  const stateFor2 = (relativePath) => defaults.snapshot.states.get(relativePath) ?? {
    exists: false,
    type: "absent",
    bytes: null,
    text: null,
    sha256: null,
    mode: null
  };
  const currentText2 = (relativePath) => desiredWrites.has(relativePath) ? new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(desiredWrites.get(relativePath)) : stateFor2(relativePath).text;
  const setDesired = (relativePath, content) => {
    const bytes = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), "utf8");
    const state2 = stateFor2(relativePath);
    if (state2.exists && state2.bytes.equals(bytes)) desiredWrites.delete(relativePath);
    else desiredWrites.set(relativePath, bytes);
  };
  const overviewPath = RESEARCH_DEFAULT_PATHS.overview;
  const exportedOverview = overview(workspace, links, directions);
  setDesired(
    overviewPath,
    appendExactMarkdownBlocks(currentText2(overviewPath) ?? "", [exportedOverview])
  );
  const summaryLinks = /* @__PURE__ */ new Map([
    ["missions", []],
    ["experiments", []],
    ["sources", []],
    ["reviews", []],
    ["claims", []]
  ]);
  for (const link of [...links, ...directions]) {
    const directory = path6.posix.basename(path6.posix.dirname(link.target));
    summaryLinks.get(directory)?.push(`- [${link.label}](${relativeLink(RESEARCH_DEFAULT_PATHS[`${directory}Summary`], link.target)})`);
  }
  for (const [directory, lines] of summaryLinks) {
    if (lines.length === 0) continue;
    const summaryPath = RESEARCH_DEFAULT_PATHS[`${directory}Summary`];
    setDesired(
      summaryPath,
      appendExactMarkdownLines(currentText2(summaryPath) ?? "", "## Imported legacy documents", lines)
    );
  }
  const importedLessonsPath = RESEARCH_DEFAULT_PATHS.importedLessons;
  const importedState = stateFor2(importedLessonsPath);
  if (!importedState.exists) setDesired(importedLessonsPath, lessonsBytes);
  else setDesired(importedLessonsPath, appendExactMarkdownBytes(importedState.bytes, lessonsBytes));
  const lessonsSummaryPath = RESEARCH_DEFAULT_PATHS.lessonsSummary;
  setDesired(
    lessonsSummaryPath,
    appendExactMarkdownLines(currentText2(lessonsSummaryPath) ?? "", "## Imported guidance", [IMPORTED_LESSONS_LINK])
  );
  documents.unshift(...[...desiredWrites.entries()].map(([relativePath, content]) => ({
    relativePath,
    content,
    expectedState: stateFor2(relativePath)
  })));
  const oldFiles = [...required.values(), ...Object.values(raw).flat().map((entry) => entry.file)];
  const oldDirectories = directoryDeleteEntries(anchor);
  const archiveFiles = oldFiles.map((file) => ({ relativePath: `${archiveDirectory}/${file.relativePath.slice(`${OLD_ROOT}/`.length)}`, content: file.bytes }));
  return {
    status: "ready",
    action: "export-research",
    target: root,
    from: V2_FORMAT2,
    to: "markdown",
    researchDirectory: NEW_ROOT,
    archiveDirectory,
    writtenPaths: [...documents.map((entry) => entry.relativePath), ...archiveFiles.map((entry) => entry.relativePath)],
    archivedPaths: archiveFiles.map((entry) => entry.relativePath),
    plan: {
      documents,
      researchDeletes: [...desiredDeletes].map((relativePath) => ({
        relativePath,
        state: stateFor2(relativePath)
      })),
      archiveFiles,
      sourceFiles: oldFiles.map((file) => ({ relativePath: file.relativePath, state: file.state })),
      sourceDirectories: oldDirectories
    }
  };
}
function exportResearch(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Research export requires confirmed: true after preview.");
  const preview = previewResearchExport(start, options);
  const entries = [
    ...preview.plan.documents.map((entry) => ({
      root: preview.target,
      relativePath: entry.relativePath,
      content: entry.content,
      force: entry.expectedState?.exists === true,
      expectedState: expectedTransactionState(entry.expectedState ?? { exists: false }),
      label: "Research Markdown export"
    })),
    ...preview.plan.researchDeletes.map((entry) => ({
      root: preview.target,
      relativePath: entry.relativePath,
      delete: true,
      force: true,
      expectedState: expectedTransactionState(entry.state),
      label: "Retired top-level research Lessons"
    })),
    ...preview.plan.archiveFiles.map((entry) => ({ root: preview.target, relativePath: entry.relativePath, content: entry.content, force: false, expectedState: { exists: false, type: "absent", sha256: null, mode: null }, label: "Legacy JSON research archive" })),
    ...preview.plan.sourceFiles.map((entry) => ({ root: preview.target, relativePath: entry.relativePath, delete: true, expectedState: entry.state, label: "Retired Dove legacy JSON research state" })),
    ...preview.plan.sourceDirectories.map((entry) => ({
      root: preview.target,
      relativePath: entry.relativePath,
      delete: true,
      deleteEmptyDirectory: entry.state.exists,
      expectedState: entry.state,
      label: "Retired legacy JSON research directory"
    }))
  ];
  const result = writeFileSetTransaction(entries, {
    ...options,
    transactionBase: ".dove/install/transactions"
  });
  return { status: "exported", action: preview.action, target: preview.target, from: preview.from, to: preview.to, researchDirectory: preview.researchDirectory, archiveDirectory: preview.archiveDirectory, ...result };
}

// src/core/paper-search-integration.mjs
var PAPER_SEARCH_MCP_SERVER_NAME = "dove-paper-search";
var PAPER_SEARCH_MCP_PATH = ".mcp.json";
var PAPER_SEARCH_MCP_SELECTOR = `/mcpServers/${PAPER_SEARCH_MCP_SERVER_NAME}`;
var PAPER_SEARCH_PACKAGE = "paper-search-mcp";
var PAPER_SEARCH_PACKAGE_VERSION = "0.1.4";
var PAPER_SEARCH_PACKAGE_SPECIFIER = `${PAPER_SEARCH_PACKAGE}==${PAPER_SEARCH_PACKAGE_VERSION}`;
var PAPER_SEARCH_SUPPORT_SKILL_PATH = ".claude/skills/dove-paper-search/SKILL.md";
var PAPER_SEARCH_MCP_FRAGMENT = Object.freeze({
  type: "stdio",
  command: "uvx",
  args: Object.freeze(["--from", PAPER_SEARCH_PACKAGE_SPECIFIER, PAPER_SEARCH_PACKAGE])
});
function renderPaperSearchSupportSkill() {
  return `---
name: dove-paper-search
description: Search, retrieve, and read academic papers through the approved dove-paper-search project MCP when scholarly material is relevant.
user-invocable: false
---

# Dove Paper Search

Use the \`dove-paper-search\` project MCP only when academic paper discovery, retrieval, or full-text reading materially helps the current request.

- Keep searches bounded and choose relevant scholarly sources instead of searching every provider by default.
- Download or read full text only when the task needs it. Report clearly whether material was merely found, downloaded, or actually read, together with saved paths, material failures, and coverage limits.
- Prefer source-native open download and read tools. If \`download_with_fallback\` is needed, always pass \`use_scihub: false\` explicitly. Do not call Sci-Hub tools.
- Use only MCP tools already available and approved by the user. If approval is missing, \`uvx\` is unavailable, or the server fails, report that directly; do not install dependencies or use a CLI or shell fallback.
- Do not turn paper identifiers into Dove IDs, hashes, trust scores, ledgers, or database records. Tool output is not scientific proof.
`;
}

// src/core/role-definitions.mjs
var ROLE_DEFINITIONS = Object.freeze({
  planner: Object.freeze({
    id: "planner",
    publicName: "Planner",
    title: "dove-planner",
    description: "Clarify the goal and evidence needed when planning is useful.",
    responsibility: "Frame only what the Builder/Author needs to proceed.",
    inputs: Object.freeze([
      "The user's goal, constraints, context, and desired result"
    ]),
    internalCompletionConditions: Object.freeze([
      "The goal, material uncertainty, evidence needs, and stopping point are clear enough for the work"
    ])
  }),
  builder: Object.freeze({
    id: "builder",
    publicName: "Builder/Author",
    title: "dove-builder",
    description: "Do the substantive research, coding, writing, experiment, figure, revision, or rebuttal work.",
    responsibility: "Complete the user's request from real project material and appropriate evidence.",
    inputs: Object.freeze([
      "The user's request and the project material relevant to it"
    ]),
    internalCompletionConditions: Object.freeze([
      "The requested result is produced and checked proportionally, with material failures and uncertainty preserved"
    ])
  }),
  reviewer: Object.freeze({
    id: "reviewer",
    publicName: "Reviewer",
    title: "dove-reviewer",
    description: "Assess a declared artifact scope and return a readable review without edits; this role does not establish reviewer independence.",
    responsibility: "Review the user-declared scope separately from Planner and Builder/Author. The user manages the exchange; this role is responsibility separation, not proof of reviewer identity, independence, or authority.",
    inputs: Object.freeze([
      "Only the exact project-relative artifact paths declared by the user-managed review prompt",
      "The review purpose, scope limits, and rubric stated in that prompt"
    ]),
    outputs: Object.freeze([
      "One readable Markdown review within the declared scope",
      "Concrete findings tied to declared artifact paths, with rationale, materiality, and actionable follow-up where appropriate",
      "Explicit unknowns, limitations, and provenance information that the reviewer can honestly provide",
      "Make no edits, rebuttal, implementation, Dove mutation, or nested reviewer launch, and do not use parent conversation context or undeclared project material"
    ])
  })
});
var DOVE_PRIMARY_ROLES = ROLE_DEFINITIONS;
function frontmatter(role) {
  return `---
name: ${role.title}
description: ${role.description}
---`;
}
function bullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}
function roleCompletionSection(role) {
  if (role.internalCompletionConditions) {
    return `## Internal Responsibilities and Completion Conditions

${bullets(role.internalCompletionConditions)}`;
  }
  return `## Outputs

${bullets(role.outputs)}`;
}
function renderOpenCodeRoleSkill(roleId) {
  const role = ROLE_DEFINITIONS[roleId];
  if (!role) throw new Error(`Unknown Dove primary role: ${roleId}.`);
  return `${frontmatter(role)}

# ${role.title}

## Responsibility

${role.responsibility}

## Inputs

${bullets(role.inputs)}

${roleCompletionSection(role)}
`;
}
var REVIEWER_BOUNDARY = "Review only the declared scope and say when that scope is insufficient. Do not edit files, use parent conversation context, invoke Dove, perform rebuttal or implementation, or launch another reviewer.";
function renderClaudeReviewerAgent() {
  const role = ROLE_DEFINITIONS.reviewer;
  return `---
name: dove-reviewer
description: ${role.description}
tools: Read
---

# Dove Reviewer

${role.responsibility}

${REVIEWER_BOUNDARY}

Return one readable Markdown review limited to the declared scope.
`;
}
function renderOpenCodeReviewerAgent() {
  const role = ROLE_DEFINITIONS.reviewer;
  return `---
description: ${role.description}
mode: subagent
permission:
  read: allow
  write: deny
  edit: deny
  bash: deny
  glob: deny
  grep: deny
  task: deny
  skill: deny
---
# Dove Reviewer

${role.responsibility}

${REVIEWER_BOUNDARY}

Return one readable Markdown review limited to the declared scope.
`;
}
function generatedRoleDefinitionEntries() {
  return [
    ...["planner", "builder", "reviewer"].map((roleId) => ({
      relativePath: `.opencode/skills/dove-${roleId}/SKILL.md`,
      content: renderOpenCodeRoleSkill(roleId)
    })),
    { relativePath: ".claude/agents/dove-reviewer.md", content: renderClaudeReviewerAgent() },
    { relativePath: ".opencode/agents/dove-reviewer.md", content: renderOpenCodeReviewerAgent() }
  ];
}

// src/core/command-manifest.mjs
var PACKAGE_DOCUMENTATION_PATHS = ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
var PACKAGE_RUNTIME_PATHS = ["dist/index.mjs", "bin/dove-package.mjs", "scripts/dove-user-prompt-submit-package.mjs"];
var RETIRED_PACKAGE_RUNTIME_PATHS = [
  "mcp/dove-state-server-package.mjs",
  "scripts/doctor-mcp-probe-package.mjs"
];
var PROJECT_HOST_IDS = ["opencode", "codex", "cursor", "agents", "claude"];
var HOST_IDS = [...PROJECT_HOST_IDS];
var DOVE_CLAUDE_AMBIENT_PROJECT_PATHS = Object.freeze([
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  ".claude/skills/dove-paper-search/SKILL.md",
  ".claude/settings.json"
]);
var PACKAGE_GENERATED_SUPPORT_PATHS = Object.freeze([
  ".claude/agents/dove-reviewer.md",
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  ".claude/skills/dove-paper-search/SKILL.md",
  ".opencode/agents/dove-reviewer.md"
]);
var HOST_DEFINITIONS = {
  opencode: { label: "OpenCode", scope: "project", jsonChecks: [] },
  codex: { label: "Codex", scope: "project", jsonChecks: [] },
  cursor: { label: "Cursor", scope: "project", jsonChecks: [] },
  agents: { label: "Shared agent skills", scope: "project", jsonChecks: [] },
  claude: { label: "Claude Code", scope: "project", jsonChecks: [] }
};
var OPENCODE_ROLE_SKILL_PATHS = [".opencode/skills/dove-planner/SKILL.md", ".opencode/skills/dove-builder/SKILL.md", ".opencode/skills/dove-reviewer/SKILL.md"];
var HOST_ADAPTER_POLICY = Object.freeze({
  toolAccess: Object.freeze({ transport: "host-files", unavailable: "report", cliFallback: false, shellFallback: false }),
  privacy: Object.freeze({ exposePrivateProtocol: false }),
  adapterBullets: Object.freeze([
    "Use host file and research tools directly. Research Markdown is ordinary researcher-owned context, not a database.",
    "Keep material failures, limitations, and uncertainty visible; model output, tests, and review are bounded evidence rather than scientific authority."
  ])
});
var host = (instruction, options = {}) => ({
  type: "host",
  capability: options.capability ?? "ordinary-project-work",
  readOnly: options.readOnly === true,
  persistWhen: options.persistWhen ?? "never",
  instruction
});
var commonClarification = ["Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation."];
var readResearchDocuments = (instruction) => host(instruction, { capability: "research-document-reading", readOnly: true });
var updateResearchDocuments = (instruction) => host(instruction, { capability: "research-document-maintenance", persistWhen: "the work creates durable research value" });
var relevantLessons = host(
  "When reusable guidance may help the current task, read `.dove/research/lessons/LESSONS.md`, then only the naturally linked theme documents directly relevant to the work. Do not read unrelated themes or give any one Lesson special treatment. Treat Lessons as fallible advice, never as evidence or authority.",
  { capability: "lesson-reading", readOnly: true }
);
var AREA = Object.freeze({
  missions: Object.freeze({ directory: "missions", summary: "MISSIONS.md" }),
  experiments: Object.freeze({ directory: "experiments", summary: "EXPERIMENTS.md" }),
  sources: Object.freeze({ directory: "sources", summary: "SOURCES.md" }),
  reviews: Object.freeze({ directory: "reviews", summary: "REVIEWS.md" }),
  claims: Object.freeze({ directory: "claims", summary: "CLAIMS.md" }),
  lessons: Object.freeze({ directory: "lessons", summary: "LESSONS.md" })
});
function areaPath(area) {
  const value = AREA[area];
  return `.dove/research/${value.directory}/${value.summary}`;
}
function readArea(area, purpose) {
  return readResearchDocuments(
    `When existing Dove research context would materially help ${purpose}, read \`.dove/research/RESEARCH.md\`, then \`${areaPath(area)}\`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Do not recursively scan the research tree. If a needed entry or link is absent, say so naturally rather than inferring a database state.`
  );
}
function maintainArea(area, instruction) {
  return updateResearchDocuments(
    `${instruction} Keep the readable links and synthesis in \`${areaPath(area)}\` current when a detail document is created or materially changed. Update \`.dove/research/RESEARCH.md\` only for a material mainline, important conclusion, navigation, or priority change.`
  );
}
function workflow(slug) {
  if (slug === "research") return {
    status: "single-bounded-pass",
    modes: [{ id: "default", when: "The user requests one bounded pass of research framing, investigation, synthesis, or project work.", steps: [
      readArea("missions", "the bounded research goal"),
      relevantLessons,
      host("Inspect the relevant ordinary project materials and real external resources needed to understand the question. Form a proportional research frame from actual evidence rather than Dove bookkeeping. When the problem or route remains open, explore materially different explanations and approaches, then compare the serious candidates rather than committing to the first plausible or easiest option.", { capability: "project-exploration", readOnly: true }),
      host("Complete exactly one bounded research or project pass. Produce the requested analysis or artifact, preserve material failures and uncertainty, and stop after the bounded deliverable rather than turning Research into multi-round autonomy.", { capability: "research-work" }),
      maintainArea("missions", "When the work creates durable research value, update the existing Mission document or create one naturally named Mission document for the bounded goal, work, failures, evidence-bounded conclusion, limitations, and useful next branches. When an important claim needs its own document, place it under `claims/` and update `claims/CLAIMS.md` without creating a Claim store.")
    ], clarification: commonClarification }]
  };
  if (slug === "auto") return {
    status: "explicit-multi-round-autonomy",
    modes: [{ id: "default", when: "The user explicitly invokes high-autonomy multi-round research.", steps: [
      readResearchDocuments("Require an existing `.dove/research/RESEARCH.md`, read its current mainline, then read the summary for the current work type and only directly relevant linked details. Do not recursively scan all research files. If the overview is absent, materially incomplete, or evidence says the mainline must change, report that boundary and stop before autonomous work."),
      host("When that boundary blocks Auto, create a concise ordinary project recommendation only if the user requested a saved artifact; otherwise return the recommendation directly without changing the research mainline.", { capability: "mainline-boundary-recommendation" }),
      relevantLessons,
      host("Deeply explore relevant code, data, results, drafts, figures, constraints, and external sources. Build an evidence-aware frame covering competing explanations, counterfactuals, baselines, discriminating actions, and current claim boundaries.", { capability: "project-exploration", readOnly: true }),
      host("Let Planner and Builder/Author coordinate autonomously, using subagents when useful. Repeatedly choose and perform the feasible action with the highest expected research value, including retrieval, analysis, code, writing, figures, validation, and experiments. When theory and evidence conflict, reconsider the theory, the experiment, and the route itself; choose the next action that best clarifies the disagreement instead of assuming more experiments are needed.", { capability: "autonomous-research-work" }),
      host("For a selected experiment, write or extend one naturally named document under `experiments/` with the prospective plan before execution. Then execute with host tools, append the actual procedure, result, material failures or deviations, and interpretation to that same document, and update `experiments/EXPERIMENTS.md`.", { capability: "experiment-work" }),
      host("When user-managed separate review is a true dependency, prepare one readable document under `reviews/`, update `reviews/REVIEWS.md`, and return the declared artifacts and prompt to the user for a separate reviewer they manage. Do not launch, impersonate, or fabricate the reviewer; stop if the unavailable return blocks progress.", { capability: "review-handoff" }),
      updateResearchDocuments("When a round produces durable new evidence, a useful conclusion, a material failure, a decision, or a direction change, update the relevant naturally named topic document and its directory summary. Do not interrupt ordinary exploration merely to log a round. Keep `RESEARCH.md` concise and update it only for material mainline, conclusion, document-link, or priority changes. Preserve adverse evidence instead of overwriting history with a success narrative."),
      host("Continue without a default round count until the goal is achieved, the user budget ends, no feasible action has positive expected research value, a safety or mainline boundary is reached, or a required Review return is unavailable. Report the evidence-bounded result without claiming scientific authority.", { capability: "research-synthesis", readOnly: true })
    ], clarification: commonClarification }]
  };
  if (slug === "status") return {
    status: "read-only",
    modes: [{ id: "default", when: "The user requests current Dove research status.", steps: [
      readResearchDocuments("Read `.dove/research/RESEARCH.md` once when it exists, then read the one or more directory summaries needed for the question, then only directly linked details needed to resolve material ambiguity. Do not recursively scan the research tree. Report the current mainline, real progress, failures, limitations, uncertainty, and next priorities. If an overview, summary, or link is absent, say so naturally; do not infer a database state or modify files."),
      relevantLessons
    ], clarification: [] }]
  };
  if (slug === "source") return {
    status: "bounded-source-work",
    modes: [{ id: "default", when: "The user requests source discovery, reading, comparison, or verification.", steps: [
      readArea("sources", "the source question"),
      relevantLessons,
      host("Discover, retrieve, save when useful, read, and verify real material with host-native project or external research tools. Distinguish material merely found from material actually retrieved, inspected, and used; preserve saved paths, failures, conflicts, conditions, and limitations.", { capability: "source-research" }),
      maintainArea("sources", "When a used source deserves durable context, create or update one naturally named source note under `sources/` with the citation or URL, what was actually inspected and learned, conditions, conflicts, limitations, and useful related links. A source explanation is useful when available but is not mandatory. Do not generate a Source ID, fingerprint, or byte hash.")
    ], clarification: commonClarification }]
  };
  if (slug === "experiment") return {
    status: "planned-experiment-work",
    modes: [{ id: "default", when: "The user requests experiment design, execution, analysis, or recording.", steps: [
      readArea("experiments", "the experiment"),
      relevantLessons,
      host("Follow the user's actual experiment request. For a new experiment that will be executed, first choose or create one naturally named Experiment document under `experiments/` and write what it tests and how the result will be judged. For design-only work, produce an executable plan and stop before execution. For analysis of existing results, inspect and analyze those results directly. For retrospective recording, label it honestly as retrospective rather than presenting it as a prospective plan.", { capability: "experiment-design" }),
      host("Execute only when the request calls for execution. Use normal host tools and append the actual procedure and result, material failures or deviations, denominator accounting, and interpretation evidence to the same Experiment document used for the prospective plan. For analysis-only or retrospective work, preserve the actual provenance and do not invent an execution step.", { capability: "experiment-execution" }),
      maintainArea("experiments", "Record what the design, execution, analysis, or retrospective evidence supports and cannot establish in the relevant Experiment document when that context is worth preserving. Preserve failures, limitations, and uncertainty rather than normalizing the document into a fixed template.")
    ], clarification: commonClarification }]
  };
  if (slug === "draft") return {
    status: "artifact-work",
    modes: [{ id: "default", when: "The user requests drafting or revision of an ordinary project artifact.", steps: [
      readArea("claims", "the draft and its material claims"),
      relevantLessons,
      host("Read the target and relevant project evidence, then create or revise the ordinary draft artifact with host editing tools. Keep every claim within the available evidence and retain material counter-evidence and uncertainty.", { capability: "artifact-editing" }),
      host("Run appropriate host-native validation and report remaining unsupported claims, citation gaps, and uncertainty.", { capability: "artifact-validation", readOnly: true }),
      maintainArea("claims", "Create or revise a naturally named Claim document under `claims/` only when a material claim and its support, counter-evidence, missing evidence, or cannot-say boundary deserves durable treatment. Do not build a Claim database.")
    ], clarification: commonClarification }]
  };
  if (slug === "figure") return {
    status: "artifact-work",
    modes: [{ id: "default", when: "The user requests a figure, diagram, plot, or caption.", steps: [
      readResearchDocuments("When existing Dove research context would materially help the requested figure, read `.dove/research/RESEARCH.md`, then the directly relevant Mission or Experiment summary, then only needed linked details. Otherwise work directly from the user's requested materials and data. Do not recursively scan the research tree."),
      relevantLessons,
      host("Gather actual project materials and data, then create or revise the ordinary figure and caption with host-native plotting, image, or editing tools.", { capability: "figure-creation" }),
      host("Validate labels, denominators, provenance, legibility, and agreement between the figure, caption, and underlying evidence.", { capability: "figure-validation", readOnly: true }),
      updateResearchDocuments("Link the figure from the relevant Mission or Experiment detail document when that improves recovery, and naturally update that directory summary. Update `RESEARCH.md` only if the figure materially changes the mainline, conclusion, navigation, or priority.")
    ], clarification: commonClarification }]
  };
  if (slug === "review") return {
    status: "user-managed-review-document",
    modes: [{ id: "default", when: "The user requests user-managed separate review preparation, import, or review-context inspection.", steps: [
      readArea("reviews", "the review exchange"),
      relevantLessons,
      host("Follow the user's actual Review request. To prepare a new review, select or create one naturally named Review Markdown under `reviews/` and record the purpose, relevant project-relative artifact paths, scope limits, useful rubric, and a self-contained prompt for a separate reviewer chosen and managed by the user. If exact version freezing matters, use an ordinary Git commit, versioned copy, or review bundle and link it. To import a returned review, locate the corresponding Review document and preserve the supplied return faithfully without reconstructing preparation. To inspect existing review context, read and report it without creating a new Review document.", { capability: "review-preparation" }),
      host("Only when preparing a new review, return the relevant files and self-contained prompt to the user. Do not launch or substitute for the separate reviewer. When importing or inspecting, do not create a new handoff.", { capability: "review-handoff", readOnly: true }),
      maintainArea("reviews", "When the user supplies an actual reviewer return, append it faithfully to the corresponding Review document with a clear boundary from existing text. Do not rewrite, summarize over, or normalize the original return, and do not require verdict, severity, finding IDs, or a strict schema. Add author interpretation only when the user asks for it; use Rebuttal for substantive response, revision, and follow-up work.")
    ], clarification: commonClarification }]
  };
  if (slug === "rebuttal") return {
    status: "author-side-work",
    modes: [{ id: "default", when: "The user requests author-side rebuttal or revision from review findings.", steps: [
      readArea("reviews", "the relevant returned review"),
      relevantLessons,
      host("Read the relevant Review document and actual artifacts. Analyze each material finding against the evidence, write the response, and make requested ordinary project revisions. This remains Builder/Author work rather than a separate review return.", { capability: "rebuttal-and-revision" }),
      host("Validate that each response maps to a real finding and that revisions do not overstate evidence or erase failures and uncertainty.", { capability: "artifact-validation", readOnly: true }),
      maintainArea("reviews", "Append the author response, revisions, resulting decisions, unresolved issues, and follow-up to the same Review document or the directly affected research document when that context is worth preserving.")
    ], clarification: commonClarification }]
  };
  return {
    status: "advisory-markdown",
    modes: [
      { id: "read", when: "The user requests reading or explaining current Lessons.", steps: [
        readResearchDocuments("Read `.dove/research/RESEARCH.md` first only when project context is needed, then read `.dove/research/lessons/LESSONS.md`, then only the linked theme documents relevant to the request. Report supported reusable guidance as fallible advice. Do not create or modify files and do not treat Lessons as evidence.")
      ], clarification: [] },
      { id: "maintain", when: "The user explicitly requests remembering, reflection, or durable Lessons maintenance.", steps: [
        readResearchDocuments("Read `.dove/research/RESEARCH.md` first only when project context is needed, then `.dove/research/lessons/LESSONS.md`, then only relevant linked themes. Do not recursively scan all research files."),
        updateResearchDocuments("Preserve useful existing structure and maintain supported reusable guidance in the relevant theme under `lessons/`, or create a naturally named Markdown file when a new theme is genuinely useful. Update `lessons/LESSONS.md` with a natural link when needed. Source explanation is optional. Do not create lesson IDs, frontmatter, an application ledger, or treat Lessons as evidence.")
      ], clarification: commonClarification }
    ]
  };
}
var SURFACES = [
  ["research", "Complete one bounded pass of research, synthesis, or project investigation."],
  ["status", "Read the human-maintained research overview and summaries without writes."],
  ["source", "Discover, retrieve, read, verify, and document real sources that materially inform the research."],
  ["experiment", "Design, execute, analyze, or honestly record an experiment from real evidence."],
  ["draft", "Write or revise ordinary project drafts from the available evidence."],
  ["figure", "Gather real materials and create or revise figures and captions."],
  ["review", "Prepare, import, or inspect a user-managed review in one readable document."],
  ["rebuttal", "Perform author-side rebuttal and revision from actual review findings and evidence."],
  ["lessons", "Read or maintain advisory Lessons themes and their summary."],
  ["auto", "Conduct explicit high-autonomy multi-round research within the documented current mainline."]
];
var COMMAND_SURFACES = SURFACES.map(([slug, summary]) => ({
  id: `dove.${slug}`,
  title: `Dove ${slug}`,
  summary,
  requiredTools: [],
  workflow: workflow(slug),
  examples: [`/dove:${slug}`],
  guidance: slug === "review" ? ["Review is a user-managed separate exchange recorded in one readable document. Dove never launches, impersonates, or certifies the reviewer."] : []
}));
var COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((item) => [item.id, item]));
function commandIdToSlug(commandId) {
  return commandId.replace(/^dove\./u, "");
}
function hostCommandSlug(commandId) {
  return commandIdToSlug(commandId).replace(/\./gu, "-");
}
function adapterPathForCommand(hostId, command) {
  const commandId = typeof command === "string" ? command : command.id;
  const slug = hostCommandSlug(commandId);
  if (hostId === "opencode") return `.opencode/commands/${commandId}.md`;
  if (hostId === "cursor") return `.cursor/commands/dove-${slug}.md`;
  if (hostId === "codex") return `.codex/skills/dove-${slug}/SKILL.md`;
  if (hostId === "agents") return `.agents/skills/dove-${slug}/SKILL.md`;
  if (hostId === "claude") return `.claude/commands/dove/${slug}.md`;
  throw new Error(`Unknown host adapter: ${hostId}`);
}
function commandAdapterPathsForHost(hostId) {
  return COMMAND_SURFACES.map((command) => adapterPathForCommand(hostId, command));
}
function allGeneratedCommandAdapterPaths() {
  return PROJECT_HOST_IDS.flatMap(commandAdapterPathsForHost);
}
var HOST_ADAPTERS = Object.fromEntries(PROJECT_HOST_IDS.map((hostId) => {
  const commandPaths = commandAdapterPathsForHost(hostId);
  const extraPaths = hostId === "opencode" ? [...OPENCODE_ROLE_SKILL_PATHS] : hostId === "agents" ? ["AGENTS.md"] : [];
  return [hostId, { label: HOST_DEFINITIONS[hostId].label, paths: [...commandPaths, ...extraPaths], requiredPaths: [...commandPaths, ...extraPaths], jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks }];
}));
var CURRENT_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...PACKAGE_RUNTIME_PATHS]),
  opencode: Object.freeze([...HOST_ADAPTERS.opencode.paths]),
  codex: Object.freeze([...HOST_ADAPTERS.codex.paths]),
  cursor: Object.freeze([...HOST_ADAPTERS.cursor.paths]),
  agents: Object.freeze([...HOST_ADAPTERS.agents.paths]),
  claude: Object.freeze([...commandAdapterPathsForHost("claude"), ...DOVE_CLAUDE_AMBIENT_PROJECT_PATHS])
});
var RETIRED = ["workspace", "mission", "note", "experience"];
var RETIRED_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...RETIRED_PACKAGE_RUNTIME_PATHS]),
  opencode: Object.freeze([...RETIRED.map((slug) => `.opencode/commands/dove.${slug}.md`), ".opencode.json"]),
  codex: Object.freeze(RETIRED.flatMap((slug) => [`.codex/skills/dove-${slug}/SKILL.md`, `.codex/skills/dove-${slug}`])),
  cursor: Object.freeze(RETIRED.map((slug) => `.cursor/commands/dove-${slug}.md`)),
  agents: Object.freeze(RETIRED.flatMap((slug) => [`.agents/skills/dove-${slug}/SKILL.md`, `.agents/skills/dove-${slug}`])),
  claude: Object.freeze(RETIRED.map((slug) => `.claude/commands/dove/${slug}.md`))
});
var MANAGED_PACKAGE_PATHS = Object.freeze([...CURRENT_MANAGED_PATHS.opencode, ...CURRENT_MANAGED_PATHS.codex, ...CURRENT_MANAGED_PATHS.cursor, ...CURRENT_MANAGED_PATHS.agents, ...commandAdapterPathsForHost("claude"), ...PACKAGE_GENERATED_SUPPORT_PATHS, ...CURRENT_MANAGED_PATHS.core, ...PACKAGE_DOCUMENTATION_PATHS]);

// src/core/project-installation.mjs
import crypto4 from "node:crypto";
import fs10 from "node:fs";
import path10 from "node:path";

// src/core/host-registry.mjs
var PROJECT_HOST_IDS2 = Object.freeze(["opencode", "codex", "cursor", "agents", "claude"]);
var HOST_DEFINITIONS2 = [
  {
    id: "opencode",
    label: "OpenCode",
    order: 0,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectHooks: false, sharedInstructions: false },
    legacySignatures: [".opencode.json", ".opencode/commands/dove.status.md", ".opencode/skills/dove-planner/SKILL.md"]
  },
  {
    id: "codex",
    label: "Codex",
    order: 1,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectHooks: false, sharedInstructions: false },
    legacySignatures: [".codex/skills/dove-status/SKILL.md"]
  },
  {
    id: "cursor",
    label: "Cursor",
    order: 2,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectHooks: false, sharedInstructions: false },
    legacySignatures: [".cursor/commands/dove-status.md"]
  },
  {
    id: "agents",
    label: "Shared agent skills",
    order: 3,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectHooks: false, sharedInstructions: true },
    legacySignatures: [".agents/skills/dove-status/SKILL.md", "AGENTS.md"]
  },
  {
    id: "claude",
    label: "Claude Code",
    order: 4,
    projectInitializable: true,
    capabilities: { commandAdapters: true, projectHooks: true, sharedInstructions: false },
    legacySignatures: [
      "mcp/dove-claude-project.json",
      ".mcp.json",
      ".claude/settings.json",
      ".claude/rules/dove.md",
      ".claude/skills/dove-intake/SKILL.md"
    ]
  }
];
function freezeHostDefinition(definition) {
  return Object.freeze({
    ...definition,
    capabilities: Object.freeze({ ...definition.capabilities }),
    legacySignatures: Object.freeze([...definition.legacySignatures])
  });
}
var HOST_REGISTRY = Object.freeze(Object.fromEntries(
  HOST_DEFINITIONS2.map((definition) => [definition.id, freezeHostDefinition(definition)])
));
var DEFAULT_INITIALIZABLE_HOSTS = Object.freeze(
  PROJECT_HOST_IDS2.filter((hostId) => HOST_REGISTRY[hostId].projectInitializable)
);
function selectionValues(raw) {
  if (raw === void 0 || raw === null) return [];
  if (typeof raw === "string") return [raw];
  if (!Array.isArray(raw)) throw new Error("Host selection must be a host id or an array of host ids.");
  return raw;
}
function defaultSelection(defaultWhenEmpty) {
  if (defaultWhenEmpty === false || defaultWhenEmpty === null) return [];
  if (defaultWhenEmpty === true || defaultWhenEmpty === void 0) return [...DEFAULT_INITIALIZABLE_HOSTS];
  return selectionValues(defaultWhenEmpty);
}
function normalizeHostSelection(raw, options = {}) {
  const requested = selectionValues(raw);
  const source = requested.length > 0 ? requested : defaultSelection(options.defaultWhenEmpty);
  for (const hostId of source) {
    if (typeof hostId !== "string" || !hostId || hostId !== hostId.trim()) {
      throw new Error(`Invalid Dove project host id: ${String(hostId)}.`);
    }
  }
  const expanded = source.includes("all") ? PROJECT_HOST_IDS2 : source;
  const unknown = [...new Set(expanded.filter((hostId) => !PROJECT_HOST_IDS2.includes(hostId)))];
  if (unknown.length > 0) throw new Error(`Unknown Dove project host(s): ${unknown.join(", ")}.`);
  const selected = PROJECT_HOST_IDS2.filter((hostId) => expanded.includes(hostId));
  if (options.requireInitializable === true) {
    const unavailable = selected.filter((hostId) => !HOST_REGISTRY[hostId].projectInitializable);
    if (unavailable.length > 0) {
      throw new Error(`Dove project initialization is not available for host(s) without a complete project integration path: ${unavailable.join(", ")}.`);
    }
  }
  return Object.freeze(selected);
}

// src/core/project-installation-manifest.mjs
import fs7 from "node:fs";
import path7 from "node:path";
var INSTALLATION_MANIFEST_PATH = ARTIFACT_PATHS.installationManifest;
var LEGACY_INSTALLATION_MANIFEST_PATH = ".dove-install/manifest.json";
var INSTALLATION_MANIFEST_REVISION = "2.0";
var PREVIOUS_INSTALLATION_MANIFEST_REVISION = "1.0";
var MANIFEST_FIELDS = /* @__PURE__ */ new Set(["revision", "package", "runtime", "hosts", "managed", "createdAt", "updatedAt"]);
var PACKAGE_FIELDS = /* @__PURE__ */ new Set(["name", "version"]);
var RUNTIME_FIELDS = /* @__PURE__ */ new Set(["mode"]);
var MANAGED_FIELDS = /* @__PURE__ */ new Set(["path", "kind", "selector", "digest"]);
var MANAGED_KINDS = /* @__PURE__ */ new Set(["exclusive-file", "json-fragment", "text-block"]);
var SHA2562 = /^[a-f0-9]{64}$/u;
var SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
function plainObject3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function assertPlainObject(value, label) {
  if (!plainObject3(value)) throw new Error(`${label} must be a plain object.`);
}
function assertFields(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
  const missing = [...fields].filter((field) => !Object.hasOwn(value, field));
  if (missing.length > 0) throw new Error(`${label} is missing required fields: ${missing.join(", ")}.`);
}
function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value || value !== value.trim() || value.includes("\0")) {
    throw new Error(`${label} must be a non-empty trimmed string.`);
  }
  return value;
}
function exactIsoTimestamp(value, label) {
  nonEmptyString(value, label);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO timestamp.`);
  }
  return value;
}
function canonicalProjectRelativePath(value, label) {
  nonEmptyString(value, label);
  if (value.includes("\\") || path7.posix.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value)) {
    throw new Error(`${label} must be a project-relative path without backslashes: ${value}`);
  }
  const normalized = path7.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized === ".." || normalized.startsWith("../") || value.includes("//") || value.endsWith("/")) {
    throw new Error(`${label} must be one canonical project-relative path: ${value}`);
  }
  if (value === ".dove" || value.startsWith(".dove/")) {
    throw new Error(`${label} must not manage Dove research or installation state: ${value}`);
  }
  return value;
}
function normalizeAllowedHosts(options) {
  const allowed = options.hostIds;
  if (!Array.isArray(allowed) || allowed.length === 0 || allowed.some((hostId) => typeof hostId !== "string" || !hostId || hostId === "all")) {
    throw new Error("Project installation manifest validation requires concrete hostIds in registry order.");
  }
  if (new Set(allowed).size !== allowed.length) throw new Error("Project installation manifest hostIds must be unique.");
  return allowed;
}
function validateHosts(hosts, allowedHosts) {
  if (!Array.isArray(hosts) || hosts.length === 0) throw new Error("Project installation manifest hosts must be a non-empty array.");
  for (const hostId of hosts) {
    nonEmptyString(hostId, "Project installation manifest host");
    if (hostId === "all" || !allowedHosts.includes(hostId)) throw new Error(`Project installation manifest contains unknown host: ${hostId}.`);
  }
  if (new Set(hosts).size !== hosts.length) throw new Error("Project installation manifest hosts must be unique.");
  return hosts;
}
function validateManagedEntry(entry, index) {
  const label = `Project installation manifest managed[${index}]`;
  assertFields(entry, MANAGED_FIELDS, label);
  canonicalProjectRelativePath(entry.path, `${label}.path`);
  if (!MANAGED_KINDS.has(entry.kind)) throw new Error(`${label}.kind is unsupported: ${entry.kind}.`);
  if (entry.kind === "exclusive-file") {
    if (entry.selector !== null) throw new Error(`${label}.selector must be null for exclusive-file ownership.`);
  } else {
    nonEmptyString(entry.selector, `${label}.selector`);
  }
  if (typeof entry.digest !== "string" || !SHA2562.test(entry.digest)) {
    throw new Error(`${label}.digest must be a lowercase 64-character SHA-256 digest.`);
  }
  return entry;
}
function managedKey(entry) {
  return `${entry.path}\0${entry.kind}\0${entry.selector ?? ""}`;
}
function compareManaged(left, right) {
  return left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind) || String(left.selector ?? "").localeCompare(String(right.selector ?? ""));
}
function validateManaged(managed) {
  if (!Array.isArray(managed)) throw new Error("Project installation manifest managed must be an array.");
  managed.forEach(validateManagedEntry);
  const keys = managed.map(managedKey);
  if (new Set(keys).size !== keys.length) throw new Error("Project installation manifest managed entries must be unique.");
  return managed;
}
function normalizeTimestamp(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return exactIsoTimestamp(value, "Project installation manifest timestamp");
  if (value === void 0) return (/* @__PURE__ */ new Date()).toISOString();
  throw new Error("Project installation manifest timestamp must be a Date or exact ISO timestamp.");
}
function normalizeManaged(rawManaged = []) {
  const byKey = /* @__PURE__ */ new Map();
  for (const rawEntry of rawManaged) {
    const entry = {
      path: rawEntry.path,
      kind: rawEntry.kind,
      selector: rawEntry.selector ?? null,
      digest: rawEntry.digest
    };
    validateManagedEntry(entry, byKey.size);
    const key = managedKey(entry);
    const previous = byKey.get(key);
    if (previous && previous.digest !== entry.digest) throw new Error(`Conflicting project installation manifest entry: ${entry.path}.`);
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort(compareManaged);
}
function validateProjectInstallationManifest(value, options = {}) {
  const allowedHosts = normalizeAllowedHosts(options);
  assertFields(value, MANIFEST_FIELDS, "Project installation manifest");
  if (value.revision !== INSTALLATION_MANIFEST_REVISION) {
    throw new Error(`Project installation manifest revision must equal ${INSTALLATION_MANIFEST_REVISION}.`);
  }
  assertFields(value.package, PACKAGE_FIELDS, "Project installation manifest package");
  nonEmptyString(value.package.name, "Project installation manifest package.name");
  nonEmptyString(value.package.version, "Project installation manifest package.version");
  if (!SEMVER.test(value.package.version)) throw new Error("Project installation manifest package.version must be a semantic version.");
  assertFields(value.runtime, RUNTIME_FIELDS, "Project installation manifest runtime");
  if (value.runtime.mode !== "user-cli") throw new Error("Project installation manifest runtime.mode must be user-cli.");
  validateHosts(value.hosts, allowedHosts);
  validateManaged(value.managed);
  const createdAt = exactIsoTimestamp(value.createdAt, "Project installation manifest createdAt");
  const updatedAt = exactIsoTimestamp(value.updatedAt, "Project installation manifest updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Project installation manifest updatedAt must not precede createdAt.");
  return value;
}
function createProjectInstallationManifest(input = {}, options = {}) {
  const allowedHosts = normalizeAllowedHosts(options);
  const requestedHosts = input.hosts ?? [];
  if (!Array.isArray(requestedHosts) || requestedHosts.some((hostId) => hostId === "all" || !allowedHosts.includes(hostId))) {
    throw new Error("Project installation manifest hosts must contain only concrete known host ids.");
  }
  const hosts = allowedHosts.filter((hostId) => requestedHosts.includes(hostId));
  const createdAt = normalizeTimestamp(input.createdAt ?? input.now);
  const updatedAt = normalizeTimestamp(input.updatedAt ?? createdAt);
  const manifest = {
    revision: INSTALLATION_MANIFEST_REVISION,
    package: { name: input.package?.name, version: input.package?.version },
    runtime: { mode: "user-cli" },
    hosts,
    managed: normalizeManaged(input.managed),
    createdAt,
    updatedAt
  };
  validateProjectInstallationManifest(manifest, { hostIds: allowedHosts });
  return manifest;
}
function serializeProjectInstallationManifest(value, options = {}) {
  validateProjectInstallationManifest(value, options);
  return `${JSON.stringify(value, null, 2)}
`;
}
function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function inspectManifestFile(root, fsOps, manifestRelativePath) {
  const installationDirectory = path7.join(root, path7.posix.dirname(manifestRelativePath));
  const directoryStat = lstatOrNull(fsOps, installationDirectory);
  if (directoryStat === null) throw new Error(`Dove project installation manifest is missing: ${manifestRelativePath}.`);
  if (directoryStat.isSymbolicLink()) throw new Error(`Dove project installation directory must not be a symbolic link: ${installationDirectory}.`);
  if (!directoryStat.isDirectory()) throw new Error(`Dove project installation path must be a directory: ${installationDirectory}.`);
  const manifestPath = path7.join(root, manifestRelativePath);
  const stat = lstatOrNull(fsOps, manifestPath);
  if (stat === null) throw new Error(`Dove project installation manifest is missing: ${manifestRelativePath}.`);
  if (stat.isSymbolicLink()) throw new Error(`Dove project installation manifest must not be a symbolic link: ${manifestRelativePath}.`);
  if (!stat.isFile()) throw new Error(`Dove project installation manifest must be a regular file: ${manifestRelativePath}.`);
  return manifestPath;
}
function readProjectInstallationManifest(root, options = {}) {
  const fsOps = options.fsOps ?? fs7;
  const manifestPath = inspectManifestFile(root, fsOps, INSTALLATION_MANIFEST_PATH);
  try {
    const parsed = parseJsonWithoutDuplicateKeys(fsOps.readFileSync(manifestPath, "utf8"), "Dove project installation manifest");
    validateProjectInstallationManifest(parsed, options);
    return parsed;
  } catch (error) {
    throw new Error(`Invalid Dove project installation manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}
function validatePreviousManagedEntry(entry, index) {
  const label = `Dove 1.0 installation manifest managed[${index}]`;
  assertPlainObject(entry, label);
  const kind = entry.kind ?? entry.mode;
  const normalized = { path: entry.path, kind, selector: entry.selector ?? null, digest: entry.digest };
  validateManagedEntry(normalized, index);
  return normalized;
}
function normalizePreviousManifest(value, manifestPath, options) {
  assertPlainObject(value, "Dove 1.0 installation manifest");
  const recognizedRevision = value.revision === PREVIOUS_INSTALLATION_MANIFEST_REVISION;
  const recognizedReleasedShape = value.schemaVersion === 1 && value.integrationVersion === 4 && value.ownershipVersion === 4 && value.runtime?.protocolVersion === 3;
  if (!recognizedRevision && !recognizedReleasedShape) {
    throw new Error(`Dove migration accepts only installation revision ${PREVIOUS_INSTALLATION_MANIFEST_REVISION}.`);
  }
  const allowedHosts = normalizeAllowedHosts(options);
  assertPlainObject(value.package, "Dove 1.0 installation manifest package");
  nonEmptyString(value.package.name, "Dove 1.0 installation manifest package.name");
  nonEmptyString(value.package.version, "Dove 1.0 installation manifest package.version");
  if (!SEMVER.test(value.package.version)) throw new Error("Dove 1.0 installation manifest package.version must be a semantic version.");
  if (value.runtime?.mode !== "user-cli") throw new Error("Dove 1.0 installation manifest runtime.mode must be user-cli.");
  validateHosts(value.hosts, allowedHosts);
  if (!Array.isArray(value.managed)) throw new Error("Dove 1.0 installation manifest managed must be an array.");
  const managed = value.managed.map(validatePreviousManagedEntry);
  if (new Set(managed.map(managedKey)).size !== managed.length) throw new Error("Dove 1.0 installation manifest managed entries must be unique.");
  const createdAt = exactIsoTimestamp(value.createdAt, "Dove 1.0 installation manifest createdAt");
  const updatedAt = exactIsoTimestamp(value.updatedAt, "Dove 1.0 installation manifest updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Dove 1.0 installation manifest updatedAt must not precede createdAt.");
  return {
    revision: PREVIOUS_INSTALLATION_MANIFEST_REVISION,
    package: { name: value.package.name, version: value.package.version },
    runtime: { mode: "user-cli" },
    hosts: [...value.hosts],
    managed,
    createdAt,
    updatedAt,
    sourcePath: manifestPath
  };
}
function readProjectInstallationManifestForMigration(root, options = {}) {
  const fsOps = options.fsOps ?? fs7;
  const relativePath = options.manifestPath ?? INSTALLATION_MANIFEST_PATH;
  if (![INSTALLATION_MANIFEST_PATH, LEGACY_INSTALLATION_MANIFEST_PATH].includes(relativePath)) {
    throw new Error(`Unsupported Dove installation migration manifest path: ${relativePath}.`);
  }
  const manifestPath = inspectManifestFile(root, fsOps, relativePath);
  try {
    const parsed = parseJsonWithoutDuplicateKeys(fsOps.readFileSync(manifestPath, "utf8"), "Dove 1.0 installation manifest");
    return normalizePreviousManifest(parsed, relativePath, options);
  } catch (error) {
    throw new Error(`Invalid Dove 1.0 installation manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

// src/core/project-root.mjs
import fs8 from "node:fs";
import path8 from "node:path";
var INSTALLATION_DIRECTORY = path8.posix.dirname(INSTALLATION_MANIFEST_PATH);
function realpathNative2(fsOps, targetPath) {
  return typeof fsOps.realpathSync?.native === "function" ? fsOps.realpathSync.native(targetPath) : fsOps.realpathSync(targetPath);
}
function canonicalExistingDirectory(value, label, fsOps) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error(`${label} must name an existing directory.`);
  const resolved = path8.resolve(value);
  let stat;
  try {
    stat = fsOps.statSync(resolved);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`${label} must name an existing directory: ${resolved}.`);
    throw error;
  }
  if (!stat.isDirectory()) throw new Error(`${label} must name an existing directory: ${resolved}.`);
  return realpathNative2(fsOps, resolved);
}
function parentDirectories2(start) {
  const directories = [];
  let current = start;
  while (true) {
    directories.push(current);
    const parent = path8.dirname(current);
    if (parent === current) return directories;
    current = parent;
  }
}
function lstatOrNull2(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function installationStateAt(root, options) {
  const fsOps = options.fsOps ?? fs8;
  const directoryPath = path8.join(root, INSTALLATION_DIRECTORY);
  const manifestPath = path8.join(root, INSTALLATION_MANIFEST_PATH);
  const manifestStat = lstatOrNull2(fsOps, manifestPath);
  if (manifestStat === null) {
    const directoryStat2 = lstatOrNull2(fsOps, directoryPath);
    if (directoryStat2 === null) return { state: "absent", root, manifestPath };
    return { state: "residue", root, manifestPath, directoryPath, directoryStat: directoryStat2 };
  }
  if (manifestStat.isSymbolicLink()) throw new Error(`Dove project installation manifest must not be a symbolic link: ${manifestPath}.`);
  if (!manifestStat.isFile()) throw new Error(`Dove project installation manifest must be a regular file: ${manifestPath}.`);
  const directoryStat = lstatOrNull2(fsOps, directoryPath);
  if (directoryStat === null || directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) throw new Error(`Dove installation path must be a real directory: ${directoryPath}.`);
  const manifest = readProjectInstallationManifest(root, { ...options, hostIds: options.hostIds ?? PROJECT_HOST_IDS2 });
  return { state: "initialized", root, manifestPath, manifest };
}
function assertSafeInitCandidate(candidate, installation) {
  if (installation.state !== "residue") return;
  const stat = installation.directoryStat;
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove installation path must be a real directory: ${installation.directoryPath}.`);
  throw new Error(`Dove installation directory is incomplete because ${INSTALLATION_MANIFEST_PATH} is missing at ${candidate}.`);
}
function setupEvidenceAt(root, fsOps, options = {}) {
  const paths = [
    INSTALLATION_MANIFEST_PATH,
    LEGACY_INSTALLATION_MANIFEST_PATH,
    ...options.includeResearch === true ? [".dove/manifest.json"] : []
  ];
  for (const relativePath of paths) {
    const target = path8.join(root, relativePath);
    const stat = lstatOrNull2(fsOps, target);
    if (stat === null) continue;
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(`Dove setup marker must be a regular non-symbolic-link file: ${target}.`);
    }
    return { state: "marker", relativePath };
  }
  for (const relativePath of [INSTALLATION_DIRECTORY, ".dove-install"]) {
    const target = path8.join(root, relativePath);
    const stat = lstatOrNull2(fsOps, target);
    if (stat === null) continue;
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Dove setup path must be a real directory: ${target}.`);
    }
    return { state: "residue", relativePath };
  }
  return { state: "absent", relativePath: null };
}
function legacyInitError(candidate, root, evidence) {
  if (evidence.relativePath === LEGACY_INSTALLATION_MANIFEST_PATH) {
    return new Error(`Dove found a legacy project installation at ${root}. Run 'dove update' to preserve its research state, or 'dove reinstall' to delete and recreate Dove state.`);
  }
  if (evidence.relativePath === ".dove/manifest.json") {
    return new Error(`Dove found an unsupported legacy research workspace at ${root}. Run 'dove reinstall' to delete and recreate Dove state, or 'dove doctor --json' for diagnosis.`);
  }
  return new Error(`Dove found incomplete legacy Dove state at ${root}. Run 'dove doctor --json' before initializing another project.`);
}
function gitRootFrom(start, fsOps) {
  for (const directory of parentDirectories2(start)) {
    const dotGit = path8.join(directory, ".git");
    const stat = lstatOrNull2(fsOps, dotGit);
    if (stat === null) continue;
    if (stat.isSymbolicLink()) throw new Error(`Git project marker must not be a symbolic link: ${dotGit}.`);
    if (!stat.isDirectory() && !stat.isFile()) throw new Error(`Git project marker must be a file or directory: ${dotGit}.`);
    return directory;
  }
  return null;
}
function initRequiredError(start) {
  return new Error(`Dove project integration is not initialized from ${start}. Run 'dove init' from the project root, or use 'dove init --project <dir>'.`);
}
function resolveProjectRootForInit(project, options = {}) {
  const fsOps = options.fsOps ?? fs8;
  const explicitProject = project !== void 0 && project !== null;
  const candidateInput = explicitProject ? project : options.cwd ?? process.cwd();
  const candidate = canonicalExistingDirectory(candidateInput, explicitProject ? "Dove project" : "Current working directory", fsOps);
  const gitRoot = gitRootFrom(candidate, fsOps);
  const allDirectories = parentDirectories2(candidate);
  const directories = gitRoot === null ? allDirectories : allDirectories.slice(0, allDirectories.indexOf(gitRoot) + 1);
  for (let index = 0; index < directories.length; index += 1) {
    const directory = directories[index];
    const installation = installationStateAt(directory, options);
    if (index === 0) assertSafeInitCandidate(candidate, installation);
    if (installation.state === "initialized") {
      if (index === 0) throw new Error(`Dove project integration is already initialized at ${directory}. Use dove update instead.`);
      throw new Error(`Refusing nested Dove project initialization at ${candidate}; an initialized project already exists at ${directory}.`);
    }
    const evidence = setupEvidenceAt(directory, fsOps, { includeResearch: index === 0 });
    if (evidence.state !== "absent") throw legacyInitError(candidate, directory, evidence);
  }
  return !explicitProject && gitRoot !== null ? gitRoot : candidate;
}
function packageProjectBoundary(directory, fsOps) {
  const packageJson = lstatOrNull2(fsOps, path8.join(directory, "package.json"));
  const nodeModules = lstatOrNull2(fsOps, path8.join(directory, "node_modules"));
  return packageJson?.isFile() && !packageJson.isSymbolicLink() && nodeModules?.isDirectory() && !nodeModules.isSymbolicLink();
}
function resolveProjectRootForSetup(start, options = {}) {
  const fsOps = options.fsOps ?? fs8;
  const candidate = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project setup start", fsOps);
  for (const directory of parentDirectories2(candidate)) {
    if (setupEvidenceAt(directory, fsOps).state !== "absent") return directory;
    const dotGit = lstatOrNull2(fsOps, path8.join(directory, ".git"));
    if (dotGit !== null) {
      if (dotGit.isSymbolicLink() || !dotGit.isDirectory() && !dotGit.isFile()) {
        throw new Error(`Git project marker must be a file or directory: ${path8.join(directory, ".git")}.`);
      }
      return directory;
    }
    if (packageProjectBoundary(directory, fsOps)) return directory;
  }
  return candidate;
}
function resolveInstalledProjectRoot(start, options = {}) {
  const fsOps = options.fsOps ?? fs8;
  const startingDirectory = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project search start", fsOps);
  for (const directory of parentDirectories2(startingDirectory)) {
    const installation = installationStateAt(directory, options);
    if (installation.state === "initialized") return directory;
  }
  throw initRequiredError(startingDirectory);
}
function inspectProjectRoot(start, options = {}) {
  let canonicalStart = null;
  try {
    canonicalStart = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project search start", options.fsOps ?? fs8);
    const root = resolveInstalledProjectRoot(canonicalStart, options);
    return Object.freeze({ state: "initialized", initialized: true, start: canonicalStart, root, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const uninitialized = message.includes("Dove project integration is not initialized");
    return Object.freeze({
      state: uninitialized ? "uninitialized" : "invalid",
      initialized: false,
      start: canonicalStart,
      root: null,
      error: message
    });
  }
}

// scripts/generate-command-adapters.mjs
import fs9 from "node:fs";
import path9 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var __filename = fileURLToPath2(import.meta.url);
var __dirname = path9.dirname(__filename);
var PACKAGE_ROOT = path9.resolve(__dirname, "..");
function markdownTitle(command) {
  return command.title.replace(/\b\w/g, (char) => char.toUpperCase());
}
function yamlString(value) {
  return JSON.stringify(String(value).replace(/\n/g, " "));
}
function exampleBullets(command, hostId = null) {
  const examples = command.examples;
  if (!Array.isArray(examples)) {
    return [];
  }
  return examples.map((example) => {
    const text = String(example).trim();
    return hostId === "opencode" ? text.replace(/^\/dove:/u, "/dove.") : text;
  }).filter(Boolean);
}
function renderBullets(bullets2) {
  return bullets2.map((bullet) => `- ${bullet}`).join("\n");
}
function renderWorkflow(command) {
  const modes = command.workflow?.modes;
  if (!Array.isArray(modes) || modes.length === 0) return "";
  const lines = [
    "## Internal workflow",
    "",
    "Internal guidance only; never use this workflow as the final report outline.",
    ""
  ];
  for (const item of modes) {
    lines.push(`- **${item.when}**`);
    for (const [index, step] of item.steps.entries()) {
      const writeBoundary = step.readOnly ? " This step is read-only; do not create or modify files." : step.persistWhen && step.persistWhen !== "never" ? ` Maintain Dove research Markdown only when ${step.persistWhen}.` : "";
      lines.push(`  ${index + 1}. Use host tools (${step.readOnly ? "read-only" : "work"}; ${step.capability}). ${step.instruction}${writeBoundary}`);
    }
    for (const clarification of item.clarification ?? []) {
      lines.push(`  - Clarification: ${clarification}`);
    }
  }
  return lines.join("\n");
}
function renderGuidance(command) {
  const notes = Array.isArray(command.guidance) ? command.guidance.filter(Boolean) : [];
  return notes.length > 0 ? `## Command guidance

${renderBullets(notes)}` : "";
}
function renderCapsule() {
  return `## Dove capsule

${renderBullets(HOST_ADAPTER_POLICY.adapterBullets)}`;
}
function renderExamples(command, hostId = null) {
  const examples = exampleBullets(command, hostId);
  return examples.length > 0 ? `

## Examples

${examples.map((example) => `- \`${example}\``).join("\n")}` : "";
}
function renderBody(command, heading, hostId = null) {
  const purpose = command.summary;
  const examples = renderExamples(command, hostId);
  const workflow2 = renderWorkflow(command);
  const guidance = renderGuidance(command);
  const capsule = renderCapsule();
  return `# ${heading}

${purpose}${examples}

${workflow2}${guidance ? `

${guidance}` : ""}

${capsule}
`;
}
function renderFrontmatter(command, fields = {}) {
  const lines = ["---"];
  if (fields.name) {
    lines.push(`name: ${fields.name}`);
  }
  lines.push(`description: ${yamlString(command.summary)}`);
  lines.push("---", "");
  return lines.join("\n");
}
function renderMarkdownCommand(command, heading, hostId = null) {
  return `${renderFrontmatter(command)}
${renderBody(command, heading, hostId)}`;
}
function renderSkill(command, hostId = null) {
  const name = `dove-${hostCommandSlug(command.id)}`;
  return `${renderFrontmatter(command, { name })}
${renderBody(command, markdownTitle(command), hostId)}`;
}
function renderCommandAdapter(hostId, command) {
  switch (hostId) {
    case "opencode":
    case "claude":
      return renderMarkdownCommand(command, command.id, hostId);
    case "cursor":
      return renderMarkdownCommand(command, `dove-${hostCommandSlug(command.id)}`, hostId);
    case "codex":
    case "agents":
      return renderSkill(command, hostId);
    default:
      throw new Error(`Unknown host adapter: ${hostId}`);
  }
}
function generatedAdapterEntries() {
  return PROJECT_HOST_IDS.flatMap((hostId) => COMMAND_SURFACES.map((command) => ({
    hostId,
    command,
    relativePath: adapterPathForCommand(hostId, command),
    content: renderCommandAdapter(hostId, command)
  })));
}
function generatedClaudeAmbientProjectEntries() {
  return [
    { relativePath: DOVE_CLAUDE_AMBIENT_RULE_PATH, content: renderClaudeAmbientRule() },
    { relativePath: DOVE_CLAUDE_AMBIENT_SKILL_PATH, content: renderClaudeAmbientSkill() },
    { relativePath: PAPER_SEARCH_SUPPORT_SKILL_PATH, content: renderPaperSearchSupportSkill() }
  ];
}

// src/core/project-installation.mjs
var MCP_PATH = PAPER_SEARCH_MCP_PATH;
var SETTINGS_SELECTOR = "/hooks/UserPromptSubmit[dove-user-prompt-submit]";
var CLAUDE_HOST = "claude";
var FORBIDDEN_RESOURCE_PREFIXES = [".dove/", "bin/", "dist/", "mcp/", "scripts/"];
function plainObject4(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function sha2563(content) {
  return crypto4.createHash("sha256").update(content).digest("hex");
}
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}
function semanticDigest(value) {
  return sha2563(canonicalJson(value));
}
function normalizedGeneratedContent(content) {
  return `${String(content).trimEnd()}
`;
}
function managedKey2(entry) {
  return `${entry.path}\0${entry.kind}\0${entry.selector ?? ""}`;
}
function compareManaged2(left, right) {
  return left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind) || String(left.selector ?? "").localeCompare(String(right.selector ?? ""));
}
function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function samePackage(left, right) {
  return left.name === right.name && left.version === right.version;
}
function sameManaged(left, right) {
  const sortedLeft = [...left].sort(compareManaged2);
  const sortedRight = [...right].sort(compareManaged2);
  return sortedLeft.length === sortedRight.length && sortedLeft.every((entry, index) => managedKey2(entry) === managedKey2(sortedRight[index]) && entry.digest === sortedRight[index].digest);
}
function exactTimestamp2(value) {
  if (value === void 0) return (/* @__PURE__ */ new Date()).toISOString();
  const timestamp2 = value instanceof Date ? value.toISOString() : value;
  if (typeof timestamp2 !== "string" || new Date(timestamp2).toISOString() !== timestamp2) throw new Error("Project integration now must be a Date or exact ISO timestamp.");
  return timestamp2;
}
function assertPackageInput(packageName, packageVersion, { required }) {
  if (!required && packageName === void 0 && packageVersion === void 0) return;
  if (typeof packageName !== "string" || !packageName || packageName !== packageName.trim() || packageName.includes("\0")) throw new Error("Project integration packageName must be a non-empty trimmed string.");
  if (typeof packageVersion !== "string" || !packageVersion || packageVersion !== packageVersion.trim()) throw new Error("Project integration packageVersion must be a semantic version string.");
}
function normalizeSelectedHosts(raw, { defaultWhenEmpty }) {
  if (Array.isArray(raw) && raw.length === 0) throw new Error("Dove project integration requires at least one host.");
  const hosts = normalizeHostSelection(raw, { defaultWhenEmpty, requireInitializable: true });
  if (hosts.length === 0) throw new Error("Dove project integration requires at least one host.");
  return [...hosts];
}
function assertManagedResourcePath(relativePath) {
  if (relativePath === ".dove" || relativePath.startsWith(".dove/")) throw new Error(`Project integration resources must not manage Dove workspace state: ${relativePath}.`);
  if (FORBIDDEN_RESOURCE_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) throw new Error(`Project integration resources must not install runtime bundles: ${relativePath}.`);
}
function claudeResources() {
  const roleEntries = generatedRoleDefinitionEntries().filter((entry) => entry.relativePath.startsWith(".claude/agents/"));
  const files = [
    ...generatedAdapterEntries().filter((entry) => entry.hostId === CLAUDE_HOST),
    ...generatedClaudeAmbientProjectEntries(),
    ...roleEntries
  ].map((entry) => {
    assertManagedResourcePath(entry.relativePath);
    const content = normalizedGeneratedContent(entry.content);
    return {
      hostId: CLAUDE_HOST,
      path: entry.relativePath,
      kind: "exclusive-file",
      selector: null,
      content,
      digest: sha2563(content)
    };
  });
  const hooks = {
    UserPromptSubmit: DOVE_CLAUDE_AMBIENT_HOOK_ENTRY,
    Stop: DOVE_CLAUDE_STOP_HOOK_ENTRY
  };
  const hook = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: SETTINGS_SELECTOR,
    fragment: hooks,
    digest: semanticDigest(hooks)
  };
  const paperSearch = {
    hostId: CLAUDE_HOST,
    path: PAPER_SEARCH_MCP_PATH,
    kind: "json-fragment",
    selector: PAPER_SEARCH_MCP_SELECTOR,
    fragment: PAPER_SEARCH_MCP_FRAGMENT,
    digest: semanticDigest(PAPER_SEARCH_MCP_FRAGMENT)
  };
  const resources = [...files, hook, paperSearch];
  if (new Set(resources.map(managedKey2)).size !== resources.length) throw new Error("Generated project integration resources contain duplicate manifest entries.");
  return resources;
}
function resourcesForHosts(hosts) {
  return claudeResources().filter((entry) => hosts.includes(entry.hostId)).sort(compareManaged2);
}
function lstatOrNull3(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function inspectRegularProjectFile(root, relativePath, fsOps) {
  let current = root;
  for (const [index, component] of relativePath.split("/").entries()) {
    current = path10.join(current, component);
    const stat = lstatOrNull3(fsOps, current);
    if (stat === null) return { exists: false, bytes: null, digest: null, mode: null, type: "absent" };
    if (stat.isSymbolicLink()) throw new Error(`Dove project integration path must not be a symbolic link: ${relativePath}.`);
    if (index < relativePath.split("/").length - 1) {
      if (!stat.isDirectory()) throw new Error(`Dove project integration parent must be a directory: ${relativePath}.`);
      continue;
    }
    if (!stat.isFile()) throw new Error(`Dove project integration path must be absent or a regular file: ${relativePath}.`);
    const bytes = fsOps.readFileSync(current);
    return { exists: true, bytes, digest: sha2563(bytes), mode: stat.mode & 4095, type: "file" };
  }
  throw new Error(`Invalid Dove project integration path: ${relativePath}.`);
}
function expectedFileState(state2) {
  return state2.exists ? { exists: true, type: "file", sha256: state2.digest, mode: state2.mode } : { exists: false, type: "absent", sha256: null, mode: null };
}
function transactionWrite(root, resource, content, observed) {
  return {
    root,
    relativePath: resource.path,
    content,
    encoding: "utf8",
    force: true,
    expectedState: expectedFileState(observed),
    label: `Dove project integration resource ${resource.path}`
  };
}
function transactionDelete(root, resource, observed) {
  return {
    root,
    relativePath: resource.path,
    delete: true,
    force: true,
    expectedState: expectedFileState(observed),
    label: `Dove project integration resource ${resource.path}`
  };
}
function parseSharedJson(state2, relativePath) {
  if (!state2.exists) return {};
  const value = parseJsonWithoutDuplicateKeys(state2.bytes.toString("utf8"), relativePath);
  if (!plainObject4(value)) throw new Error(`${relativePath} must contain a JSON object.`);
  return value;
}
function serializeSharedJson(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}
function referencesDoveHook(entry, eventName) {
  return plainObject4(entry) && Array.isArray(entry.hooks) && entry.hooks.some((hook) => {
    if (!plainObject4(hook) || typeof hook.command !== "string") return false;
    if (eventName === "UserPromptSubmit") {
      return hook.command.includes("dove hook user-prompt-submit") || hook.command.includes("dove-user-prompt-submit-package.mjs");
    }
    return hook.command.includes("dove hook stop");
  });
}
function hookFragmentState(settings, eventName) {
  if (settings.hooks !== void 0 && !plainObject4(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  const entries = settings.hooks?.[eventName];
  if (entries !== void 0 && !Array.isArray(entries)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.${eventName} must be an array.`);
  const candidates = (entries ?? []).map((entry, index) => ({ entry, index })).filter(({ entry }) => referencesDoveHook(entry, eventName));
  if (candidates.length > 1) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} defines multiple Dove ${eventName} hooks.`);
  if (candidates.length === 0) return { exists: false, digest: null, index: -1, fragment: null };
  return { exists: true, digest: semanticDigest(candidates[0].entry), index: candidates[0].index, fragment: candidates[0].entry };
}
function namedMcpFragmentState(config, serverName) {
  if (config.mcpServers !== void 0 && !plainObject4(config.mcpServers)) throw new Error(`${MCP_PATH} mcpServers must be a JSON object.`);
  if (!Object.hasOwn(config.mcpServers ?? {}, serverName)) return { exists: false, digest: null, fragment: null };
  const fragment = config.mcpServers[serverName];
  return { exists: true, digest: semanticDigest(fragment), fragment };
}
function paperSearchMcpFragmentState(config) {
  return namedMcpFragmentState(config, PAPER_SEARCH_MCP_SERVER_NAME);
}
function fragmentState(resource, value) {
  if (resource.selector === SETTINGS_SELECTOR) {
    const prompt = hookFragmentState(value, "UserPromptSubmit");
    const stop = hookFragmentState(value, "Stop");
    if (!prompt.exists) return { exists: false, digest: null, index: -1, fragment: null };
    if (!stop.exists) return prompt;
    const fragment = { UserPromptSubmit: prompt.fragment, Stop: stop.fragment };
    return { exists: true, digest: semanticDigest(fragment), index: -1, fragment };
  }
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) return paperSearchMcpFragmentState(value);
  throw new Error(`Unsupported Dove project integration selector: ${resource.selector}.`);
}
function removeFragment(resource, value, current) {
  if (resource.selector === SETTINGS_SELECTOR) {
    let next = value;
    for (const eventName of ["UserPromptSubmit", "Stop"]) {
      const state2 = hookFragmentState(next, eventName);
      if (!state2.exists) continue;
      next = { ...next, hooks: { ...next.hooks, [eventName]: next.hooks[eventName].filter((_, index) => index !== state2.index) } };
    }
    return next;
  }
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) {
    const servers = { ...value.mcpServers };
    delete servers[PAPER_SEARCH_MCP_SERVER_NAME];
    return { ...value, mcpServers: servers };
  }
  throw new Error(`Unsupported Dove project integration selector: ${resource.selector}.`);
}
function emptySharedJsonShell(resource, value) {
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) {
    return Object.keys(value).length === 1 && plainObject4(value.mcpServers) && Object.keys(value.mcpServers).length === 0;
  }
  return false;
}
function driftError(resource, currentDigest) {
  return new Error(`Dove project integration ownership drift at ${resource.path}${resource.selector ? `#${resource.selector}` : ""}; current digest ${currentDigest ?? "absent"} matches neither the manifest nor the expected resource.`);
}
function conflictError(resource) {
  return new Error(`Dove project integration cannot claim conflicting content at ${resource.path}${resource.selector ? `#${resource.selector}` : ""}.`);
}
function planExclusive(root, desired, oldEntry, fsOps) {
  const resource = desired ?? oldEntry;
  const observed = inspectRegularProjectFile(root, resource.path, fsOps);
  if (!oldEntry) {
    if (!observed.exists) return { entry: transactionWrite(root, desired, desired.content, observed), changed: true };
    if (observed.digest === desired.digest) return { entry: null, changed: false };
    throw conflictError(desired);
  }
  if (desired) {
    if (!observed.exists) return { entry: transactionWrite(root, desired, desired.content, observed), changed: true };
    if (observed.digest !== oldEntry.digest && observed.digest !== desired.digest) throw driftError(resource, observed.digest);
    if (observed.digest === desired.digest) return { entry: null, changed: oldEntry.digest !== desired.digest };
    return { entry: transactionWrite(root, desired, desired.content, observed), changed: true };
  }
  if (!observed.exists) return { entry: null, changed: true };
  if (observed.digest !== oldEntry.digest) throw driftError(resource, observed.digest);
  return { entry: transactionDelete(root, resource, observed), changed: true };
}
function addFragment(resource, value) {
  if (resource.selector === SETTINGS_SELECTOR) return mergeClaudeAmbientSettings(value).settings;
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) {
    return {
      ...value,
      mcpServers: {
        ...value.mcpServers ?? {},
        [PAPER_SEARCH_MCP_SERVER_NAME]: resource.fragment
      }
    };
  }
  throw new Error(`Dove does not install unsupported project-local fragment ${resource.path}#${resource.selector}.`);
}
function planJsonFragments(root, relativePath, desiredEntries, oldEntries, fsOps) {
  const observed = inspectRegularProjectFile(root, relativePath, fsOps);
  const original = parseSharedJson(observed, relativePath);
  const desiredByKey = new Map(desiredEntries.map((entry) => [managedKey2(entry), entry]));
  const oldByKey = new Map(oldEntries.map((entry) => [managedKey2(entry), entry]));
  let next = original;
  let changed = false;
  for (const key of [.../* @__PURE__ */ new Set([...oldByKey.keys(), ...desiredByKey.keys()])].sort()) {
    const desired = desiredByKey.get(key) ?? null;
    const oldEntry = oldByKey.get(key) ?? null;
    const resource2 = desired ?? oldEntry;
    const current = fragmentState(resource2, next);
    if (!oldEntry) {
      if (current.exists && current.digest === desired.digest) continue;
      if (current.exists) throw conflictError(desired);
      next = addFragment(desired, next);
      changed = true;
      continue;
    }
    if (desired) {
      if (!current.exists) {
        next = addFragment(desired, next);
        changed = true;
        continue;
      }
      if (current.digest !== oldEntry.digest && current.digest !== desired.digest) throw driftError(resource2, current.digest);
      if (current.digest === desired.digest) {
        if (oldEntry.digest !== desired.digest) changed = true;
        continue;
      }
      next = addFragment(desired, removeFragment(desired, next, current));
      changed = true;
      continue;
    }
    if (!current.exists) {
      changed = true;
      continue;
    }
    if (current.digest !== oldEntry.digest) throw driftError(resource2, current.digest);
    next = removeFragment(resource2, next, current);
    changed = true;
  }
  if (canonicalJson(next) === canonicalJson(original)) return { entry: null, changed };
  const resource = desiredEntries[0] ?? oldEntries[0];
  return {
    entry: emptySharedJsonShell(resource, next) ? transactionDelete(root, resource, observed) : transactionWrite(root, resource, serializeSharedJson(next), observed),
    changed: true
  };
}
function planResource(root, desired, oldEntry, fsOps) {
  const kind = desired?.kind ?? oldEntry.kind;
  if (kind === "exclusive-file") return planExclusive(root, desired, oldEntry, fsOps);
  throw new Error(`Unsupported project integration resource kind: ${kind}.`);
}
function desiredManaged(resources) {
  return resources.map(({ path: relativePath, kind, selector, digest }) => ({ path: relativePath, kind, selector, digest })).sort(compareManaged2);
}
function preparePlan({ root, hosts, packageName, packageVersion, now, fsOps, manifest = null }) {
  const desiredResources = resourcesForHosts(hosts);
  const desiredByKey = new Map(desiredResources.map((entry) => [managedKey2(entry), entry]));
  const oldByKey = new Map((manifest?.managed ?? []).map((entry) => [managedKey2(entry), entry]));
  const entries = [];
  let resourcesChanged = false;
  const sharedPaths = [.../* @__PURE__ */ new Set([
    ...desiredResources.filter((entry) => entry.kind === "json-fragment").map((entry) => entry.path),
    ...(manifest?.managed ?? []).filter((entry) => entry.kind === "json-fragment").map((entry) => entry.path)
  ])].sort();
  for (const relativePath of sharedPaths) {
    const planned = planJsonFragments(
      root,
      relativePath,
      desiredResources.filter((entry) => entry.kind === "json-fragment" && entry.path === relativePath),
      (manifest?.managed ?? []).filter((entry) => entry.kind === "json-fragment" && entry.path === relativePath),
      fsOps
    );
    if (planned.entry) entries.push(planned.entry);
    if (planned.changed) resourcesChanged = true;
  }
  const keys = [.../* @__PURE__ */ new Set([...oldByKey.keys(), ...desiredByKey.keys()])].filter((key) => (desiredByKey.get(key) ?? oldByKey.get(key)).kind !== "json-fragment").sort();
  for (const key of keys) {
    const planned = planResource(root, desiredByKey.get(key) ?? null, oldByKey.get(key) ?? null, fsOps);
    if (planned.entry) entries.push(planned.entry);
    if (planned.changed) resourcesChanged = true;
  }
  const managed = desiredManaged(desiredResources);
  const packageInfo = { name: packageName, version: packageVersion };
  const manifestChanged = manifest === null || resourcesChanged || !sameArray(manifest.hosts, hosts) || !samePackage(manifest.package, packageInfo) || !sameManaged(manifest.managed, managed);
  const nextManifest = manifestChanged ? createProjectInstallationManifest({
    package: packageInfo,
    hosts,
    managed,
    createdAt: manifest?.createdAt ?? now,
    updatedAt: now
  }, { hostIds: PROJECT_HOST_IDS2 }) : manifest;
  if (manifestChanged) {
    const observed = inspectRegularProjectFile(root, INSTALLATION_MANIFEST_PATH, fsOps);
    entries.push(transactionWrite(root, { path: INSTALLATION_MANIFEST_PATH }, serializeProjectInstallationManifest(nextManifest, { hostIds: PROJECT_HOST_IDS2 }), observed));
  }
  return { entries, manifest: nextManifest, manifestChanged };
}
function resultFromTransaction(status, target, hosts, manifest, transaction) {
  return {
    status,
    target,
    hosts: [...hosts],
    writtenPaths: [...transaction.writtenPaths],
    removedPaths: [...transaction.removedPaths],
    changedPaths: [...transaction.changedPaths],
    cleanupWarnings: [...transaction.cleanupWarnings],
    omittedCleanupWarningCount: transaction.omittedCleanupWarningCount,
    manifest
  };
}
function appendResearchDefaults(root, entries, options = {}) {
  const prepared = prepareResearchDefaults(root, {
    fsOps: options.fsOps,
    mode: options.mode ?? "sync",
    migrateRetiredLessons: options.migrateRetiredLessons,
    label: options.label
  });
  const existingTargets = new Set(entries.map((entry) => entry.relativePath));
  for (const entry of prepared.entries) {
    if (!existingTargets.has(entry.relativePath)) entries.push(entry);
  }
  return prepared;
}
function transactionOptions(fsOps, options = {}) {
  return { ...options, fsOps };
}
function initializeProjectIntegration(rootOrProject, options = {}) {
  const fsOps = options.fsOps ?? fs10;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const hosts = normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: true });
  const now = exactTimestamp2(options.now);
  const root = resolveProjectRootForInit(rootOrProject, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const plan = preparePlan({ root, hosts, packageName: options.packageName, packageVersion: options.packageVersion, now, fsOps });
  const researchDefaults = appendResearchDefaults(root, plan.entries, { fsOps, label: "Dove research bootstrap" });
  return resultFromTransaction(
    "initialized",
    root,
    hosts,
    plan.manifest,
    writeFileSetTransaction(plan.entries, transactionOptions(fsOps))
  );
}
function prepareInstalledPlan(start, options = {}) {
  const fsOps = options.fsOps ?? fs10;
  const root = resolveInstalledProjectRoot(start, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const manifest = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const hosts = options.hosts === void 0 ? [...manifest.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const packageName = options.packageName ?? manifest.package.name;
  const packageVersion = options.packageVersion ?? manifest.package.version;
  assertPackageInput(packageName, packageVersion, { required: true });
  const plan = preparePlan({ root, hosts, packageName, packageVersion, now: exactTimestamp2(options.now), fsOps, manifest });
  const researchDefaults = appendResearchDefaults(root, plan.entries, { fsOps, label: "Dove research defaults sync" });
  return { fsOps, root, hosts, currentManifest: manifest, researchDefaults, ...plan };
}
function synchronizeProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, options);
  const transaction = writeFileSetTransaction(
    prepared.entries,
    transactionOptions(prepared.fsOps)
  );
  return resultFromTransaction(transaction.changedPaths.length === 0 ? "unchanged" : "synchronized", prepared.root, prepared.hosts, prepared.manifest, transaction);
}
function inspectProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, options);
  const writtenPaths = prepared.entries.filter((entry) => entry.delete !== true).map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  return {
    status: prepared.entries.length === 0 ? "current" : "needs-sync",
    target: prepared.root,
    hosts: [...prepared.hosts],
    writtenPaths,
    removedPaths,
    changedPaths: prepared.entries.map((entry) => entry.relativePath),
    manifest: prepared.currentManifest
  };
}
function canonicalLifecycleRoot(start, fsOps) {
  const resolved = path10.resolve(start ?? process.cwd());
  const stat = fsOps.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove lifecycle project root must be a real directory: ${resolved}.`);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}
function walkDeletion(root, relativePath, fsOps, entries, scope, preservePaths = /* @__PURE__ */ new Set()) {
  const absolutePath = path10.join(root, relativePath);
  const stat = lstatOrNull3(fsOps, absolutePath);
  if (stat === null) return;
  if (stat.isSymbolicLink()) throw new Error(`Dove lifecycle refuses symbolic links in destructive scope: ${relativePath}.`);
  if (stat.isFile()) {
    if (preservePaths.has(relativePath)) return;
    const observed = inspectRegularProjectFile(root, relativePath, fsOps);
    entries.push(transactionDelete(root, { path: relativePath }, observed));
    scope.push({ path: relativePath, kind: "file", digest: observed.digest });
    return;
  }
  if (!stat.isDirectory()) throw new Error(`Dove lifecycle found unsupported project state: ${relativePath}.`);
  for (const child of fsOps.readdirSync(absolutePath).map(String).sort()) {
    walkDeletion(root, path10.posix.join(relativePath, child), fsOps, entries, scope, preservePaths);
  }
  if (preservePaths.has(relativePath)) return;
  entries.push({
    root,
    relativePath,
    delete: true,
    deleteEmptyDirectory: true,
    force: true,
    expectedState: { exists: true, type: "directory", sha256: null, mode: stat.mode & 4095 },
    label: `Dove lifecycle directory deletion ${relativePath}`
  });
  scope.push({ path: relativePath, kind: "directory", digest: null });
}
function migrationSource(root, fsOps) {
  const current = lstatOrNull3(fsOps, path10.join(root, INSTALLATION_MANIFEST_PATH));
  const legacy = lstatOrNull3(fsOps, path10.join(root, LEGACY_INSTALLATION_MANIFEST_PATH));
  if (current !== null && legacy !== null) throw new Error("Dove project update found both current and 1.0 project installation manifests.");
  if (current !== null) return readProjectInstallationManifestForMigration(root, { fsOps, hostIds: PROJECT_HOST_IDS2, manifestPath: INSTALLATION_MANIFEST_PATH });
  if (legacy !== null) return readProjectInstallationManifestForMigration(root, { fsOps, hostIds: PROJECT_HOST_IDS2, manifestPath: LEGACY_INSTALLATION_MANIFEST_PATH });
  throw new Error("Dove project update requires an installation revision 1.0 manifest.");
}
function prepareLifecycleIntegration(root, options, { hosts, source = null, reinstall = false }) {
  const fsOps = options.fsOps ?? fs10;
  const entries = [];
  const scope = [];
  const oldManifest = source ? { ...source, managed: source.managed } : null;
  const planned = preparePlan({
    root,
    hosts,
    packageName: options.packageName,
    packageVersion: options.packageVersion,
    now: exactTimestamp2(options.now),
    fsOps,
    manifest: oldManifest
  });
  const existingPaths = new Set(entries.map((entry) => entry.relativePath));
  for (const entry of planned.entries) {
    if (existingPaths.has(entry.relativePath)) continue;
    existingPaths.add(entry.relativePath);
    entries.push(entry);
  }
  let researchDefaults = null;
  if (reinstall) {
    const preservedResearchPaths = /* @__PURE__ */ new Set([
      ...RESEARCH_DEFAULT_DIRECTORY_PATHS,
      ...RESEARCH_DEFAULT_FILE_PATHS
    ]);
    const doveRoot = path10.join(root, ".dove");
    const doveStat = lstatOrNull3(fsOps, doveRoot);
    if (doveStat !== null) {
      if (doveStat.isSymbolicLink() || !doveStat.isDirectory()) throw new Error("Complete Reinstall requires .dove to be a real directory.");
      for (const child of fsOps.readdirSync(doveRoot).map(String).sort()) {
        if (child !== "install") walkDeletion(root, `.dove/${child}`, fsOps, entries, scope, preservedResearchPaths);
      }
      const installRoot = path10.join(doveRoot, "install");
      const installStat = lstatOrNull3(fsOps, installRoot);
      if (installStat !== null) {
        if (installStat.isSymbolicLink() || !installStat.isDirectory()) throw new Error("Complete Reinstall requires .dove/install to be a real directory.");
        for (const child of fsOps.readdirSync(installRoot).map(String).sort()) {
          if (child !== "manifest.json") walkDeletion(root, `.dove/install/${child}`, fsOps, entries, scope);
        }
      }
    }
    walkDeletion(root, ".dove-archive", fsOps, entries, scope);
    walkDeletion(root, ".dove-install", fsOps, entries, scope);
    researchDefaults = appendResearchDefaults(root, entries, {
      fsOps,
      mode: "replace",
      migrateRetiredLessons: false,
      label: "Dove Complete Reinstall research bootstrap"
    });
  } else if (source?.sourcePath === LEGACY_INSTALLATION_MANIFEST_PATH) {
    const legacyDirectory = lstatOrNull3(fsOps, path10.join(root, ".dove-install"));
    if (legacyDirectory?.isSymbolicLink() || legacyDirectory !== null && !legacyDirectory.isDirectory()) {
      throw new Error("Updating Dove project integration requires .dove-install to be a real directory.");
    }
    const legacyObserved = inspectRegularProjectFile(root, LEGACY_INSTALLATION_MANIFEST_PATH, fsOps);
    entries.push(transactionDelete(root, { path: LEGACY_INSTALLATION_MANIFEST_PATH }, legacyObserved));
    const legacyChildren = legacyDirectory === null ? [] : fsOps.readdirSync(path10.join(root, ".dove-install")).map(String).sort();
    if (sameArray(legacyChildren, ["manifest.json"])) {
      entries.push({
        root,
        relativePath: ".dove-install",
        delete: true,
        deleteEmptyDirectory: true,
        force: true,
        expectedState: { exists: true, type: "directory", sha256: null, mode: legacyDirectory.mode & 4095 },
        label: "Dove 1.0 installation directory cleanup"
      });
    }
  }
  if (!reinstall) {
    researchDefaults = appendResearchDefaults(root, entries, {
      fsOps,
      label: "Dove research defaults update"
    });
  }
  return { entries, manifest: planned.manifest, scope, researchDefaults };
}
function previewShape(kind, root, hosts, prepared, confirmationRequired) {
  const writtenEntries = prepared.entries.filter((entry) => entry.delete !== true);
  const writtenPaths = writtenEntries.map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  const defaultResearchPaths = new Set(RESEARCH_DEFAULT_FILE_PATHS);
  const replacedPaths = writtenEntries.filter((entry) => entry.expectedState?.exists === true && defaultResearchPaths.has(entry.relativePath)).map((entry) => entry.relativePath);
  return {
    status: "ready",
    action: kind,
    target: root,
    hosts: [...hosts],
    writtenPaths,
    removedPaths,
    changedPaths: [.../* @__PURE__ */ new Set([...writtenPaths, ...removedPaths])],
    destructiveScope: prepared.scope,
    ...kind === "reinstall" ? { replacedPaths } : {},
    confirmation: { required: confirmationRequired, default: false },
    manifest: prepared.manifest
  };
}
function upgradeProjectIntegration(start, options = {}) {
  const fsOps = options.fsOps ?? fs10;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  const source = migrationSource(root, fsOps);
  const hosts = options.hosts === void 0 ? [...source.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source, reinstall: false });
  return resultFromTransaction(
    "upgraded",
    root,
    hosts,
    prepared.manifest,
    writeFileSetTransaction(prepared.entries, transactionOptions(fsOps, prepared.researchDefaults))
  );
}
function previewProjectCompleteReinstall(start, options = {}) {
  const fsOps = options.fsOps ?? fs10;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  let source = null;
  try {
    source = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  } catch {
    try {
      source = migrationSource(root, fsOps);
    } catch {
      source = null;
    }
  }
  const hosts = options.hosts === void 0 ? [...source?.hosts ?? [CLAUDE_HOST]] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source, reinstall: true });
  return previewShape("reinstall", root, hosts, prepared, true);
}
function completeReinstallProjectIntegration(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Complete Reinstall requires confirmed: true after displaying the real destructive scope.");
  const fsOps = options.fsOps ?? fs10;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  let source = null;
  try {
    source = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  } catch {
    try {
      source = migrationSource(root, fsOps);
    } catch {
      source = null;
    }
  }
  const hosts = options.hosts === void 0 ? [...source?.hosts ?? [CLAUDE_HOST]] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source, reinstall: true });
  return resultFromTransaction(
    "reinstalled",
    root,
    hosts,
    prepared.manifest,
    writeFileSetTransaction(
      prepared.entries,
      transactionOptions(fsOps, {
        transactionBase: ".dove-transaction"
      })
    )
  );
}
function updateProjectIntegration(start, options = {}) {
  return synchronizeProjectIntegration(start, options);
}
var PROJECT_INTEGRATION_MANAGED_PATHS = Object.freeze(claudeResources().map((resource) => resource.path).sort());

// src/core/dove-lifecycle.mjs
function publicUpdateResult(result) {
  return {
    ...result,
    status: result.status === "unchanged" ? "unchanged" : "updated"
  };
}
function upgradeDoveLifecycle(start, options = {}) {
  return upgradeProjectIntegration(start, options);
}
function updateDoveLifecycle(start, options = {}) {
  try {
    return publicUpdateResult(updateProjectIntegration(start, options));
  } catch (currentError) {
    try {
      return publicUpdateResult(upgradeDoveLifecycle(start, options));
    } catch (migrationError) {
      throw new Error(
        `Dove update requires a current installation manifest or an explicit 1.0 manifest: ${migrationError instanceof Error ? migrationError.message : String(migrationError)}`,
        { cause: currentError }
      );
    }
  }
}
function completeReinstallDoveLifecycle(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Complete Reinstall requires confirmed: true.");
  return completeReinstallProjectIntegration(start, options);
}

// src/core/project-doctor.mjs
import fs11 from "node:fs";
import path11 from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";

// src/core/project-setup-classification.mjs
var ACTIONS = Object.freeze({
  init: Object.freeze(["init", "exit"]),
  update: Object.freeze(["update", "exit"]),
  updateOrReinstall: Object.freeze(["update", "reinstall", "exit"]),
  reinstall: Object.freeze(["reinstall", "exit"]),
  blocked: Object.freeze(["exit"])
});
function setup(mode, reason, actions = mode) {
  return Object.freeze({ mode, reason, allowedActions: ACTIONS[actions] });
}
function classifyProjectSetup(result) {
  const integration = result?.projectIntegration ?? {};
  const migration = result?.migrationInstallation ?? { state: "absent" };
  const workspace = result?.workspaceState ?? { mode: "unavailable", healthy: false };
  if (migration.state === "conflicting-manifests") return setup("reinstall", "conflicting-manifests");
  if (migration.state === "valid-legacy") return setup("update", "valid-legacy", "updateOrReinstall");
  if (migration.state === "invalid-legacy") return setup("reinstall", "invalid-legacy");
  if (["invalid", "drifted"].includes(integration.state)) return setup("blocked", integration.state);
  if (integration.state === "needs-sync") return setup("update", "needs-sync", "updateOrReinstall");
  if (integration.state === "current") return setup("reinstall", "current");
  if (workspace.mode !== "absent") return setup("reinstall", "unsupported-workspace");
  return setup("init", "clean-uninitialized");
}

// src/core/project-doctor.mjs
var MODULE_DIRECTORY = path11.dirname(fileURLToPath3(import.meta.url));
var DEFAULT_PACKAGE_ROOT = path11.resolve(MODULE_DIRECTORY, "../..");
function messageFor2(error) {
  return error instanceof Error ? error.message : String(error);
}
function plainObject5(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function lstatOrNull4(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function regularNonSymlink(fsOps, targetPath) {
  const stat = lstatOrNull4(fsOps, targetPath);
  return stat !== null && stat.isFile() && !stat.isSymbolicLink();
}
function inspectUserCli(options) {
  const fsOps = options.fsOps ?? fs11;
  const packageRoot = path11.resolve(options.packageRoot ?? DEFAULT_PACKAGE_ROOT);
  const runtimePaths = (options.packageRuntimePaths ?? PACKAGE_RUNTIME_PATHS).map((relativePath) => {
    const absolutePath = path11.resolve(packageRoot, relativePath);
    const relative = path11.relative(packageRoot, absolutePath);
    const contained = relative !== "" && !relative.startsWith("..") && !path11.isAbsolute(relative);
    const healthy2 = contained && regularNonSymlink(fsOps, absolutePath);
    return { path: relativePath, healthy: healthy2, state: healthy2 ? "current" : contained ? "missing-or-invalid" : "outside-package-root" };
  });
  const executablePath = path11.resolve(options.executablePath ?? path11.join(packageRoot, "bin/dove-package.mjs"));
  const executableRelative = path11.relative(packageRoot, executablePath);
  const executableContained = executableRelative === "" || !executableRelative.startsWith("..") && !path11.isAbsolute(executableRelative);
  const executableHealthy = executableContained && regularNonSymlink(fsOps, executablePath);
  const executable = { path: executablePath, healthy: executableHealthy, state: executableHealthy ? "current" : "missing-or-invalid" };
  const healthy = runtimePaths.every((entry) => entry.healthy) && executable.healthy;
  return {
    healthy,
    state: healthy ? "healthy" : "unhealthy",
    package: { name: options.packageName ?? null, version: options.packageVersion ?? null, root: packageRoot },
    runtimePaths,
    executable,
    missing: runtimePaths.filter((entry) => !entry.healthy).map((entry) => entry.path)
  };
}
function manifestSummary(manifest) {
  return manifest ? {
    path: INSTALLATION_MANIFEST_PATH,
    revision: manifest.revision,
    package: manifest.package,
    runtime: manifest.runtime,
    hosts: [...manifest.hosts]
  } : null;
}
function inspectIntegration(start, options) {
  const project = inspectProjectRoot(start, { fsOps: options.fsOps, hostIds: PROJECT_HOST_IDS2 });
  if (!project.initialized) return { healthy: false, state: project.state, start: project.start, root: project.root, error: project.error, manifest: null, missing: [], drifted: [] };
  try {
    const manifest = readProjectInstallationManifest(project.root, { fsOps: options.fsOps, hostIds: PROJECT_HOST_IDS2 });
    if (options.packageName !== void 0 && options.packageVersion !== void 0) {
      const compatibility = classifyPackageCompatibility(manifest.package, { name: options.packageName, version: options.packageVersion });
      if (["identity-mismatch", "newer", "invalid-version"].includes(compatibility)) {
        return { healthy: false, state: "invalid", start: project.start, root: project.root, error: "Dove project integration package is incompatible with the running CLI.", manifest: manifestSummary(manifest), packageCompatibility: compatibility, missing: [], drifted: [] };
      }
    }
    const canonical = (options.inspectCurrentIntegration ?? inspectProjectIntegration)(project.root, {
      packageName: options.packageName ?? manifest.package.name,
      packageVersion: options.packageVersion ?? manifest.package.version,
      fsOps: options.fsOps
    });
    return {
      healthy: canonical.status === "current",
      state: canonical.status,
      start: project.start,
      root: project.root,
      error: null,
      manifest: manifestSummary(manifest),
      needsSync: canonical.status === "needs-sync",
      syncPaths: [...canonical.changedPaths],
      missing: [],
      drifted: []
    };
  } catch (error) {
    const message = messageFor2(error);
    return {
      healthy: false,
      state: /ownership drift/iu.test(message) ? "drifted" : "invalid",
      start: project.start,
      root: project.root,
      error: message,
      manifest: null,
      missing: [],
      drifted: []
    };
  }
}
function inspectMigration(root, options) {
  const fsOps = options.fsOps ?? fs11;
  const current = lstatOrNull4(fsOps, path11.join(root, INSTALLATION_MANIFEST_PATH));
  const legacy = lstatOrNull4(fsOps, path11.join(root, LEGACY_INSTALLATION_MANIFEST_PATH));
  const migrationPath = legacy ? LEGACY_INSTALLATION_MANIFEST_PATH : current ? INSTALLATION_MANIFEST_PATH : null;
  const result = (state2, fields = {}) => ({ state: state2, root, markerPath: migrationPath, ...fields });
  if (current && legacy) return result("conflicting-manifests", { error: "Dove found both current and 1.0 installation manifests." });
  if (!legacy && !current) {
    const legacyDirectory = lstatOrNull4(fsOps, path11.join(root, ".dove-install"));
    return legacyDirectory ? result("invalid-legacy", { error: "Dove found an incomplete 1.0 installation directory." }) : result("absent", { error: null });
  }
  if (current) {
    try {
      readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
      return result("absent", { markerPath: null, error: null });
    } catch {
    }
  }
  try {
    const manifest = readProjectInstallationManifestForMigration(root, { fsOps, hostIds: PROJECT_HOST_IDS2, manifestPath: migrationPath });
    return result("valid-legacy", { error: null, manifest: { path: migrationPath, revision: manifest.revision, package: manifest.package, runtime: manifest.runtime, hosts: [...manifest.hosts] } });
  } catch (error) {
    return result("invalid-legacy", { error: messageFor2(error) });
  }
}
function researchState(root, options) {
  if (!root) return { healthy: false, state: "unavailable", mode: "unavailable", error: "Project root is unavailable." };
  try {
    const inspected = (options.inspectResearchDocuments ?? inspectResearchDocuments)(root, { fsOps: options.fsOps });
    if (!plainObject5(inspected)) throw new Error("Research document inspection returned an invalid result.");
    const mode = inspected.state === "absent" ? "absent" : inspected.state === "previous-research-format" ? "previous-research-format" : inspected.healthy === true ? "current" : "invalid";
    return { ...inspected, mode, healthy: inspected.healthy === true };
  } catch (error) {
    return { healthy: false, state: "invalid", mode: "invalid", error: messageFor2(error) };
  }
}
function actionsFor(result) {
  const actions = [];
  const upgradeReady = result.migrationInstallation.state === "valid-legacy";
  if (upgradeReady) actions.push({ kind: "update", command: "dove update" });
  if (!upgradeReady && result.workspaceState.state === "previous-research-format") actions.push({ kind: "export-research", command: "dove export-research" });
  else if (!upgradeReady && result.setup.mode === "init") actions.push({ kind: "init", command: "dove init" });
  else if (!upgradeReady && result.projectIntegration.state === "needs-sync") actions.push({ kind: "update", command: "dove update" });
  else if (!upgradeReady && result.setup.mode === "reinstall" && result.projectIntegration.state !== "current") actions.push({ kind: "reinstall", command: "dove reinstall" });
  else if (!upgradeReady && result.setup.mode === "blocked") actions.push({ kind: "inspect", command: "dove doctor --json" });
  return actions;
}
function inspectProjectDoctor(start, options = {}) {
  const userCli = inspectUserCli(options);
  let setupRoot = null;
  try {
    setupRoot = resolveProjectRootForSetup(start, { fsOps: options.fsOps });
  } catch {
    setupRoot = typeof start === "string" ? path11.resolve(start) : null;
  }
  const projectIntegration = inspectIntegration(start, options);
  const safeRoot = projectIntegration.root ?? setupRoot;
  const migrationInstallation = safeRoot ? inspectMigration(safeRoot, options) : { state: "absent", root: null, error: "Project root is unavailable." };
  const workspaceState = researchState(safeRoot, options);
  const setup2 = classifyProjectSetup({ projectIntegration, migrationInstallation, workspaceState });
  const ready = userCli.healthy && projectIntegration.healthy && workspaceState.healthy;
  const result = {
    ready,
    state: ready ? "ready" : "attention",
    target: safeRoot,
    userCli,
    projectIntegration,
    migrationInstallation,
    workspaceState,
    setup: setup2
  };
  result.actions = actionsFor(result);
  return result;
}
export {
  ARTIFACT_PATHS,
  COMMAND_SURFACES,
  COMMAND_SURFACE_BY_ID,
  DOVE_CLAUDE_STOP_HOOK_COMMAND,
  DOVE_PRIMARY_ROLES,
  HOST_ADAPTERS,
  HOST_ADAPTER_POLICY,
  PACKAGE_NAME,
  PACKAGE_VERSION,
  PAPER_SEARCH_MCP_FRAGMENT,
  PAPER_SEARCH_MCP_PATH,
  PAPER_SEARCH_MCP_SELECTOR,
  PAPER_SEARCH_MCP_SERVER_NAME,
  PAPER_SEARCH_PACKAGE_SPECIFIER,
  PAPER_SEARCH_SUPPORT_SKILL_PATH,
  PROJECT_HOST_IDS,
  RESEARCH_DEFAULT_DIRECTORY_PATHS,
  RESEARCH_DEFAULT_DOCUMENTS,
  RESEARCH_DEFAULT_FILE_PATHS,
  RESEARCH_DEFAULT_PATHS,
  RESEARCH_DOCUMENT_PATHS,
  RESEARCH_LESSON_TOPICS,
  USER_RESPONSE_POLICY,
  allGeneratedCommandAdapterPaths,
  ambientContextForPrompt,
  appendExactMarkdownBlocks,
  appendExactMarkdownLines,
  commandAdapterPathsForHost,
  completeReinstallDoveLifecycle,
  exportResearch,
  generatedRoleDefinitionEntries,
  initializeProjectIntegration,
  inspectProjectDoctor,
  inspectProjectIntegration,
  inspectResearchDocuments,
  isHighConfidenceAmbientWorkPrompt,
  planResearchDefaults,
  prepareResearchDefaults,
  previewProjectCompleteReinstall,
  previewResearchExport,
  readResearchDefaultsSnapshot,
  renderClaudeAmbientRule,
  renderClaudeAmbientSkill,
  renderClaudeReviewerAgent,
  renderOpenCodeReviewerAgent,
  renderOpenCodeRoleSkill,
  renderPaperSearchSupportSkill,
  researchDefaultTransactionEntries,
  stopHookOutput,
  updateDoveLifecycle,
  updateProjectIntegration,
  userPromptSubmitOutput
};

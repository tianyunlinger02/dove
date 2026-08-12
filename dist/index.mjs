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
  doctor: ".dove/install/doctor.json",
  doctorDocument: ".dove/install/DOCTOR.md",
  transactionsDir: ".dove/install/transactions",
  archiveDir: ".dove/archive",
  researchDocumentsDir: ".dove/research",
  researchOverview: ".dove/research/RESEARCH.md",
  researchLessons: ".dove/research/LESSONS.md"
});

// src/core/user-response-policy.mjs
var USER_RESPONSE_POLICY = Object.freeze([
  "Use natural, clear Chinese unless the user requests another language or format; explain internal terms only when needed.",
  "Before sending, reorganize from the user's perspective into a faithful synthesis. Do not use the internal workflow or structured machine data as the response outline; remove repetition and preserve material failures, limits, uncertainty, and blockers.",
  "Requested research artifacts and strict machine-readable contracts take priority; otherwise fit the response to the task, not a fixed template."
]);

// src/core/ambient-policy.mjs
var AMBIENT_CONTEXT = "Use hidden `dove-intake` for zero-write role and Skill routing. Clarify material ambiguity once; otherwise choose the smallest ambient-eligible Skill and continue with ordinary host work. Auto is explicit-only and cannot be selected here. Do not create a research document merely because routing occurred or invoke a closure callback.";
var LESSONS_CONTEXT = "Use hidden `dove-lessons-intake` for this explicit Lessons request. Read or maintain `.dove/research/LESSONS.md` as one complete advisory Markdown document. Create no unrelated research document.";
var LESSONS_NEGATION = /(?:\b(?:do not|don't|dont|never|no need to|without)\b.{0,32}\b(?:remember|save|record|update|read|show|review|reflect|retrospect|summari[sz]e)\b|(?:不要|别|无需|不用|不必|禁止|莫).{0,24}(?:记住|保存|记录|更新|读取|查看|复盘|反思|总结))/iu;
var LESSONS_UNCERTAIN = /^(?:maybe|perhaps|possibly|i wonder|not sure|could we maybe|we might|也许|可能|不确定|考虑一下|要不要)/iu;
var LESSONS_QUESTION = /(?:[?？]\s*$|^(?:can|could|would|will)\s+you\b|^(?:能否|可以|能不能|是否))/iu;
var LESSONS_META_EXAMPLE = /(?:\b(?:example|e\.g\.|say|phrase|quoted?|means?|translate|rewrite)\b|(?:例子|示例|比如|这句话|引号|翻译|改写))/iu;
var LESSONS_QUOTE = /["'“”‘’「」『』]/u;
var LESSONS_READ = /^(?:(?:read|show|open|display|review|recall)\b.{0,40}\b(?:lessons?|experience|what we learned)\b|(?:读取|查看|看看|打开|展示|回顾|调取).{0,24}(?:经验|教训|Lessons|经验文档)|(?:经验|教训|Lessons|经验文档).{0,12}(?:读一下|看一下|给我看|展示))/iu;
var LESSONS_REMEMBER = /^(?:(?:remember|save|record|preserve)\b.{0,24}\b(?:this|the|our|my)?\s*(?:lesson|experience|learning|preference|practice)\b|(?:记住|保存|记录|留存|沉淀).{0,24}(?:这|该|本次|我们的|我的)?(?:条)?(?:经验|教训|心得|偏好|做法))/iu;
var LESSONS_REFLECT = /^(?:(?:reflect|retrospect|do a retrospective|summari[sz]e)\b.{0,40}\b(?:experience|lessons?|what we learned|learnings?)\b|(?:复盘|反思|回顾并总结|总结).{0,24}(?:这次|本次|我们的|项目的)?(?:经验|教训|心得|做法))/iu;
var CONVERSATIONAL_ONLY = /* @__PURE__ */ new Set([
  "hi",
  "hello",
  "hey",
  "\u4F60\u597D",
  "\u60A8\u597D",
  "\u55E8",
  "thanks",
  "thank you",
  "\u8C22\u8C22",
  "\u591A\u8C22",
  "\u611F\u8C22",
  "ok",
  "okay",
  "got it",
  "sounds good",
  "\u597D\u7684",
  "\u660E\u767D",
  "\u6536\u5230",
  "\u540C\u610F",
  "\u6279\u51C6",
  "\u786E\u8BA4",
  "continue",
  "go on",
  "proceed",
  "\u7EE7\u7EED",
  "\u63A5\u7740\u6765",
  "\u4E0B\u4E00\u6B65"
]);
function conversationalText(prompt) {
  return prompt.normalize("NFKC").trim().toLowerCase().replace(/[!！,.，。?？\s]+$/gu, "");
}
function requestBody(prompt) {
  return prompt.normalize("NFKC").trim().replace(/^(?:please\s+|please can you\s+|can you\s+|could you\s+|would you\s+|will you\s+|i need you to\s+|i want you to\s+|请(?:你|您)?\s*|麻烦(?:你|您)?\s*|请帮(?:我|忙)\s*|帮我\s*|能否\s*|可以帮我\s*)/iu, "").trimStart();
}
function classifyLessonsIntent(prompt) {
  if (typeof prompt !== "string") return null;
  const normalized = prompt.normalize("NFKC").trim();
  if (!normalized || normalized.startsWith("/") || LESSONS_QUESTION.test(normalized)) return null;
  const body = requestBody(normalized);
  if (!body || LESSONS_NEGATION.test(body) || LESSONS_UNCERTAIN.test(body)) return null;
  if (LESSONS_META_EXAMPLE.test(body) || LESSONS_QUOTE.test(body)) return null;
  if (LESSONS_REMEMBER.test(body)) return "remember";
  if (LESSONS_REFLECT.test(body)) return "reflect";
  if (LESSONS_READ.test(body)) return "read";
  return null;
}
function isHighConfidenceAmbientWorkPrompt(prompt) {
  if (typeof prompt !== "string") return false;
  const normalized = prompt.normalize("NFKC").trim();
  if (!normalized || normalized.startsWith("/")) return false;
  return !CONVERSATIONAL_ONLY.has(conversationalText(normalized));
}
var DOVE_CLAUDE_SETTINGS_PATH = ".claude/settings.json";
var DOVE_CLAUDE_AMBIENT_RULE_PATH = ".claude/rules/dove.md";
var DOVE_CLAUDE_AMBIENT_SKILL_PATH = ".claude/skills/dove-intake/SKILL.md";
var DOVE_CLAUDE_LESSONS_SKILL_PATH = ".claude/skills/dove-lessons-intake/SKILL.md";
var DOVE_CLAUDE_AMBIENT_HOOK_COMMAND = 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"';
var DOVE_CLAUDE_AMBIENT_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([
    Object.freeze({
      type: "command",
      command: DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
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
function isExactManagedHook(value) {
  if (!sameKeys(value, ["hooks"]) || !Array.isArray(value.hooks) || value.hooks.length !== 1) return false;
  const hook = value.hooks[0];
  return sameKeys(hook, ["command", "timeout", "type"]) && hook.type === "command" && hook.command === DOVE_CLAUDE_AMBIENT_HOOK_COMMAND && hook.timeout === 10;
}
function referencesManagedHook(value) {
  if (!plainObject(value) || !Array.isArray(value.hooks)) return false;
  return value.hooks.some((hook) => plainObject(hook) && typeof hook.command === "string" && (hook.command.includes("dove hook user-prompt-submit") || hook.command.includes("dove-user-prompt-submit-package.mjs")));
}
function mergeClaudeAmbientSettings(settings) {
  if (!plainObject(settings)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} must contain a JSON object.`);
  if (settings.hooks !== void 0 && !plainObject(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  const hooks = settings.hooks ?? {};
  const promptHooks = hooks.UserPromptSubmit;
  if (promptHooks !== void 0 && !Array.isArray(promptHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.UserPromptSubmit must be an array.`);
  const entries = promptHooks ?? [];
  const exactEntries = entries.filter(isExactManagedHook);
  const conflictingEntries = entries.filter((entry) => referencesManagedHook(entry) && !isExactManagedHook(entry));
  if (exactEntries.length > 1 || conflictingEntries.length > 0) {
    throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} already defines a conflicting Dove-managed UserPromptSubmit hook.`);
  }
  if (exactEntries.length === 1) return { settings, changed: false };
  return {
    settings: {
      ...settings,
      hooks: {
        ...hooks,
        UserPromptSubmit: [...entries, DOVE_CLAUDE_AMBIENT_HOOK_ENTRY]
      }
    },
    changed: true
  };
}
function lessonsContextForPrompt(prompt) {
  return classifyLessonsIntent(prompt) === null ? null : LESSONS_CONTEXT;
}
function ambientContextForPrompt(prompt) {
  return isHighConfidenceAmbientWorkPrompt(prompt) ? AMBIENT_CONTEXT : null;
}
function renderClaudeAmbientRule() {
  return `# Dove ambient role and Skill routing

${USER_RESPONSE_POLICY.join("\n")}

Dove exposes 10 flat Skills: research, status, source, experiment, draft, figure, review, rebuttal, lessons, and auto. Auto is explicit-only; hidden intake cannot select it.

For selected non-slash prompts, apply the named hidden skill. Lessons requests use \`dove-lessons-intake\` and create no unrelated research document. Other work uses \`dove-intake\` for one conservative, zero-write choice among the nine ambient-eligible Skills: research, status, source, experiment, draft, figure, review, rebuttal, and lessons.

Ask one zero-write clarification round only for material ambiguity. Otherwise choose Planner, Builder/Author, or Reviewer responsibility and the smallest eligible Skill, then continue normal host work. Do not create a research document merely because routing occurred, emit a handoff, use private controls, invoke a closure callback, or route to Auto.

Carry the Research Constitution into host work: protect truth, safety, evidence integrity, long-term value, and claim scope; use real resources and existing assets; preserve failures and uncertainty; never equate host return, tests, local review, or internal audit with completion, independent review, or scientific authority.

Slash commands retain their explicit routing. Use host file and research tools directly; treat \`.dove/research/RESEARCH.md\` and linked Markdown as researcher-owned documents, not a database.
`;
}
function renderClaudeLessonsIntakeSkill() {
  return `---
name: dove-lessons-intake
description: Read, remember, or reflect on the advisory Dove Lessons Markdown without creating unrelated research documents.
user-invocable: false
---

# Dove Lessons ambient entry

Use this hidden skill only for the current non-slash Lessons prompt selected by the project hook.

1. Do not create unrelated research documents.
2. Use \`.dove/research/LESSONS.md\` as one complete, ordinary advisory Markdown document.
3. For a read request, read the document directly and present the relevant content. If it is absent, say so naturally without creating it.
4. For an explicit remember or save request, read the complete Markdown when present, preserve its useful structure, integrate conservatively, and write the complete updated document. If no structure exists, organize it naturally for the content.
5. For an explicit reflection, retrospective, or experience-summary request, first perform the requested reflection, then integrate only supported reusable guidance into the complete Lessons document.
6. Lessons are advisory only. They are not evidence, authority, completion proof, research artifacts, or scientific judgment. Preserve uncertainty and do not invent experience.
7. Use host file tools directly. Do not introduce IDs, an application ledger, a schema, a database, or a hidden state service.
`;
}
function renderClaudeAmbientSkill() {
  return `---
name: dove-intake
description: Enter a clear ordinary or research work request into Dove without requiring a slash command.
user-invocable: false
---

# Dove ambient entry

Use this hidden skill only for the current non-slash prompt selected by the project hook.

1. Route this selected non-slash prompt without reimplementing natural-language admission rules. The project hook already excludes empty, slash, and obvious pure-conversation prompts.
2. For material ambiguity in the goal, boundary, deliverable, or acceptance evidence, ask one concise zero-write clarification round. If the request remains unclear, explain that no work was started and stop.
3. Select the smallest ambient-eligible Skill: research, status, source, experiment, draft, figure, review, rebuttal, or lessons. Auto is explicit-only; never select it here. Use Planner for framing, Builder/Author for substantive work, and Reviewer only for a user-managed independent review exchange.
4. This routing is zero-write. Do not create a research document merely because a prompt was selected, and do not call any ambient-create, handoff, completion, Outcome, or closure surface.
5. Continue the original task with normal host behavior after routing. Draft, Figure, and Rebuttal produce ordinary project artifacts; they do not archive an Outcome.
6. Apply the Research Constitution proportionally: prioritize truth, safety, evidence integrity, and long-term value; use real resource facts and existing assets; preserve failed cases and uncertainty; keep claims within evidence; do not treat host return, tests, local review, or internal audit as completion, independent review, or scientific authority.
7. Use host file and research tools directly. When research context is useful, read \`.dove/research/RESEARCH.md\` and only the relevant linked documents. Do not introduce IDs, fixed schemas, a database, or a hidden state service.
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
  const additionalContext = lessonsContextForPrompt(payload.prompt) ?? ambientContextForPrompt(payload.prompt);
  if (additionalContext === null) return null;
  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext
    }
  };
}

// src/core/research-documents.mjs
import fs3 from "node:fs";
import path3 from "node:path";

// src/core/anchored-filesystem.mjs
import fs2 from "node:fs";
import path2 from "node:path";
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function normalizeRelativePath(relativePath, label = "Filesystem path") {
  if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error(`${label} must be a non-empty relative path.`);
  const normalized = path2.posix.normalize(relativePath.replace(/\\/gu, "/"));
  if (path2.isAbsolute(relativePath) || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) {
    throw new Error(`${label} must stay inside the anchored root: ${relativePath}`);
  }
  return normalized;
}
function requiredFunction(fsOps, name) {
  if (typeof fsOps?.[name] !== "function") throw new Error(`Anchored filesystem requires fsOps.${name}().`);
  return fsOps[name].bind(fsOps);
}
function realpathNative(fsOps, targetPath) {
  const realpath = requiredFunction(fsOps, "realpathSync");
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(targetPath) : realpath(targetPath);
}
function anchoredFilesystemCapability(options = {}) {
  const fsOps = options.fsOps ?? fs2;
  const platform = options.platform ?? process.platform;
  const procFdRoot = options.procFdRoot ?? "/proc/self/fd";
  if (platform !== "linux") return { supported: false, reason: "anchored writes require Linux" };
  const constants = fsOps.constants ?? fs2.constants;
  if (!Number.isInteger(constants?.O_DIRECTORY) || !Number.isInteger(constants?.O_NOFOLLOW)) {
    return { supported: false, reason: "anchored writes require O_DIRECTORY and O_NOFOLLOW" };
  }
  try {
    const stat = requiredFunction(fsOps, "statSync")(procFdRoot);
    if (!stat.isDirectory()) return { supported: false, reason: `${procFdRoot} is not a directory` };
  } catch (error) {
    return { supported: false, reason: `anchored writes require readable ${procFdRoot}: ${errorMessage(error)}` };
  }
  return { supported: true, reason: null, procFdRoot };
}
function requireAnchoredFilesystemCapability(options = {}) {
  const capability = anchoredFilesystemCapability(options);
  if (!capability.supported) throw new Error(`Anchored writes are unavailable: ${capability.reason}. Use a read-only operation on this platform.`);
  return capability;
}
var AnchoredFilesystem = class {
  constructor(root, options = {}) {
    this.fsOps = options.fsOps ?? fs2;
    this.constants = this.fsOps.constants ?? fs2.constants;
    this.procFdRoot = options.procFdRoot ?? "/proc/self/fd";
    requireAnchoredFilesystemCapability({ ...options, fsOps: this.fsOps, procFdRoot: this.procFdRoot });
    const openSync = requiredFunction(this.fsOps, "openSync");
    const resolvedRoot = path2.resolve(root);
    try {
      this.rootFd = openSync(resolvedRoot, this.constants.O_RDONLY | this.constants.O_DIRECTORY | this.constants.O_NOFOLLOW);
    } catch (error) {
      throw new Error(`Unable to anchor workspace root without following links: ${resolvedRoot}: ${errorMessage(error)}`, { cause: error });
    }
    this.rootHandlePath = path2.posix.join(this.procFdRoot, String(this.rootFd));
    try {
      this.root = realpathNative(this.fsOps, this.rootHandlePath);
    } catch (error) {
      this.close();
      throw new Error(`Unable to resolve anchored workspace root: ${errorMessage(error)}`, { cause: error });
    }
    this.closed = false;
  }
  assertOpen() {
    if (this.closed) throw new Error("Anchored filesystem is closed.");
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.rootFd !== void 0) requiredFunction(this.fsOps, "closeSync")(this.rootFd);
  }
  normalize(relativePath, label) {
    return normalizeRelativePath(relativePath, label);
  }
  displayPath(relativePath) {
    return path2.join(this.root, this.normalize(relativePath));
  }
  openDirectory(relativePath = null) {
    this.assertOpen();
    if (relativePath === null || relativePath === "" || relativePath === ".") {
      return { fd: this.rootFd, handlePath: this.rootHandlePath, relativePath: "", owned: false };
    }
    const normalized = this.normalize(relativePath, "Directory path");
    let currentFd = this.rootFd;
    let owned = false;
    let currentRelative = "";
    try {
      for (const component of normalized.split("/")) {
        const currentHandle = path2.posix.join(this.procFdRoot, String(currentFd));
        const candidate = path2.posix.join(currentHandle, component);
        const nextFd = requiredFunction(this.fsOps, "openSync")(candidate, this.constants.O_RDONLY | this.constants.O_DIRECTORY | this.constants.O_NOFOLLOW);
        if (owned) requiredFunction(this.fsOps, "closeSync")(currentFd);
        currentFd = nextFd;
        owned = true;
        currentRelative = currentRelative ? `${currentRelative}/${component}` : component;
      }
      return { fd: currentFd, handlePath: path2.posix.join(this.procFdRoot, String(currentFd)), relativePath: currentRelative, owned };
    } catch (error) {
      if (owned) requiredFunction(this.fsOps, "closeSync")(currentFd);
      throw error;
    }
  }
  closeDirectory(directory) {
    if (directory?.owned === true && directory.fd !== void 0) requiredFunction(this.fsOps, "closeSync")(directory.fd);
  }
  withParent(relativePath, callback) {
    const normalized = this.normalize(relativePath);
    const parentRelative = path2.posix.dirname(normalized);
    const parent = this.openDirectory(parentRelative === "." ? null : parentRelative);
    const name = path2.posix.basename(normalized);
    try {
      return callback({ normalized, parent, name, handlePath: path2.posix.join(parent.handlePath, name) });
    } finally {
      this.closeDirectory(parent);
    }
  }
  lstat(relativePath) {
    return this.withParent(relativePath, ({ handlePath }) => requiredFunction(this.fsOps, "lstatSync")(handlePath));
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
  openFile(relativePath, flags, mode) {
    return this.withParent(relativePath, ({ handlePath }) => requiredFunction(this.fsOps, "openSync")(handlePath, flags | this.constants.O_NOFOLLOW, mode));
  }
  inspectRegularFile(relativePath) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY | (this.constants.O_NONBLOCK ?? 0));
    try {
      const stat = requiredFunction(this.fsOps, "fstatSync")(fd);
      if (!stat.isFile()) throw new Error(`Anchored read target must be a regular file: ${relativePath}`);
      return stat;
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  readFile(relativePath) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY);
    try {
      const stat = requiredFunction(this.fsOps, "fstatSync")(fd);
      if (!stat.isFile()) throw new Error(`Anchored read target must be a regular file: ${relativePath}`);
      return Buffer.from(requiredFunction(this.fsOps, "readFileSync")(fd));
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  writeNewFile(relativePath, content, options = {}) {
    const mode = options.mode ?? 384;
    const fd = this.openFile(relativePath, this.constants.O_WRONLY | this.constants.O_CREAT | this.constants.O_EXCL, mode);
    try {
      requiredFunction(this.fsOps, "writeFileSync")(fd, content, options.encoding);
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  chmod(relativePath, mode) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY);
    try {
      requiredFunction(this.fsOps, "fchmodSync")(fd, mode);
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  mkdir(relativePath, options = {}) {
    const normalized = this.normalize(relativePath, "Directory path");
    if (options.recursive === true) {
      let current = "";
      for (const component of normalized.split("/")) {
        current = current ? `${current}/${component}` : component;
        const stat = this.tryLstat(current);
        if (stat) {
          if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Anchored directory component is not a real directory: ${current}`);
          continue;
        }
        this.mkdir(current, { mode: options.mode });
      }
      return;
    }
    this.withParent(normalized, ({ handlePath }) => requiredFunction(this.fsOps, "mkdirSync")(handlePath, { recursive: false, ...options.mode === void 0 ? {} : { mode: options.mode }, anchoredPath: normalized, displayPath: this.displayPath(normalized) }));
  }
  readdir(relativePath = null, options = {}) {
    const directory = this.openDirectory(relativePath);
    try {
      return requiredFunction(this.fsOps, "readdirSync")(directory.handlePath, options);
    } finally {
      this.closeDirectory(directory);
    }
  }
  rename(fromRelativePath, toRelativePath) {
    const from = this.normalize(fromRelativePath, "Rename source");
    const to = this.normalize(toRelativePath, "Rename destination");
    const fromParent = this.openDirectory(path2.posix.dirname(from) === "." ? null : path2.posix.dirname(from));
    const toParent = this.openDirectory(path2.posix.dirname(to) === "." ? null : path2.posix.dirname(to));
    try {
      const sourcePath = path2.posix.join(fromParent.handlePath, path2.posix.basename(from));
      const sourceStat = requiredFunction(this.fsOps, "lstatSync")(sourcePath);
      if (sourceStat.isSymbolicLink()) throw new Error(`Anchored rename source must not be a symbolic link: ${from}`);
      const destinationPath = path2.posix.join(toParent.handlePath, path2.posix.basename(to));
      try {
        const destinationStat = requiredFunction(this.fsOps, "lstatSync")(destinationPath);
        if (destinationStat.isSymbolicLink()) throw new Error(`Anchored rename destination must not be a symbolic link: ${to}`);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      requiredFunction(this.fsOps, "renameSync")(sourcePath, destinationPath, { anchoredFrom: from, anchoredTo: to, displayFrom: this.displayPath(from), displayTo: this.displayPath(to) });
    } finally {
      this.closeDirectory(toParent);
      this.closeDirectory(fromParent);
    }
  }
  unlink(relativePath, options = {}) {
    try {
      this.withParent(relativePath, ({ handlePath }) => {
        const stat = requiredFunction(this.fsOps, "lstatSync")(handlePath);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Anchored unlink target must be a regular file: ${relativePath}`);
        requiredFunction(this.fsOps, "unlinkSync")(handlePath, { anchoredPath: this.normalize(relativePath), displayPath: this.displayPath(relativePath) });
      });
    } catch (error) {
      if (options.force === true && error?.code === "ENOENT") return;
      throw error;
    }
  }
  rmdir(relativePath, options = {}) {
    try {
      const normalized = this.normalize(relativePath);
      this.withParent(normalized, ({ handlePath }) => requiredFunction(this.fsOps, "rmdirSync")(handlePath, { anchoredPath: normalized, displayPath: this.displayPath(normalized), recursiveCleanup: options.recursiveCleanup === true }));
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
      const error = new Error(`Anchored removal target does not exist: ${normalized}`);
      error.code = "ENOENT";
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Anchored removal target must not be a symbolic link: ${normalized}`);
    if (stat.isDirectory()) {
      if (options.recursive !== true) return this.rmdir(normalized);
      const directory = this.openDirectory(normalized);
      try {
        const entries = requiredFunction(this.fsOps, "readdirSync")(directory.handlePath, { withFileTypes: true });
        for (const entry of entries) {
          const childPath = `${normalized}/${entry.name}`;
          const childHandlePath = path2.posix.join(directory.handlePath, entry.name);
          const childStat = requiredFunction(this.fsOps, "lstatSync")(childHandlePath);
          if (childStat.isSymbolicLink()) throw new Error(`Anchored cleanup encountered a symbolic link: ${childPath}`);
          if (childStat.isDirectory()) this.remove(childPath, { recursive: true, force: false });
          else if (childStat.isFile()) this.unlink(childPath);
          else throw new Error(`Anchored cleanup encountered an unsupported path type: ${childPath}`);
        }
      } finally {
        this.closeDirectory(directory);
      }
      return this.rmdir(normalized, { force: options.force, recursiveCleanup: true });
    }
    if (stat.isFile()) return this.unlink(normalized, { force: options.force });
    throw new Error(`Anchored removal target has an unsupported path type: ${normalized}`);
  }
};
function openAnchoredFilesystem(root, options = {}) {
  return new AnchoredFilesystem(root, options);
}

// src/core/strict-json.mjs
function duplicateKeyError(label, key, path14) {
  throw new Error(`${label} must not contain duplicate JSON object keys: ${path14 === "$" ? key : `${path14}.${key}`}.`);
}
function parseJsonWithoutDuplicateKeys(text2, label = "JSON input") {
  if (typeof text2 !== "string") throw new Error(`${label} must contain valid JSON.`);
  let index = 0;
  function skipWhitespace() {
    while (/\s/u.test(text2[index] ?? "")) index += 1;
  }
  function parseString() {
    if (text2[index] !== '"') throw new Error(`${label} must contain valid JSON.`);
    const start = index;
    index += 1;
    let escaped = false;
    while (index < text2.length) {
      const character = text2[index];
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
        return JSON.parse(text2.slice(start, index));
      }
      if (character.charCodeAt(0) < 32) throw new Error(`${label} must contain valid JSON.`);
    }
    throw new Error(`${label} must contain valid JSON.`);
  }
  function parseNumber() {
    const match = text2.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u);
    if (!match) throw new Error(`${label} must contain valid JSON.`);
    index += match[0].length;
  }
  function parseArray(path14) {
    index += 1;
    skipWhitespace();
    if (text2[index] === "]") {
      index += 1;
      return;
    }
    let itemIndex = 0;
    while (true) {
      parseValue(`${path14}[${itemIndex}]`);
      itemIndex += 1;
      skipWhitespace();
      if (text2[index] === "]") {
        index += 1;
        return;
      }
      if (text2[index] !== ",") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      skipWhitespace();
    }
  }
  function parseObject(path14) {
    index += 1;
    skipWhitespace();
    if (text2[index] === "}") {
      index += 1;
      return;
    }
    const keys = /* @__PURE__ */ new Set();
    while (true) {
      const key = parseString();
      if (keys.has(key)) duplicateKeyError(label, key, path14);
      keys.add(key);
      skipWhitespace();
      if (text2[index] !== ":") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      parseValue(path14 === "$" ? `$.${key}` : `${path14}.${key}`);
      skipWhitespace();
      if (text2[index] === "}") {
        index += 1;
        return;
      }
      if (text2[index] !== ",") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      skipWhitespace();
    }
  }
  function parseValue(path14) {
    skipWhitespace();
    const character = text2[index];
    if (character === "{") parseObject(path14);
    else if (character === "[") parseArray(path14);
    else if (character === '"') parseString();
    else if (character === "-" || /\d/u.test(character ?? "")) parseNumber();
    else if (text2.startsWith("true", index)) index += 4;
    else if (text2.startsWith("false", index)) index += 5;
    else if (text2.startsWith("null", index)) index += 4;
    else throw new Error(`${label} must contain valid JSON.`);
    skipWhitespace();
  }
  try {
    parseValue("$");
    skipWhitespace();
    if (index !== text2.length) throw new Error(`${label} must contain valid JSON.`);
    return JSON.parse(text2);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${label} must not contain duplicate`)) throw error;
    throw new Error(`${label} must contain valid JSON.`);
  }
}

// src/core/research-documents.mjs
var V2_FORMAT_PATH = ".dove/format.json";
var V2_FORMAT = "dove-research-v2";
var RESEARCH_DOCUMENT_PATHS = Object.freeze({
  root: ARTIFACT_PATHS.researchDocumentsDir,
  overview: ARTIFACT_PATHS.researchOverview,
  lessons: ARTIFACT_PATHS.researchLessons,
  missions: `${ARTIFACT_PATHS.researchDocumentsDir}/missions`,
  experiments: `${ARTIFACT_PATHS.researchDocumentsDir}/experiments`,
  sources: `${ARTIFACT_PATHS.researchDocumentsDir}/sources`,
  reviews: `${ARTIFACT_PATHS.researchDocumentsDir}/reviews`,
  claims: `${ARTIFACT_PATHS.researchDocumentsDir}/claims`
});
function messageFor(error) {
  return error instanceof Error ? error.message : String(error);
}
function canonicalRoot(root, fsOps) {
  const resolved = path3.resolve(root);
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
function inspectResearchDocuments(root, options = {}) {
  const fsOps = options.fsOps ?? fs3;
  let anchor;
  try {
    anchor = openAnchoredFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
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
          return {
            healthy: true,
            state: "previous-research-format",
            root: RESEARCH_DOCUMENT_PATHS.root,
            overview: null,
            lessons: null,
            exportCommand: "dove export-research"
          };
        }
      }
      return {
        healthy: true,
        state: "absent",
        root: RESEARCH_DOCUMENT_PATHS.root,
        overview: null,
        lessons: null
      };
    }
    if (directory.isSymbolicLink() || !directory.isDirectory()) {
      throw new Error(`${RESEARCH_DOCUMENT_PATHS.root} must be a real directory.`);
    }
    const overview2 = readMarkdown(anchor, RESEARCH_DOCUMENT_PATHS.overview);
    const lessons = readMarkdown(anchor, RESEARCH_DOCUMENT_PATHS.lessons);
    return {
      healthy: true,
      state: "current",
      root: RESEARCH_DOCUMENT_PATHS.root,
      overview: overview2 === null ? null : { path: RESEARCH_DOCUMENT_PATHS.overview },
      lessons: lessons === null ? null : { path: RESEARCH_DOCUMENT_PATHS.lessons }
    };
  } catch (error) {
    return {
      healthy: false,
      state: "invalid",
      root: RESEARCH_DOCUMENT_PATHS.root,
      overview: null,
      lessons: null,
      error: messageFor(error)
    };
  } finally {
    anchor?.close();
  }
}

// src/core/research-export.mjs
import crypto2 from "node:crypto";
import fs5 from "node:fs";
import path5 from "node:path";

// src/core/file-set-transaction.mjs
import crypto from "node:crypto";
import fs4 from "node:fs";
import path4 from "node:path";
var MAX_CLEANUP_WARNINGS = 20;
var ENTRY_FIELDS = /* @__PURE__ */ new Set(["root", "relativePath", "content", "encoding", "force", "delete", "deleteEmptyDirectory", "expectedState", "label"]);
function errorMessage2(error) {
  return error instanceof Error ? error.message : String(error);
}
function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}
function state(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return { exists: false, type: "absent", sha256: null, mode: null };
  if (stat.isSymbolicLink()) return { exists: true, type: "symlink", sha256: null, mode: stat.mode & 4095 };
  if (stat.isDirectory()) return { exists: true, type: "directory", sha256: null, mode: stat.mode & 4095 };
  if (!stat.isFile()) return { exists: true, type: "other", sha256: null, mode: stat.mode & 4095 };
  return { exists: true, type: "file", sha256: sha256(anchor.readFile(relativePath)), mode: stat.mode & 4095 };
}
function sameState(left, right) {
  return left.exists === right.exists && left.type === right.type && left.sha256 === right.sha256 && left.mode === right.mode;
}
function expectedState(raw, index) {
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
  let current = path4.posix.dirname(relativePath);
  while (current !== ".") {
    directories.push(current);
    current = path4.posix.dirname(current);
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
  const scheduledChildren = new Set(resolved.filter((candidate) => candidate.anchor === entry.anchor && candidate.deleting && path4.posix.dirname(candidate.relativePath) === entry.relativePath).map((candidate) => path4.posix.basename(candidate.relativePath)));
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
  const fsOps = options.fsOps ?? fs4;
  const transactionId = (options.transactionId ?? crypto.randomUUID()).replace(/[^a-z0-9._-]/giu, "-");
  const anchors = /* @__PURE__ */ new Map();
  const resolved = [];
  const targets = /* @__PURE__ */ new Set();
  const transactions = /* @__PURE__ */ new Map();
  const promotions = [];
  const createdDirectories = /* @__PURE__ */ new Map();
  const anchorFor = (root) => {
    const canonicalRoot4 = typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(path4.resolve(root)) : fsOps.realpathSync(path4.resolve(root));
    if (!anchors.has(canonicalRoot4)) anchors.set(canonicalRoot4, openAnchoredFilesystem(canonicalRoot4, { fsOps, platform: options.platform, procFdRoot: options.procFdRoot }));
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
      const approvedState = expectedState(entry.expectedState, index);
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
      anchor.mkdir(`${transactionPath}/staged`);
      anchor.mkdir(`${transactionPath}/backups`);
      transactions.set(anchor, { transactionBase, transactionPath, transactionParents, stagedRoot: `${transactionPath}/staged`, backupRoot: `${transactionPath}/backups` });
      createdDirectories.set(anchor, []);
    }
    for (const [index, entry] of resolved.entries()) {
      if (entry.deleting) continue;
      const transaction = transactions.get(entry.anchor);
      entry.stagedPath = `${transaction.stagedRoot}/file-${index}`;
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
        cleanupFailures.push({ path: anchor.displayPath(transaction.transactionPath), reason: errorMessage2(cleanupError) });
      }
    }
    return committedResult(resolved, cleanupFailures);
  } catch (error) {
    const rollbackFailures = [];
    const attempt = (callback) => {
      try {
        callback();
      } catch (rollbackError) {
        rollbackFailures.push(errorMessage2(rollbackError));
      }
    };
    for (const promotion of [...promotions].reverse()) {
      const { entry } = promotion;
      if (promotion.promoted && entry.anchor.exists(entry.relativePath)) attempt(() => entry.anchor.remove(entry.relativePath, { force: true }));
      if (promotion.backupPath && entry.anchor.exists(promotion.backupPath)) attempt(() => entry.anchor.rename(promotion.backupPath, entry.relativePath));
    }
    for (const [anchor, directories] of createdDirectories) {
      for (const directoryPath of [...directories].sort((left, right) => right.length - left.length)) attempt(() => anchor.rmdir(directoryPath, { force: true }));
    }
    for (const [anchor, transaction] of transactions) {
      attempt(() => anchor.remove(transaction.transactionPath, { recursive: true, force: true }));
      attempt(() => removeNewTransactionParents(anchor, transaction));
    }
    if (rollbackFailures.length > 0) throw new Error(`Transactional write failed and rollback also failed: ${errorMessage2(error)}; rollback: ${rollbackFailures.join("; ")}`, { cause: error });
    throw new Error(`Transactional write failed and all staged changes were rolled back: ${errorMessage2(error)}`, { cause: error });
  } finally {
    for (const anchor of anchors.values()) anchor.close();
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
function canonicalRoot2(root, fsOps) {
  const resolved = path5.resolve(root);
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
  return { exists: true, type: "file", sha256: crypto2.createHash("sha256").update(anchor.readFile(relativePath)).digest("hex"), mode: stat.mode & 4095 };
}
function readRequired(anchor, relativePath) {
  const state2 = fileState(anchor, relativePath);
  if (!state2.exists || state2.type !== "file") throw new Error(`legacy JSON research export requires ${relativePath} as a regular file.`);
  return { relativePath, bytes: anchor.readFile(relativePath), state: state2 };
}
function strictJson(file) {
  let text2;
  try {
    text2 = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
  } catch (error) {
    throw new Error(`${file.relativePath} must contain valid UTF-8 JSON.`, { cause: error });
  }
  return parseJsonWithoutDuplicateKeys(text2, file.relativePath);
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
  if (path5.posix.basename(file.relativePath) !== expected) throw new Error(`${file.relativePath} does not match ${label} identifier ${expected}.`);
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
  return [...RECORD_DIRECTORY_PATHS].reverse().flatMap((relativePath) => {
    const state2 = fileState(anchor, relativePath);
    return state2.exists ? [{ relativePath, state: state2 }] : [];
  });
}
function valueText(value) {
  if (value === null || value === void 0 || value === "") return null;
  if (typeof value === "string") return value;
  if (["number", "boolean"].includes(typeof value)) return String(value);
  return `\`${JSON.stringify(value)}\``;
}
function section(title, value) {
  const text2 = valueText(value);
  return text2 === null ? "" : `
## ${title}

${text2}
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
  return path5.posix.relative(path5.posix.dirname(from), to);
}
function previewResearchExport(start, options = {}) {
  const fsOps = options.fsOps ?? fs5;
  const root = canonicalRoot2(start, fsOps);
  const anchor = openAnchoredFilesystem(root, { ...options, fsOps });
  try {
    const required = new Map(REQUIRED_FILES.map((relativePath) => [relativePath, readRequired(anchor, relativePath)]));
    const marker = strictJson(required.get(".dove/format.json"));
    if (!marker || marker.format !== V2_FORMAT2 || Object.keys(marker).length !== 1) throw new Error(`Research export accepts only an exact ${V2_FORMAT2} marker.`);
    const workspace = strictJson(required.get(".dove/workspace.json"));
    const lessonsBytes = required.get(".dove/LESSONS.md").bytes;
    new TextDecoder("utf-8", { fatal: true }).decode(lessonsBytes);
    const raw = Object.fromEntries(RECORD_DIRECTORIES.map(([directory, key]) => [key, listJson(anchor, `.dove/${directory}`).map((file) => ({ file, value: strictJson(file) }))]));
    validateV2Records(workspace, raw);
    const archiveStamp = timestamp(options.now);
    const archiveDirectory = `${ARCHIVE_ROOT}/research-format-v2-${archiveStamp}`;
    if (fileState(anchor, archiveDirectory).exists) throw new Error(`Research export archive already exists: ${archiveDirectory}.`);
    if (fileState(anchor, NEW_ROOT).exists) throw new Error(`${NEW_ROOT} already exists; review or move it before exporting legacy JSON research state.`);
    const used = /* @__PURE__ */ new Set();
    const documents = [];
    const links = [];
    const directions = [];
    const add = (directory, value, fallback, content, collection = links) => {
      const target = uniquePath(`${NEW_ROOT}/${directory}`, readableName(value, fallback), used);
      documents.push({ relativePath: target, content });
      collection.push({ label: readableName(value, fallback), link: relativeLink(`${NEW_ROOT}/RESEARCH.md`, target) });
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
    documents.unshift({ relativePath: `${NEW_ROOT}/LESSONS.md`, content: lessonsBytes });
    documents.unshift({ relativePath: `${NEW_ROOT}/RESEARCH.md`, content: overview(workspace, links, directions) });
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
        archiveFiles,
        sourceFiles: oldFiles.map((file) => ({ relativePath: file.relativePath, state: file.state })),
        sourceDirectories: oldDirectories
      }
    };
  } finally {
    anchor.close();
  }
}
function exportResearch(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Research export requires confirmed: true after preview.");
  const preview = previewResearchExport(start, options);
  const entries = [
    ...preview.plan.documents.map((entry) => ({ root: preview.target, relativePath: entry.relativePath, content: entry.content, force: false, expectedState: { exists: false, type: "absent", sha256: null, mode: null }, label: "Research Markdown export" })),
    ...preview.plan.archiveFiles.map((entry) => ({ root: preview.target, relativePath: entry.relativePath, content: entry.content, force: false, expectedState: { exists: false, type: "absent", sha256: null, mode: null }, label: "Legacy JSON research archive" })),
    ...preview.plan.sourceFiles.map((entry) => ({ root: preview.target, relativePath: entry.relativePath, delete: true, expectedState: entry.state, label: "Retired Dove legacy JSON research state" })),
    ...preview.plan.sourceDirectories.map((entry) => ({ root: preview.target, relativePath: entry.relativePath, delete: true, deleteEmptyDirectory: true, expectedState: entry.state, label: "Retired legacy JSON research directory" }))
  ];
  const result = writeFileSetTransaction(entries, { ...options, transactionBase: ".dove/install/transactions" });
  return { status: "exported", action: preview.action, target: preview.target, from: preview.from, to: preview.to, researchDirectory: preview.researchDirectory, archiveDirectory: preview.archiveDirectory, ...result };
}

// src/core/role-definitions.mjs
var ROLE_DEFINITIONS = Object.freeze({
  planner: Object.freeze({
    id: "planner",
    publicName: "Planner",
    title: "dove-planner",
    description: "Define a proportional research goal, scope, evidence needs, and stopping conditions.",
    responsibility: "Frame the user's request for the three primary roles: Planner, Builder/Author, and independent Reviewer.",
    inputs: Object.freeze([
      "The user's goal, constraints, supplied context, and desired deliverable",
      "The human-maintained research overview, relevant linked Markdown, and ordinary project artifacts when durable context exists",
      "Current external facts from visible bounded public search when they may affect the plan"
    ]),
    internalCompletionConditions: Object.freeze([
      "The goal and in-scope and out-of-scope boundaries are proportional and clear enough to guide execution",
      "Deliverables, dependencies, evidence needs, assumptions, blockers, and stopping conditions are identified only to the level needed for the work",
      "For research work, the real problem, key unknown or hypothesis, bounded approach, discriminating evidence, resource facts, and claim boundary are framed; ordinary work receives no invented research credit",
      "Builder/Author can proceed with substantive work, and any separate Reviewer exchange has a clear declared scope",
      "These are internal framing conditions, not a required transcript, template, or database record"
    ])
  }),
  builder: Object.freeze({
    id: "builder",
    publicName: "Builder/Author",
    title: "dove-builder",
    description: "Produce substantive research, code, writing, experiments, figures, revisions, and author-side rebuttal.",
    responsibility: "Perform the substantive work within the approved goal and scope as Builder/Author, distinct from Planner and independent Reviewer.",
    inputs: Object.freeze([
      "The approved goal, scope, deliverables, dependencies, and stopping conditions",
      "The research overview, relevant linked documents, supplied materials, and ordinary project artifacts",
      "Host tools, subagents, and visible external search when they materially advance the task"
    ]),
    internalCompletionConditions: Object.freeze([
      "The requested research, code, writing, experiment, figure, revision, or rebuttal artifact is produced from actual resources and existing assets",
      "Raw outputs, failure samples, denominator accounting, and appropriate validation remain available where they support interpretation, without unnecessary fallback or hidden post-processing",
      "Unsupported claims, citation gaps, integrity concerns, uncertainty, resource limits, and material scope changes are handled at the proper boundary; host return and passing tests are not independent acceptance",
      "When durable context is worthwhile, the relevant human-readable research document is updated without turning the work into a fixed entity, ID, or schema",
      "These are internal execution conditions, not a requirement to enumerate every log or internal step in the ordinary user response"
    ])
  }),
  reviewer: Object.freeze({
    id: "reviewer",
    publicName: "Reviewer",
    title: "dove-reviewer",
    description: "Assess one declared artifact scope and return a readable review without edits; this native role is a convenience definition, not evidence of independence or authority.",
    responsibility: "Act as Reviewer, separate in responsibility from Planner and Builder/Author. A user-managed separate exchange establishes the review boundary; merely using this native definition does not establish independence, identity, authority, sign-off, or acceptance.",
    inputs: Object.freeze([
      "Only the exact project-relative artifact paths declared by the user-managed review prompt",
      "The review purpose, scope limits, and rubric stated in that prompt"
    ]),
    outputs: Object.freeze([
      "One readable Markdown review within the declared scope",
      "Concrete findings tied to declared artifact paths, with rationale, materiality, and actionable follow-up where appropriate",
      "Explicit unknowns, limitations, and provenance information that the reviewer can honestly provide",
      "Execution, rewriting, rebuttal, and scheduling stay outside Reviewer responsibility; make no edits or Dove mutation, perform no self-fix or nested reviewer launch, and access no parent transcript, Trellis task material, undeclared Dove state, or undeclared files"
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
var REVIEWER_BOUNDARY = "Review only the exact declared paths listed in this prompt. Do not inspect directories, search the project, follow references into undeclared files, or use parent conversation context. Do not edit files or invoke Dove. Do not perform rebuttal, self-fix, implementation, or nested reviewer delegation.";
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
function reviewerPrompt(reviewScope) {
  if (!Array.isArray(reviewScope?.artifactPaths) || reviewScope.artifactPaths.length === 0) {
    throw new Error("Reviewer prompt requires at least one declared artifact path.");
  }
  const declared = reviewScope.artifactPaths.map((item) => `- ${item}`).join("\n");
  return `You are acting in the Dove Reviewer role for a user-managed separate review exchange. This prompt and native role definition do not prove independence, identity, or authority.

Declared review scope:
${declared}

Read only those exact project-relative files. Do not access the parent transcript, Trellis tasks or specs, Dove installation state, directories, or any undeclared file. Do not edit, write, self-fix, rebut, invoke Dove, launch another reviewer, or delegate.

Assess correctness and internal coherence; evidence and claim scope; omissions and material risk; reproducibility; fairness or information leakage; and preservation of failures, denominators, and uncertainty. Do not claim authority, identity, sign-off, acceptance, or independence from this prompt alone.

Return one readable Markdown review. Tie every concrete finding to one or more declared paths, explain why it matters, suggest action where appropriate, and state unknowns, limitations, and any provenance you can honestly provide. Do not use IDs, fixed verdict enums, or a strict import schema unless the user explicitly requests a separate machine-readable artifact.
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
var RETIRED_PACKAGE_RUNTIME_PATHS = ["mcp/dove-state-server-package.mjs"];
var PROJECT_HOST_IDS = ["opencode", "codex", "cursor", "agents", "claude"];
var HOST_IDS = [...PROJECT_HOST_IDS];
var DOVE_CLAUDE_AMBIENT_PROJECT_PATHS = Object.freeze([".claude/rules/dove.md", ".claude/skills/dove-intake/SKILL.md", ".claude/skills/dove-lessons-intake/SKILL.md", ".claude/settings.json"]);
var PACKAGE_GENERATED_SUPPORT_PATHS = Object.freeze([
  ".claude/agents/dove-reviewer.md",
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  ".claude/skills/dove-lessons-intake/SKILL.md",
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
    "Treat `.dove/research/RESEARCH.md` and its linked Markdown as ordinary researcher-owned documents, not a database or machine authority.",
    "Use host file and research tools directly. Read the overview first when it exists, then only the linked documents and project artifacts relevant to the task.",
    "Keep failures, adverse evidence, limitations, and uncertainty visible; tests, host output, and any review remain bounded evidence rather than scientific authority."
  ])
});
var host = (instruction, options = {}) => ({
  type: "host",
  capability: options.capability ?? "ordinary-project-work",
  readOnly: options.readOnly === true,
  persistWhen: options.persistWhen ?? "never",
  instruction
});
var commonClarification = ["Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary."];
var readResearchDocuments = (instruction = "If `.dove/research/RESEARCH.md` exists, read it first and follow only the most relevant Markdown links. If it is absent, treat that as normal and inspect ordinary project material instead. Do not require fixed headings, frontmatter, IDs, or a machine index.") => host(instruction, { capability: "research-document-reading", readOnly: true });
var updateResearchDocuments = (instruction) => host(instruction, { capability: "research-document-maintenance", persistWhen: "research-context-worth-preserving" });
function workflow(slug) {
  if (slug === "research") return {
    status: "single-bounded-pass",
    modes: [{ id: "default", when: "The user requests one bounded pass of research framing, investigation, synthesis, or project work.", steps: [
      readResearchDocuments(),
      host("Inspect the relevant ordinary project materials and real external resources needed to understand the question. Form a proportional research frame from actual evidence rather than Dove bookkeeping.", { capability: "project-exploration", readOnly: true }),
      host("Complete exactly one bounded research or project pass. Produce the requested analysis or artifact, preserve material failures and uncertainty, and stop after the bounded deliverable rather than turning Research into multi-round autonomy.", { capability: "research-work" }),
      updateResearchDocuments("When the work creates durable research value, update the existing topic document or create one readable Markdown document for that work. Update `RESEARCH.md` only when the mainline, important conclusion, linked work, or priority materially changes. Do not create a document merely because the Skill ran.")
    ], clarification: commonClarification }]
  };
  if (slug === "auto") return {
    status: "explicit-multi-round-autonomy",
    modes: [{ id: "default", when: "The user explicitly invokes high-autonomy multi-round research.", steps: [
      readResearchDocuments("Require an existing `.dove/research/RESEARCH.md`, read its current mainline and linked work, and reground from the actual project. If the overview is absent, materially incomplete, or evidence says the mainline must change, write a recommendation as an ordinary project artifact, report the block, and stop."),
      host("Read `.dove/research/LESSONS.md` when present and treat it as fallible guidance, never as evidence or authority.", { capability: "lesson-reading", readOnly: true }),
      host("Deeply explore relevant code, data, results, drafts, figures, constraints, and external sources. Build an evidence-aware frame covering competing explanations, counterfactuals, baselines, discriminating actions, and current claim boundaries.", { capability: "project-exploration", readOnly: true }),
      host("Let Planner and Builder/Author coordinate autonomously, using subagents when useful. Repeatedly choose and perform the feasible action with the highest expected research value, including retrieval, analysis, code, writing, figures, validation, and experiments.", { capability: "autonomous-research-work" }),
      host("For every selected experiment, write or extend one experiment Markdown document with the prospective plan before execution. Then execute with host tools and append actual procedure, results, failures, denominator accounting, deviations, limitations, uncertainty, and implications to that same document.", { capability: "experiment-work", persistWhen: "selected-experiment" }),
      host("When independent review is a true dependency, prepare one readable Review document and return the declared artifacts and prompt to the user for a separate reviewer they manage. Do not launch, impersonate, or fabricate the reviewer; stop if the unavailable return blocks progress.", { capability: "review-handoff", persistWhen: "review-needed" }),
      updateResearchDocuments("After each material round, update the relevant topic document. Keep `RESEARCH.md` concise and update it only for material mainline, conclusion, document-link, or priority changes. Preserve adverse evidence instead of overwriting history with a success narrative."),
      host("Continue without a default round count until the goal is achieved, the user budget ends, no feasible action has positive expected research value, a safety or mainline boundary is reached, or a required Review return is unavailable. Report the evidence-bounded result without claiming scientific authority.", { capability: "research-synthesis", readOnly: true })
    ], clarification: commonClarification }]
  };
  if (slug === "status") return {
    status: "read-only",
    modes: [{ id: "default", when: "The user requests current Dove research status.", steps: [
      readResearchDocuments("Read `.dove/research/RESEARCH.md` once when it exists, then read only the linked documents needed to resolve material ambiguity. Report the current mainline, real progress, failures, limitations, uncertainty, and next priorities. If the overview is absent or a link is missing, say so naturally; do not infer a database state or modify files.")
    ], clarification: [] }]
  };
  if (slug === "source") return {
    status: "bounded-source-work",
    modes: [{ id: "default", when: "The user requests source discovery, reading, comparison, or verification.", steps: [
      readResearchDocuments(),
      host("Discover, retrieve, read, and verify real material with host-native project or external research tools. Distinguish material merely found from material actually inspected and used; preserve conflicts, conditions, and limitations.", { capability: "source-research", readOnly: true }),
      updateResearchDocuments("When a used source deserves durable context, create or update one readable source-note Markdown with citation or URL, what was learned, conditions, conflicts, limitations, and links to related work. Do not generate a Source ID, fingerprint, or byte hash.")
    ], clarification: commonClarification }]
  };
  if (slug === "experiment") return {
    status: "planned-experiment-work",
    modes: [{ id: "default", when: "The user requests experiment design, execution, analysis, or recording.", steps: [
      readResearchDocuments(),
      host("Select or create one readable experiment Markdown document. Before execution, write why the experiment matters, hypotheses or competing explanations, protocol, inputs, comparisons, metrics, discriminating observations, stop conditions, expected artifacts, cost, risk, and failure value. Do not execute first and reconstruct the plan afterward.", { capability: "experiment-design", persistWhen: "experiment-selected" }),
      host("Execute the written plan with normal host tools. Append actual execution, raw artifact paths, observations, positive, negative, null, mixed, failed or stopped outcomes, denominator accounting, exclusions, deviations, unexpected observations, limitations, and uncertainty to the same document.", { capability: "experiment-execution", persistWhen: "experiment-executed" }),
      updateResearchDocuments("Explain in that experiment document what the result supports, weakens, leaves unresolved, and cannot establish. Update `RESEARCH.md` only when the result materially changes the mainline, important conclusions, linked work, or next priority.")
    ], clarification: commonClarification }]
  };
  if (slug === "draft") return {
    status: "artifact-work",
    modes: [{ id: "default", when: "The user requests drafting or revision of an ordinary project artifact.", steps: [
      readResearchDocuments(),
      host("Read the target and relevant project evidence, then create or revise the ordinary draft artifact with host editing tools. Keep every claim within the available evidence and retain material counter-evidence and uncertainty.", { capability: "artifact-editing" }),
      host("Run appropriate host-native validation and report remaining unsupported claims, citation gaps, and uncertainty.", { capability: "artifact-validation", readOnly: true }),
      updateResearchDocuments("Update a linked research document only when the drafting work materially changes a research conclusion, limitation, or next priority; do not build a separate Claim database.")
    ], clarification: commonClarification }]
  };
  if (slug === "figure") return {
    status: "artifact-work",
    modes: [{ id: "default", when: "The user requests a figure, diagram, plot, or caption.", steps: [
      readResearchDocuments(),
      host("Gather actual project materials and data, then create or revise the ordinary figure and caption with host-native plotting, image, or editing tools.", { capability: "figure-creation" }),
      host("Validate labels, denominators, provenance, legibility, and agreement between the figure, caption, and underlying evidence.", { capability: "figure-validation", readOnly: true }),
      updateResearchDocuments("Link the figure from the relevant experiment, mission, or overview document only when that link improves future research recovery.")
    ], clarification: commonClarification }]
  };
  if (slug === "review") return {
    status: "user-managed-review-document",
    modes: [{ id: "default", when: "The user requests independent review preparation, import, or review-context inspection.", steps: [
      readResearchDocuments(),
      host("Select or create one readable Review Markdown. Record the review purpose, declared artifact paths, scope limits, rubric, and a self-contained prompt for a separate reviewer chosen and managed by the user. If exact version freezing matters, use an ordinary Git commit, versioned copy, or review bundle and link it; do not generate a Dove exchange ID or scientific hash.", { capability: "review-preparation", persistWhen: "review-prepared" }),
      host("Return the declared files and prompt to the user. Never launch, impersonate, silently substitute, or certify the reviewer.", { capability: "review-handoff", readOnly: true }),
      updateResearchDocuments("When the user supplies the actual return, append it faithfully to the same Review document together with limitations, author interpretation, and follow-up actions. Preserve the original reviewer content; do not require verdict, severity, finding IDs, or a strict import schema.")
    ], clarification: commonClarification }]
  };
  if (slug === "rebuttal") return {
    status: "author-side-work",
    modes: [{ id: "default", when: "The user requests author-side rebuttal or revision from review findings.", steps: [
      readResearchDocuments(),
      host("Read the relevant Review document and actual artifacts. Analyze each material finding against the evidence, write the response, and make requested ordinary project revisions. This remains Builder/Author work, not independent review.", { capability: "rebuttal-and-revision" }),
      host("Validate that each response maps to a real finding and that revisions do not overstate evidence or erase failures and uncertainty.", { capability: "artifact-validation", readOnly: true }),
      updateResearchDocuments("Append the author response and resulting decisions to the same Review document or the directly affected research document when that context is worth preserving.")
    ], clarification: commonClarification }]
  };
  return {
    status: "advisory-markdown",
    modes: [{ id: "default", when: "The user requests Lessons reading, remembering, or reflection.", steps: [
      host("Use `.dove/research/LESSONS.md` as one complete, ordinary advisory Markdown document. Read it directly for a read request. For explicit remembering or reflection, preserve its useful structure and update it only with supported reusable guidance. If it does not exist and the request needs durable Lessons, create it naturally. Do not create lesson IDs, an application ledger, or treat Lessons as evidence.", { capability: "lesson-maintenance", persistWhen: "explicit-lessons-request" })
    ], clarification: commonClarification }]
  };
}
var SURFACES = [
  ["research", "Complete one bounded pass of research, synthesis, or project investigation."],
  ["status", "Read the human-maintained research overview and report current direction and progress without writes."],
  ["source", "Discover, read, verify, and document real sources that materially inform the research."],
  ["experiment", "Plan and execute a real experiment while keeping plan and result in one document."],
  ["draft", "Write or revise ordinary project drafts from the available evidence."],
  ["figure", "Gather real materials and create or revise figures and captions."],
  ["review", "Prepare and preserve a user-managed independent review in one readable document."],
  ["rebuttal", "Perform author-side rebuttal and revision from actual review findings and evidence."],
  ["lessons", "Read or maintain the complete advisory Lessons Markdown document."],
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
import crypto3 from "node:crypto";
import fs10 from "node:fs";
import path10 from "node:path";

// src/core/claude-project-settings.mjs
var RETIRED_DOVE_SERVER_NAME = "dove";
var DOVE_CLAUDE_LOCAL_SETTINGS_PATH = ".claude/settings.local.json";
var LEGACY_DOVE_CLAUDE_ENABLED_MCP_SELECTOR = `/enabledMcpjsonServers[${RETIRED_DOVE_SERVER_NAME}]`;
function plainObject3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function stringList(value, field) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} ${field} must be an array.`);
  if (value.some((item) => typeof item !== "string" || !item || item !== item.trim())) {
    throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} ${field} must contain non-empty trimmed strings.`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} ${field} must not contain duplicate server names.`);
  }
  return value;
}
function inspectLegacyClaudeEnabledMcpSettings(settings) {
  if (!plainObject3(settings)) throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} must contain a JSON object.`);
  const enabled = stringList(settings.enabledMcpjsonServers, "enabledMcpjsonServers");
  const disabled = stringList(settings.disabledMcpjsonServers, "disabledMcpjsonServers");
  const declaredEnabled = enabled.includes(RETIRED_DOVE_SERVER_NAME);
  const declaredDisabled = disabled.includes(RETIRED_DOVE_SERVER_NAME);
  return {
    declaredEnabled,
    declaredDisabled,
    conflicted: declaredEnabled && declaredDisabled
  };
}

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

// src/core/project-legacy-installation.mjs
import fs6 from "node:fs";
import path6 from "node:path";
var LEGACY_PROJECT_MARKER_PATHS = Object.freeze(["mcp/dove-claude-project.json"]);
var LEGACY_PROJECT_BUNDLE_PROBES = Object.freeze([
  { path: "bin/dove-package.mjs", signatures: ["dove-state-server-package.mjs", "DOVE_MCP_SERVER_NAME", "create_ambient_dove_mission"] },
  { path: "dist/index.mjs", signatures: ["DOVE_WORKSPACE_SCHEMA_VERSION", "createDoveMission", "queryDoveStatus"] },
  { path: "mcp/dove-state-server-package.mjs", signatures: ["create_ambient_dove_mission", "query_dove_status", "Dove MCP"] },
  { path: "scripts/dove-user-prompt-submit-package.mjs", signatures: ["create_ambient_dove_mission", "UserPromptSubmit", "closureRequest"] }
]);
var DOVE_HOOK_COMMAND = /(?:^|[\s"'])node(?:[\s"']+)[^"'\s]*dove-user-prompt-submit-package\.mjs\b/u;
var DOVE_MCP_BUNDLE_PATH = /(?:^|[/\\])mcp[/\\]dove-state-server-package\.mjs$/u;
function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function readSmallRegularFile(root, relativePath, fsOps, maxBytes = 2 * 1024 * 1024) {
  const absolutePath = path6.join(root, relativePath);
  const stat = lstatOrNull(fsOps, absolutePath);
  if (stat === null || stat.isSymbolicLink() || !stat.isFile() || stat.size > maxBytes) return null;
  return fsOps.readFileSync(absolutePath, "utf8");
}
function legacyMarkerHits(root, fsOps) {
  return LEGACY_PROJECT_MARKER_PATHS.filter((relativePath) => {
    const content = readSmallRegularFile(root, relativePath, fsOps, 64 * 1024);
    if (content === null) return false;
    try {
      const value = parseJsonWithoutDuplicateKeys(content, `Legacy Dove marker ${relativePath}`);
      return value !== null && typeof value === "object" && !Array.isArray(value) && value.host === "claude";
    } catch {
      return false;
    }
  });
}
function registrationHits(root, fsOps) {
  const hits = [];
  const mcp = readSmallRegularFile(root, ".mcp.json", fsOps, 512 * 1024);
  if (mcp !== null) {
    try {
      const value = parseJsonWithoutDuplicateKeys(mcp, "Legacy Dove MCP configuration");
      const dove = value?.mcpServers?.dove;
      const args = Array.isArray(dove?.args) ? dove.args : [];
      if (dove?.command === "node" && args.some((argument) => typeof argument === "string" && DOVE_MCP_BUNDLE_PATH.test(argument))) {
        hits.push(".mcp.json#/mcpServers/dove");
      }
    } catch {
    }
  }
  const settings = readSmallRegularFile(root, ".claude/settings.json", fsOps, 512 * 1024);
  if (settings !== null) {
    try {
      const value = parseJsonWithoutDuplicateKeys(settings, "Legacy Dove Claude settings");
      if (DOVE_HOOK_COMMAND.test(JSON.stringify(value?.hooks?.UserPromptSubmit ?? null))) hits.push(".claude/settings.json#/hooks/UserPromptSubmit");
    } catch {
    }
  }
  return hits;
}
function bundleHits(root, fsOps) {
  return LEGACY_PROJECT_BUNDLE_PROBES.flatMap((probe) => {
    const content = readSmallRegularFile(root, probe.path, fsOps);
    if (content === null) return [];
    const signatureMatched = probe.signatures.some((signature) => content.includes(signature));
    return [{ path: probe.path, signatureMatched }];
  });
}
function affirmativeCopiedRuntimeHits(root, fsOps) {
  return LEGACY_PROJECT_BUNDLE_PROBES.flatMap((probe) => {
    const content = readSmallRegularFile(root, probe.path, fsOps);
    if (content === null) return [];
    const signatureCount = probe.signatures.filter((signature) => content.includes(signature)).length;
    return signatureCount >= 2 ? [{ path: probe.path, signatureCount }] : [];
  });
}
function deepFreeze(result) {
  Object.freeze(result.markerHits);
  Object.freeze(result.registrationHits);
  result.bundleHits.forEach(Object.freeze);
  Object.freeze(result.bundleHits);
  Object.freeze(result.evidence);
  return Object.freeze(result);
}
function inspectLegacyProjectInstallation(root, options = {}) {
  const fsOps = options.fsOps ?? fs6;
  const canonicalRoot4 = path6.resolve(root);
  const markerHits = legacyMarkerHits(canonicalRoot4, fsOps);
  const registrationHitsFound = registrationHits(canonicalRoot4, fsOps);
  const bundles = bundleHits(canonicalRoot4, fsOps);
  const reliableBundleCombination = bundles.length >= 2;
  const detected = markerHits.length > 0 || registrationHitsFound.length > 0 || reliableBundleCombination;
  const evidence = [
    ...markerHits.map((entry) => `marker:${entry}`),
    ...registrationHitsFound.map((entry) => `registration:${entry}`),
    ...reliableBundleCombination ? bundles.map((entry) => `bundle:${entry.path}${entry.signatureMatched ? ":signature" : ""}`) : []
  ];
  return deepFreeze({
    state: detected ? "unsupported-legacy" : "absent",
    detected,
    root: canonicalRoot4,
    markerHits: [...markerHits],
    registrationHits: [...registrationHitsFound],
    bundleHits: bundles.map((entry) => ({ ...entry })),
    evidence
  });
}
function inspectRetiredCopiedRuntime(root, options = {}) {
  const fsOps = options.fsOps ?? fs6;
  const canonicalRoot4 = path6.resolve(root);
  const copiedRuntimeHits = affirmativeCopiedRuntimeHits(canonicalRoot4, fsOps);
  const detected = copiedRuntimeHits.length > 0;
  return Object.freeze({
    state: detected ? "retired-copied-runtime" : "absent",
    detected,
    root: canonicalRoot4,
    copiedRuntimeHits: Object.freeze(copiedRuntimeHits.map((entry) => Object.freeze({ ...entry })))
  });
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
function plainObject4(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function assertPlainObject(value, label) {
  if (!plainObject4(value)) throw new Error(`${label} must be a plain object.`);
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
function lstatOrNull2(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function inspectManifestFile(root, fsOps, manifestRelativePath) {
  const installationDirectory = path7.join(root, path7.posix.dirname(manifestRelativePath));
  const directoryStat = lstatOrNull2(fsOps, installationDirectory);
  if (directoryStat === null) throw new Error(`Dove project installation manifest is missing: ${manifestRelativePath}.`);
  if (directoryStat.isSymbolicLink()) throw new Error(`Dove project installation directory must not be a symbolic link: ${installationDirectory}.`);
  if (!directoryStat.isDirectory()) throw new Error(`Dove project installation path must be a directory: ${installationDirectory}.`);
  const manifestPath = path7.join(root, manifestRelativePath);
  const stat = lstatOrNull2(fsOps, manifestPath);
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
function lstatOrNull3(fsOps, targetPath) {
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
  const manifestStat = lstatOrNull3(fsOps, manifestPath);
  if (manifestStat === null) {
    const directoryStat2 = lstatOrNull3(fsOps, directoryPath);
    if (directoryStat2 === null) return { state: "absent", root, manifestPath };
    return { state: "residue", root, manifestPath, directoryPath, directoryStat: directoryStat2 };
  }
  if (manifestStat.isSymbolicLink()) throw new Error(`Dove project installation manifest must not be a symbolic link: ${manifestPath}.`);
  if (!manifestStat.isFile()) throw new Error(`Dove project installation manifest must be a regular file: ${manifestPath}.`);
  const directoryStat = lstatOrNull3(fsOps, directoryPath);
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
    const stat = lstatOrNull3(fsOps, target);
    if (stat === null) continue;
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(`Dove setup marker must be a regular non-symbolic-link file: ${target}.`);
    }
    return { state: "marker", relativePath };
  }
  for (const relativePath of [INSTALLATION_DIRECTORY, ".dove-install"]) {
    const target = path8.join(root, relativePath);
    const stat = lstatOrNull3(fsOps, target);
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
    return new Error(`Dove found a legacy project installation at ${root}. Run 'dove upgrade' to preserve its research state, or 'dove reinstall' to delete and recreate Dove state.`);
  }
  if (evidence.relativePath === ".dove/manifest.json") {
    return new Error(`Dove found an unsupported legacy research workspace at ${root}. Run 'dove reinstall' to delete and recreate Dove state, or 'dove doctor --json' for diagnosis.`);
  }
  return new Error(`Dove found incomplete legacy Dove state at ${root}. Run 'dove doctor --json' before initializing another project.`);
}
function gitRootFrom(start, fsOps) {
  for (const directory of parentDirectories2(start)) {
    const dotGit = path8.join(directory, ".git");
    const stat = lstatOrNull3(fsOps, dotGit);
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
      if (index === 0) throw new Error(`Dove project integration is already initialized at ${directory}. Use dove sync instead.`);
      throw new Error(`Refusing nested Dove project initialization at ${candidate}; an initialized project already exists at ${directory}.`);
    }
    const evidence = setupEvidenceAt(directory, fsOps, { includeResearch: index === 0 });
    if (evidence.state !== "absent") throw legacyInitError(candidate, directory, evidence);
  }
  if (!explicitProject) {
    const gitRoot2 = gitRootFrom(candidate, fsOps);
    if (gitRoot2 !== null && gitRoot2 !== candidate) {
      throw new Error(`Refusing to initialize Dove from Git project subdirectory ${candidate}. Run dove init from the Git root ${gitRoot2}, or pass an explicit --project directory.`);
    }
  }
  return candidate;
}
function packageProjectBoundary(directory, fsOps) {
  const packageJson = lstatOrNull3(fsOps, path8.join(directory, "package.json"));
  const nodeModules = lstatOrNull3(fsOps, path8.join(directory, "node_modules"));
  return packageJson?.isFile() && !packageJson.isSymbolicLink() && nodeModules?.isDirectory() && !nodeModules.isSymbolicLink();
}
function resolveProjectRootForSetup(start, options = {}) {
  const fsOps = options.fsOps ?? fs8;
  const candidate = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project setup start", fsOps);
  for (const directory of parentDirectories2(candidate)) {
    if (setupEvidenceAt(directory, fsOps).state !== "absent") return directory;
    const dotGit = lstatOrNull3(fsOps, path8.join(directory, ".git"));
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
function dailyUseBullets(command) {
  return [command.summary];
}
function exampleBullets(command, hostId = null) {
  const examples = command.examples;
  if (!Array.isArray(examples)) {
    return [];
  }
  return examples.map((example) => {
    const text2 = String(example).trim();
    return hostId === "opencode" ? text2.replace(/^\/dove:/u, "/dove.") : text2;
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
      const persistence = step.persistWhen && step.persistWhen !== "never" ? ` Persist only when: ${step.persistWhen}.` : " No file write is required.";
      lines.push(`  ${index + 1}. Use host tools (${step.readOnly ? "read-only" : "work"}; ${step.capability}). ${step.instruction}${persistence}`);
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
function renderResponsePolicy() {
  return `## Response policy

${renderBullets(USER_RESPONSE_POLICY)}`;
}
function renderExamples(command, hostId = null) {
  const examples = exampleBullets(command, hostId);
  return examples.length > 0 ? `

## Examples

${examples.map((example) => `- \`${example}\``).join("\n")}` : "";
}
function renderBody(command, heading, hostId = null) {
  const purpose = command.summary;
  const dailyUse = renderBullets(dailyUseBullets(command));
  const examples = renderExamples(command, hostId);
  const workflow2 = renderWorkflow(command);
  const guidance = renderGuidance(command);
  const capsule = renderCapsule();
  const responsePolicy = renderResponsePolicy();
  return `# ${heading}

${purpose}

## Use when

${dailyUse}${examples}

${workflow2}${guidance ? `

${guidance}` : ""}

${capsule}

${responsePolicy}
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
    { relativePath: DOVE_CLAUDE_LESSONS_SKILL_PATH, content: renderClaudeLessonsIntakeSkill() }
  ];
}

// src/core/project-installation.mjs
var MCP_PATH = ".mcp.json";
var MCP_SELECTOR = "/mcpServers/dove";
var LEGACY_ENABLED_MCP_SELECTOR = "/enabledMcpjsonServers[dove]";
var SETTINGS_SELECTOR = "/hooks/UserPromptSubmit[dove-user-prompt-submit]";
var CLAUDE_HOST = "claude";
var FORBIDDEN_RESOURCE_PREFIXES = [".dove/", "bin/", "dist/", "mcp/", "scripts/"];
var LEGACY_DOVE_MCP_BUNDLE_ARGS = /* @__PURE__ */ new Set([
  "./mcp/dove-state-server-package.mjs",
  "${CLAUDE_PROJECT_DIR:-.}/mcp/dove-state-server-package.mjs"
]);
var RETIRED_EXCLUSIVE_PATHS = /* @__PURE__ */ new Set([
  ...Object.values(RETIRED_MANAGED_PATHS).flat().filter((relativePath) => relativePath !== ".opencode.json"),
  ".claude/commands/dove/init.md",
  ".claude/commands/dove/version.md",
  "mcp/dove-claude-project.json"
]);
var KNOWN_RETIRED_DIGESTS = /* @__PURE__ */ new Map([
  [".claude/commands/dove/init.md", /* @__PURE__ */ new Set([
    "8bc54cb154048273c4e6f8b5c77ae76453d2cff788c98bab6fc4882bc2a7dc5e",
    "a9afa0a020eef967d02780d4604ea38c14c07a32f8de3e21c5b85e414afd1a49",
    "f75287da81a7fb18c80895388dec5ee5536336450123ad2ab4dcb49155e50e4e"
  ])],
  [".claude/commands/dove/version.md", /* @__PURE__ */ new Set([
    "17c468e5e92a69d4466918f1d251bdc67d68e9cc0fed0f166807256529b89207",
    "6d1a56d47e843ea5f976a399b314e90a51fb7e409daa2b673ba2e4bfecfd02c5",
    "e02ccf0c83499d893104b542d5ef9ad6238dc88cdc108e5c2dfde1aa0a66bfb2"
  ])],
  [".claude/commands/dove/workspace.md", /* @__PURE__ */ new Set(["1a6a38f1a448258faecff76e185161ebb922a359b8000ef7e14148838bd23fe4"])],
  [".claude/commands/dove/mission.md", /* @__PURE__ */ new Set(["b237ce2efa7a95f14a288bc5d7198ef0b9f582e4a9fa7938061ab71b9066c949"])],
  [".claude/commands/dove/note.md", /* @__PURE__ */ new Set(["dc68943606243671e869a89cf9bf93b8c943697ca01ae98ca5f202adf3d5569e"])],
  [".claude/commands/dove/experience.md", /* @__PURE__ */ new Set(["33843d7c0d2950ec90b1ec4c466a3ff07a07860f9e6ec712e8addd0143155400"])]
]);
function plainObject5(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function sha2562(content) {
  return crypto3.createHash("sha256").update(content).digest("hex");
}
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}
function semanticDigest(value) {
  return sha2562(canonicalJson(value));
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
  const timestamp3 = value instanceof Date ? value.toISOString() : value;
  if (typeof timestamp3 !== "string" || new Date(timestamp3).toISOString() !== timestamp3) throw new Error("Project integration now must be a Date or exact ISO timestamp.");
  return timestamp3;
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
      digest: sha2562(content)
    };
  });
  const hook = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: SETTINGS_SELECTOR,
    fragment: DOVE_CLAUDE_AMBIENT_HOOK_ENTRY,
    digest: semanticDigest(DOVE_CLAUDE_AMBIENT_HOOK_ENTRY)
  };
  const resources = [...files, hook];
  if (new Set(resources.map(managedKey2)).size !== resources.length) throw new Error("Generated project integration resources contain duplicate manifest entries.");
  return resources;
}
function resourcesForHosts(hosts) {
  return claudeResources().filter((entry) => hosts.includes(entry.hostId)).sort(compareManaged2);
}
function lstatOrNull4(fsOps, targetPath) {
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
    const stat = lstatOrNull4(fsOps, current);
    if (stat === null) return { exists: false, bytes: null, digest: null, mode: null, type: "absent" };
    if (stat.isSymbolicLink()) throw new Error(`Dove project integration path must not be a symbolic link: ${relativePath}.`);
    if (index < relativePath.split("/").length - 1) {
      if (!stat.isDirectory()) throw new Error(`Dove project integration parent must be a directory: ${relativePath}.`);
      continue;
    }
    if (!stat.isFile()) throw new Error(`Dove project integration path must be absent or a regular file: ${relativePath}.`);
    const bytes = fsOps.readFileSync(current);
    return { exists: true, bytes, digest: sha2562(bytes), mode: stat.mode & 4095, type: "file" };
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
  if (!plainObject5(value)) throw new Error(`${relativePath} must contain a JSON object.`);
  return value;
}
function serializeSharedJson(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}
function referencesDoveHook(entry) {
  return plainObject5(entry) && Array.isArray(entry.hooks) && entry.hooks.some((hook) => plainObject5(hook) && typeof hook.command === "string" && (hook.command.includes("dove hook user-prompt-submit") || hook.command.includes("dove-user-prompt-submit-package.mjs")));
}
function hookFragmentState(settings) {
  if (settings.hooks !== void 0 && !plainObject5(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  const entries = settings.hooks?.UserPromptSubmit;
  if (entries !== void 0 && !Array.isArray(entries)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.UserPromptSubmit must be an array.`);
  const candidates = (entries ?? []).map((entry, index) => ({ entry, index })).filter(({ entry }) => referencesDoveHook(entry));
  if (candidates.length > 1) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} defines multiple Dove UserPromptSubmit hooks.`);
  if (candidates.length === 0) return { exists: false, digest: null, index: -1, fragment: null };
  return { exists: true, digest: semanticDigest(candidates[0].entry), index: candidates[0].index, fragment: candidates[0].entry };
}
function mcpFragmentState(config) {
  if (config.mcpServers !== void 0 && !plainObject5(config.mcpServers)) throw new Error(`${MCP_PATH} mcpServers must be a JSON object.`);
  if (!Object.hasOwn(config.mcpServers ?? {}, "dove")) return { exists: false, digest: null, fragment: null };
  const fragment = config.mcpServers.dove;
  return { exists: true, digest: semanticDigest(fragment), fragment };
}
function enabledMcpFragmentState(settings) {
  const legacy = inspectLegacyClaudeEnabledMcpSettings(settings);
  return { exists: legacy.declaredEnabled, digest: legacy.declaredEnabled ? semanticDigest("dove") : null, fragment: legacy.declaredEnabled ? "dove" : null };
}
function fragmentState(resource, value) {
  if (resource.selector === SETTINGS_SELECTOR) return hookFragmentState(value);
  if (resource.selector === MCP_SELECTOR) return mcpFragmentState(value);
  if (resource.selector === LEGACY_ENABLED_MCP_SELECTOR) return enabledMcpFragmentState(value);
  throw new Error(`Unsupported Dove project integration selector: ${resource.selector}.`);
}
function removeFragment(resource, value, current) {
  if (resource.selector === SETTINGS_SELECTOR) {
    const promptHooks = value.hooks.UserPromptSubmit.filter((_, index) => index !== current.index);
    return { ...value, hooks: { ...value.hooks, UserPromptSubmit: promptHooks } };
  }
  if (resource.selector === MCP_SELECTOR) {
    const servers = { ...value.mcpServers };
    delete servers.dove;
    return { ...value, mcpServers: servers };
  }
  if (resource.selector === LEGACY_ENABLED_MCP_SELECTOR) {
    return { ...value, enabledMcpjsonServers: value.enabledMcpjsonServers.filter((name) => name !== "dove") };
  }
  throw new Error(`Unsupported Dove project integration selector: ${resource.selector}.`);
}
function emptySharedJsonShell(resource, value) {
  if (resource.selector === MCP_SELECTOR) return Object.keys(value).length === 1 && plainObject5(value.mcpServers) && Object.keys(value.mcpServers).length === 0;
  if (resource.selector === LEGACY_ENABLED_MCP_SELECTOR) return Object.keys(value).length === 1 && Array.isArray(value.enabledMcpjsonServers) && value.enabledMcpjsonServers.length === 0;
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
    if (observed.digest !== oldEntry.digest && observed.digest !== desired.digest) throw driftError(resource, observed.digest);
    if (observed.digest === desired.digest) return { entry: null, changed: oldEntry.digest !== desired.digest };
    return { entry: transactionWrite(root, desired, desired.content, observed), changed: true };
  }
  if (!observed.exists) return { entry: null, changed: true };
  if (observed.digest !== oldEntry.digest) throw driftError(resource, observed.digest);
  return { entry: transactionDelete(root, resource, observed), changed: true };
}
function planJsonFragment(root, desired, oldEntry, fsOps) {
  const resource = desired ?? oldEntry;
  const observed = inspectRegularProjectFile(root, resource.path, fsOps);
  const value = parseSharedJson(observed, resource.path);
  const current = fragmentState(resource, value);
  if (!oldEntry) {
    if (current.exists) {
      if (current.digest === desired.digest) return { entry: null, changed: false };
      throw conflictError(desired);
    }
    if (desired.selector !== SETTINGS_SELECTOR) throw new Error(`Dove no longer installs project-local fragment ${desired.path}#${desired.selector}.`);
    const merged = mergeClaudeAmbientSettings(value);
    return { entry: merged.changed ? transactionWrite(root, desired, serializeSharedJson(merged.settings), observed) : null, changed: merged.changed };
  }
  if (desired) {
    if (!current.exists || current.digest !== oldEntry.digest && current.digest !== desired.digest) throw driftError(resource, current.digest);
    if (current.digest === desired.digest) return { entry: null, changed: oldEntry.digest !== desired.digest };
    if (desired.selector !== SETTINGS_SELECTOR) throw new Error(`Dove no longer installs project-local fragment ${desired.path}#${desired.selector}.`);
    const entries = [...value.hooks.UserPromptSubmit];
    entries[current.index] = DOVE_CLAUDE_AMBIENT_HOOK_ENTRY;
    const next2 = { ...value, hooks: { ...value.hooks, UserPromptSubmit: entries } };
    return { entry: transactionWrite(root, desired, serializeSharedJson(next2), observed), changed: true };
  }
  if (!current.exists) return { entry: null, changed: true };
  if (current.digest !== oldEntry.digest) throw driftError(resource, current.digest);
  const next = removeFragment(resource, value, current);
  return {
    entry: emptySharedJsonShell(resource, next) ? transactionDelete(root, resource, observed) : transactionWrite(root, resource, serializeSharedJson(next), observed),
    changed: true
  };
}
function planResource(root, desired, oldEntry, fsOps) {
  const kind = desired?.kind ?? oldEntry.kind;
  if (kind === "exclusive-file") return planExclusive(root, desired, oldEntry, fsOps);
  if (kind === "json-fragment") return planJsonFragment(root, desired, oldEntry, fsOps);
  throw new Error(`Unsupported project integration resource kind: ${kind}.`);
}
function rejectLegacy(root, fsOps) {
  const legacy = inspectLegacyProjectInstallation(root, { fsOps });
  if (legacy.detected) throw new Error(`Unsupported legacy Dove project installation detected at ${root}: ${legacy.evidence.join(", ")}. Run dove upgrade or dove reinstall explicitly.`);
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
  for (const key of [.../* @__PURE__ */ new Set([...oldByKey.keys(), ...desiredByKey.keys()])].sort()) {
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
function initializeProjectIntegration(rootOrProject, options = {}) {
  const fsOps = options.fsOps ?? fs10;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const hosts = normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: true });
  const now = exactTimestamp2(options.now);
  const root = resolveProjectRootForInit(rootOrProject, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  rejectLegacy(root, fsOps);
  const plan = preparePlan({ root, hosts, packageName: options.packageName, packageVersion: options.packageVersion, now, fsOps });
  return resultFromTransaction("initialized", root, hosts, plan.manifest, writeFileSetTransaction(plan.entries, { fsOps }));
}
function prepareInstalledPlan(start, options = {}) {
  const fsOps = options.fsOps ?? fs10;
  const root = resolveInstalledProjectRoot(start, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  rejectLegacy(root, fsOps);
  const manifest = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const hosts = options.hosts === void 0 ? [...manifest.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const packageName = options.packageName ?? manifest.package.name;
  const packageVersion = options.packageVersion ?? manifest.package.version;
  assertPackageInput(packageName, packageVersion, { required: true });
  const plan = preparePlan({ root, hosts, packageName, packageVersion, now: exactTimestamp2(options.now), fsOps, manifest });
  return { fsOps, root, hosts, currentManifest: manifest, ...plan };
}
function syncProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, options);
  const transaction = writeFileSetTransaction(prepared.entries, { fsOps: prepared.fsOps });
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
function recognizedLifecycleMcpFragment(fragment) {
  if (!plainObject5(fragment) || fragment.type !== "stdio" || !Array.isArray(fragment.args)) return false;
  if (fragment.command === "dove") return sameArray(fragment.args, ["mcp", "serve", "--project", "."]);
  return fragment.command === "node" && fragment.args.length === 1 && LEGACY_DOVE_MCP_BUNDLE_ARGS.has(fragment.args[0]);
}
function recognizedLifecycleHook(entry) {
  if (!plainObject5(entry) || !Array.isArray(entry.hooks) || entry.hooks.length !== 1) return false;
  const hook = entry.hooks[0];
  return plainObject5(hook) && hook.type === "command" && typeof hook.command === "string" && (hook.command === DOVE_CLAUDE_AMBIENT_HOOK_COMMAND || hook.command === "node ./scripts/dove-user-prompt-submit-package.mjs");
}
function planRecognizedSharedCleanup(root, relativePath, fsOps, { installClaude }) {
  const observed = inspectRegularProjectFile(root, relativePath, fsOps);
  const value = parseSharedJson(observed, relativePath);
  let next = value;
  if (relativePath === MCP_PATH || relativePath === ".opencode.json") {
    if (value.mcpServers !== void 0 && !plainObject5(value.mcpServers)) throw new Error(`${relativePath} mcpServers must be a JSON object.`);
    if (Object.hasOwn(value.mcpServers ?? {}, "dove")) {
      if (!recognizedLifecycleMcpFragment(value.mcpServers.dove)) throw new Error(`${relativePath} contains an ambiguous non-Dove fragment at /mcpServers/dove.`);
      const servers = { ...value.mcpServers };
      delete servers.dove;
      next = { ...value, mcpServers: servers };
    }
  } else if (relativePath === DOVE_CLAUDE_SETTINGS_PATH) {
    const entries = value.hooks?.UserPromptSubmit;
    if (entries !== void 0 && !Array.isArray(entries)) throw new Error(`${relativePath} hooks.UserPromptSubmit must be an array.`);
    const doveEntries = (entries ?? []).filter(referencesDoveHook);
    if (doveEntries.length > 1 || doveEntries.some((entry) => !recognizedLifecycleHook(entry))) throw new Error(`${relativePath} contains an ambiguous Dove UserPromptSubmit hook.`);
    if (doveEntries.length === 1) next = { ...value, hooks: { ...value.hooks, UserPromptSubmit: entries.filter((entry) => !referencesDoveHook(entry)) } };
    if (installClaude) next = mergeClaudeAmbientSettings(next).settings;
  } else if (relativePath === DOVE_CLAUDE_LOCAL_SETTINGS_PATH) {
    inspectLegacyClaudeEnabledMcpSettings(value);
    if ((value.enabledMcpjsonServers ?? []).includes("dove")) next = { ...value, enabledMcpjsonServers: value.enabledMcpjsonServers.filter((name) => name !== "dove") };
  }
  if (canonicalJson(next) === canonicalJson(value)) return null;
  const emptyShell = relativePath === MCP_PATH || relativePath === ".opencode.json" ? Object.keys(next).length === 1 && Object.keys(next.mcpServers ?? {}).length === 0 : relativePath === DOVE_CLAUDE_LOCAL_SETTINGS_PATH ? Object.keys(next).length === 1 && (next.enabledMcpjsonServers ?? []).length === 0 : false;
  return emptyShell ? transactionDelete(root, { path: relativePath }, observed) : transactionWrite(root, { path: relativePath }, serializeSharedJson(next), observed);
}
function knownRetiredFile(root, relativePath, fsOps, manifestDigests = /* @__PURE__ */ new Map()) {
  const observed = inspectRegularProjectFile(root, relativePath, fsOps);
  if (!observed.exists) return null;
  const authorizedByManifest = manifestDigests.get(relativePath)?.has(observed.digest) === true;
  const recognizedKnownContent = KNOWN_RETIRED_DIGESTS.get(relativePath)?.has(observed.digest) === true;
  if (!authorizedByManifest && !recognizedKnownContent) {
    throw new Error(`Dove lifecycle refuses to remove retired file with unrecognized content: ${relativePath}.`);
  }
  return transactionDelete(root, { path: relativePath }, observed);
}
function manifestDigestInventory(manifest) {
  const result = /* @__PURE__ */ new Map();
  for (const entry of manifest?.managed ?? []) {
    if (entry.kind !== "exclusive-file") continue;
    if (!result.has(entry.path)) result.set(entry.path, /* @__PURE__ */ new Set());
    result.get(entry.path).add(entry.digest);
  }
  return result;
}
function knownCopiedRuntime(root, relativePath, fsOps) {
  const observed = inspectRegularProjectFile(root, relativePath, fsOps);
  if (!observed.exists) return null;
  const probe = LEGACY_PROJECT_BUNDLE_PROBES.find((entry) => entry.path === relativePath);
  const content = observed.bytes.toString("utf8");
  if ((probe?.signatures ?? []).filter((signature) => content.includes(signature)).length < 2) {
    throw new Error(`Dove lifecycle cannot safely remove copied runtime without affirmative Dove signatures: ${relativePath}.`);
  }
  return transactionDelete(root, { path: relativePath }, observed);
}
function walkDeletion(root, relativePath, fsOps, entries, scope) {
  const absolutePath = path10.join(root, relativePath);
  const stat = lstatOrNull4(fsOps, absolutePath);
  if (stat === null) return;
  if (stat.isSymbolicLink()) throw new Error(`Dove lifecycle refuses symbolic links in destructive scope: ${relativePath}.`);
  if (stat.isFile()) {
    const observed = inspectRegularProjectFile(root, relativePath, fsOps);
    entries.push(transactionDelete(root, { path: relativePath }, observed));
    scope.push({ path: relativePath, kind: "file", digest: observed.digest });
    return;
  }
  if (!stat.isDirectory()) throw new Error(`Dove lifecycle found unsupported project state: ${relativePath}.`);
  for (const child of fsOps.readdirSync(absolutePath).map(String).sort()) walkDeletion(root, path10.posix.join(relativePath, child), fsOps, entries, scope);
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
  const current = lstatOrNull4(fsOps, path10.join(root, INSTALLATION_MANIFEST_PATH));
  const legacy = lstatOrNull4(fsOps, path10.join(root, LEGACY_INSTALLATION_MANIFEST_PATH));
  if (current !== null && legacy !== null) throw new Error("Dove Upgrade found both current and 1.0 project installation manifests.");
  if (current !== null) return readProjectInstallationManifestForMigration(root, { fsOps, hostIds: PROJECT_HOST_IDS2, manifestPath: INSTALLATION_MANIFEST_PATH });
  if (legacy !== null) return readProjectInstallationManifestForMigration(root, { fsOps, hostIds: PROJECT_HOST_IDS2, manifestPath: LEGACY_INSTALLATION_MANIFEST_PATH });
  throw new Error("Dove Upgrade requires an installation revision 1.0 manifest.");
}
function prepareLifecycleIntegration(root, options, { hosts, source = null, reinstall = false }) {
  const fsOps = options.fsOps ?? fs10;
  const entries = [];
  const scope = [];
  const manifestDigests = manifestDigestInventory(source);
  for (const relativePath of [MCP_PATH, DOVE_CLAUDE_SETTINGS_PATH, DOVE_CLAUDE_LOCAL_SETTINGS_PATH, ".opencode.json"]) {
    const entry = planRecognizedSharedCleanup(root, relativePath, fsOps, { installClaude: hosts.includes(CLAUDE_HOST) });
    if (entry) entries.push(entry);
  }
  for (const relativePath of RETIRED_EXCLUSIVE_PATHS) {
    const entry = knownRetiredFile(root, relativePath, fsOps, manifestDigests);
    if (entry) entries.push(entry);
  }
  for (const relativePath of [...PACKAGE_RUNTIME_PATHS, ...RETIRED_PACKAGE_RUNTIME_PATHS]) {
    const entry = knownCopiedRuntime(root, relativePath, fsOps);
    if (entry) entries.push(entry);
  }
  const desired = resourcesForHosts(hosts);
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
  if (reinstall) {
    const replacedPaths = new Set(planned.entries.filter((entry) => entry.delete !== true).map((entry) => entry.relativePath));
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (replacedPaths.has(entries[index].relativePath)) entries.splice(index, 1);
    }
  }
  const duplicatePaths = new Set(entries.map((entry) => entry.relativePath));
  for (const entry of planned.entries) {
    if (duplicatePaths.has(entry.relativePath)) continue;
    entries.push(entry);
  }
  if (reinstall) {
    const doveRoot = path10.join(root, ".dove");
    const doveStat = lstatOrNull4(fsOps, doveRoot);
    if (doveStat !== null) {
      if (doveStat.isSymbolicLink() || !doveStat.isDirectory()) throw new Error("Complete Reinstall requires .dove to be a real directory.");
      for (const child of fsOps.readdirSync(doveRoot).map(String).sort()) {
        if (child !== "install") walkDeletion(root, `.dove/${child}`, fsOps, entries, scope);
      }
      const installRoot = path10.join(doveRoot, "install");
      const installStat = lstatOrNull4(fsOps, installRoot);
      if (installStat !== null) {
        if (installStat.isSymbolicLink() || !installStat.isDirectory()) throw new Error("Complete Reinstall requires .dove/install to be a real directory.");
        for (const child of fsOps.readdirSync(installRoot).map(String).sort()) {
          if (child !== "manifest.json") walkDeletion(root, `.dove/install/${child}`, fsOps, entries, scope);
        }
      }
    }
    walkDeletion(root, ".dove-archive", fsOps, entries, scope);
    walkDeletion(root, ".dove-install", fsOps, entries, scope);
  } else if (source?.sourcePath === LEGACY_INSTALLATION_MANIFEST_PATH) {
    const legacyDirectory = lstatOrNull4(fsOps, path10.join(root, ".dove-install"));
    if (legacyDirectory?.isSymbolicLink() || legacyDirectory !== null && !legacyDirectory.isDirectory()) {
      throw new Error("Dove Upgrade requires .dove-install to be a real directory.");
    }
    const legacyChildren = legacyDirectory === null ? [] : fsOps.readdirSync(path10.join(root, ".dove-install")).map(String).sort();
    if (!sameArray(legacyChildren, ["manifest.json"])) {
      throw new Error("Dove Upgrade requires .dove-install to contain only its 1.0 manifest.");
    }
    const legacyObserved = inspectRegularProjectFile(root, LEGACY_INSTALLATION_MANIFEST_PATH, fsOps);
    entries.push(transactionDelete(root, { path: LEGACY_INSTALLATION_MANIFEST_PATH }, legacyObserved));
    if (legacyDirectory?.isDirectory()) {
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
  return { entries, manifest: planned.manifest, scope, desired };
}
function previewShape(kind, root, hosts, prepared, confirmationRequired) {
  const writtenPaths = prepared.entries.filter((entry) => entry.delete !== true).map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  return {
    status: "ready",
    action: kind,
    target: root,
    hosts: [...hosts],
    writtenPaths,
    removedPaths,
    changedPaths: [.../* @__PURE__ */ new Set([...writtenPaths, ...removedPaths])],
    destructiveScope: prepared.scope,
    confirmation: { required: confirmationRequired, default: false },
    manifest: prepared.manifest
  };
}
function previewProjectUpgrade(start, options = {}) {
  const fsOps = options.fsOps ?? fs10;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  const source = migrationSource(root, fsOps);
  const hosts = options.hosts === void 0 ? [...source.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source, reinstall: false });
  return previewShape("upgrade", root, hosts, prepared, false);
}
function upgradeProjectIntegration(start, options = {}) {
  const fsOps = options.fsOps ?? fs10;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  const source = migrationSource(root, fsOps);
  const hosts = options.hosts === void 0 ? [...source.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source, reinstall: false });
  return resultFromTransaction("upgraded", root, hosts, prepared.manifest, writeFileSetTransaction(prepared.entries, { fsOps }));
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
  return resultFromTransaction("reinstalled", root, hosts, prepared.manifest, writeFileSetTransaction(prepared.entries, { fsOps, transactionBase: ".dove-transaction" }));
}
var PROJECT_INTEGRATION_MANAGED_PATHS = Object.freeze(claudeResources().map((resource) => resource.path).sort());

// src/core/dove-lifecycle.mjs
function upgradeDoveLifecycle(start, options = {}) {
  const preview = previewProjectUpgrade(start, options);
  return upgradeProjectIntegration(start, { ...options, preview });
}
function completeReinstallDoveLifecycle(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Complete Reinstall requires confirmed: true.");
  const preview = previewProjectCompleteReinstall(start, options);
  return completeReinstallProjectIntegration(start, { ...options, preview });
}

// src/core/doctor-issues.mjs
function issue(issueId, category, severity, summary, action, detectedBy) {
  return { issueId, category, severity, summary, action, detectedBy };
}
function doctorIssuesFromInspection(inspection, options = {}) {
  const detectedBy = options.detectedBy ?? "doctor";
  const issues = [];
  if (inspection.userCli?.healthy === false) {
    issues.push(issue("dove-software-invalid", "software", "error", "Dove \u8F6F\u4EF6\u6216\u8FD0\u884C\u6587\u4EF6\u9700\u8981\u4FEE\u590D", "\u91CD\u65B0\u5B89\u88C5\u6216\u5347\u7EA7\u7528\u6237\u7EA7 Dove", detectedBy));
  }
  if (inspection.migrationInstallation?.state === "valid-legacy") {
    issues.push(issue("project-upgrade-available", "project-integration", "warning", "\u5F53\u524D\u9879\u76EE\u53EF\u4EE5\u4ECE\u65E7\u7248 Dove \u96C6\u6210\u5347\u7EA7", "dove upgrade", detectedBy));
  }
  if (inspection.projectIntegration?.state === "needs-sync") {
    issues.push(issue("project-needs-sync", "project-integration", "warning", "\u5F53\u524D\u9879\u76EE\u96C6\u6210\u9700\u8981\u66F4\u65B0", "dove sync", detectedBy));
  } else if (["invalid", "drifted"].includes(inspection.projectIntegration?.state)) {
    issues.push(issue("project-integration-invalid", "project-integration", "error", "\u5F53\u524D\u9879\u76EE\u96C6\u6210\u9700\u8981\u4EBA\u5DE5\u5904\u7406", "dove doctor", detectedBy));
  }
  if (inspection.workspaceState?.state === "previous-research-format") {
    issues.push(issue("research-format-export", "research-state", "warning", "\u65E7\u7248 JSON \u79D1\u7814\u8BB0\u5F55\u9700\u8981\u663E\u5F0F\u5BFC\u51FA\u4E3A Markdown", "dove export-research", detectedBy));
  } else if (inspection.workspaceState?.healthy === false) {
    issues.push(issue("research-state-invalid", "research-state", "error", "Dove \u7814\u7A76\u6587\u6863\u65E0\u6CD5\u5B89\u5168\u8BFB\u53D6", "dove doctor", detectedBy));
  }
  if (inspection.legacyCopiedRuntime?.detected === true || inspection.legacyCopiedRuntime?.healthy === false) {
    issues.push(issue("legacy-copied-runtime", "project-integration", "error", "\u5F53\u524D\u9879\u76EE\u4E2D\u53D1\u73B0\u65E7\u7248 Dove \u590D\u5236\u8FD0\u884C\u6587\u4EF6", "dove upgrade \u6216 dove reinstall", detectedBy));
  }
  return issues;
}

// src/core/doctor-store.mjs
import fs12 from "node:fs";
import path12 from "node:path";

// src/core/project-state-file.mjs
import crypto4 from "node:crypto";
import fs11 from "node:fs";
import path11 from "node:path";
function canonicalRoot3(root, fsOps) {
  const resolved = path11.resolve(root);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}
function normalizedPath(value) {
  const supplied = String(value).replace(/\\/gu, "/");
  const normalized = path11.posix.normalize(supplied);
  if (!supplied || supplied !== normalized || path11.posix.isAbsolute(normalized) || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) {
    throw new Error("Dove project state path must stay normalized inside the project.");
  }
  return normalized;
}
function inspectProjectStateFile(root, relativePath, options = {}) {
  const fsOps = options.fsOps ?? fs11;
  const normalized = normalizedPath(relativePath);
  const anchor = openAnchoredFilesystem(canonicalRoot3(root, fsOps), { ...options, fsOps });
  try {
    const current = currentFile(anchor, normalized);
    if (!current) return { content: null, state: { exists: false, type: "absent", sha256: null, mode: null } };
    let content;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(current.bytes);
    } catch (error) {
      throw new Error(`${normalized} must contain valid UTF-8 text.`, { cause: error });
    }
    return {
      content,
      state: {
        exists: true,
        type: "file",
        sha256: crypto4.createHash("sha256").update(current.bytes).digest("hex"),
        mode: current.mode
      }
    };
  } finally {
    anchor.close();
  }
}
function currentFile(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return null;
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`Dove project state target must be absent or a regular file: ${relativePath}.`);
  }
  return { bytes: anchor.readFile(relativePath), mode: stat.mode & 4095 };
}
function exactTimestamp3(value, label = "Timestamp") {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value;
}

// src/core/doctor-store.mjs
var DOCTOR_FIELDS = /* @__PURE__ */ new Set(["enabled", "issues", "updatedAt"]);
var ISSUE_FIELDS = /* @__PURE__ */ new Set(["issueId", "category", "severity", "summary", "firstSeenAt", "lastSeenAt", "occurrences", "action", "state", "detectedBy"]);
var ISSUE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var RESOLVED_LIMIT = 20;
var EMPTY_UPDATED_AT = (/* @__PURE__ */ new Date(0)).toISOString();
function assertPlainObject2(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  return value;
}
function assertFields2(value, fields, label) {
  assertPlainObject2(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
}
function text(value, label) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error(`${label} must be non-empty text.`);
  return value.trim();
}
function visibleText(value) {
  return String(value).replace(/\s+/gu, " ").replace(/`/gu, "'").trim();
}
function timestamp2(value) {
  return value === void 0 ? (/* @__PURE__ */ new Date()).toISOString() : exactTimestamp3(value, "Doctor timestamp");
}
function validateIssue(value, label = "Doctor issue") {
  assertFields2(value, ISSUE_FIELDS, label);
  if (typeof value.issueId !== "string" || !ISSUE_ID.test(value.issueId)) throw new Error(`${label}.issueId must be a safe identifier.`);
  text(value.category, `${label}.category`);
  if (!["info", "warning", "error"].includes(value.severity)) throw new Error(`${label}.severity is unsupported.`);
  text(value.summary, `${label}.summary`);
  exactTimestamp3(value.firstSeenAt, `${label}.firstSeenAt`);
  exactTimestamp3(value.lastSeenAt, `${label}.lastSeenAt`);
  if (!Number.isInteger(value.occurrences) || value.occurrences < 1) throw new Error(`${label}.occurrences must be a positive integer.`);
  text(value.action, `${label}.action`);
  if (!["open", "resolved"].includes(value.state)) throw new Error(`${label}.state is unsupported.`);
  text(value.detectedBy, `${label}.detectedBy`);
  return value;
}
function validateDoctorState(value) {
  assertFields2(value, DOCTOR_FIELDS, "Doctor state");
  if (typeof value.enabled !== "boolean") throw new Error("Doctor state.enabled must be boolean.");
  if (!Array.isArray(value.issues)) throw new Error("Doctor state.issues must be an array.");
  value.issues.forEach((issue2, index) => validateIssue(issue2, `Doctor state.issues[${index}]`));
  if (new Set(value.issues.map((issue2) => issue2.issueId)).size !== value.issues.length) throw new Error("Doctor state issue IDs must be unique.");
  exactTimestamp3(value.updatedAt, "Doctor state.updatedAt");
  return value;
}
function defaultState() {
  return { enabled: true, issues: [], updatedAt: EMPTY_UPDATED_AT };
}
function readSnapshot(root, options = {}) {
  const json = inspectProjectStateFile(root, ARTIFACT_PATHS.doctor, options);
  const document = inspectProjectStateFile(root, ARTIFACT_PATHS.doctorDocument, options);
  const state2 = json.content === null ? defaultState() : validateDoctorState(parseJsonWithoutDuplicateKeys(json.content, ARTIFACT_PATHS.doctor));
  if (document.content !== null && document.content !== renderDoctorDocument(state2)) {
    throw new Error(`${ARTIFACT_PATHS.doctorDocument} was changed outside Dove; Doctor refuses to overwrite it.`);
  }
  return { state: state2, json, document };
}
function readDoctorState(root, options = {}) {
  return readSnapshot(root, options).state;
}
function readDoctorDocument(root, options = {}) {
  const snapshot = readSnapshot(root, options);
  return {
    path: ARTIFACT_PATHS.doctorDocument,
    exists: snapshot.document.content !== null,
    markdown: snapshot.document.content
  };
}
function issueOrder(left, right) {
  const severity = { error: 0, warning: 1, info: 2 };
  return severity[left.severity] - severity[right.severity] || left.summary.localeCompare(right.summary) || left.issueId.localeCompare(right.issueId);
}
function renderDoctorDocument(state2) {
  validateDoctorState(state2);
  const open = state2.issues.filter((issue2) => issue2.state === "open").sort(issueOrder);
  const resolved = state2.issues.filter((issue2) => issue2.state === "resolved").sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt)).slice(0, RESOLVED_LIMIT);
  const lines = [
    "# Dove \u95EE\u9898",
    "",
    "\u6B64\u6587\u4EF6\u8BB0\u5F55 Dove \u8F6F\u4EF6\u548C\u9879\u76EE\u96C6\u6210\u95EE\u9898\uFF0C\u4E0D\u5224\u65AD\u79D1\u7814\u5185\u5BB9\u662F\u5426\u6B63\u786E\u3001\u5B8C\u6574\u6216\u5B8C\u6210\u3002",
    ""
  ];
  if (!state2.enabled) {
    lines.push("Doctor \u81EA\u52A8\u7EF4\u62A4\u5F53\u524D\u5DF2\u5173\u95ED\uFF1B\u4EE5\u4E0B\u5185\u5BB9\u53EF\u80FD\u662F\u5173\u95ED\u524D\u4FDD\u7559\u7684\u8BB0\u5F55\u3002", "");
  }
  lines.push("## \u5F53\u524D\u95EE\u9898", "");
  if (open.length === 0) lines.push("\u5F53\u524D\u6CA1\u6709\u5DF2\u8BB0\u5F55\u7684 Dove \u95EE\u9898\u3002");
  else for (const issue2 of open) {
    lines.push(`- ${visibleText(issue2.summary)}`, `  - \u5EFA\u8BAE\uFF1A\`${visibleText(issue2.action)}\``);
  }
  lines.push("", "## \u6700\u8FD1\u89E3\u51B3", "");
  if (resolved.length === 0) lines.push("\u6682\u65E0\u6700\u8FD1\u89E3\u51B3\u4E8B\u9879\u3002");
  else for (const issue2 of resolved) {
    lines.push(`- ${issue2.lastSeenAt.slice(0, 10)}\uFF1A\u5DF2\u89E3\u51B3\u201C${visibleText(issue2.summary)}\u201D\u3002`);
  }
  return `${lines.join("\n")}
`;
}
function sameState2(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function writeDoctorState(root, next, snapshot, options = {}) {
  validateDoctorState(next);
  const markdown = renderDoctorDocument(next);
  const jsonContent = `${JSON.stringify(next, null, 2)}
`;
  const entries = [];
  if (snapshot.json.content !== jsonContent) entries.push({
    root,
    relativePath: ARTIFACT_PATHS.doctor,
    content: jsonContent,
    force: true,
    expectedState: snapshot.json.state,
    label: "Doctor state"
  });
  if (snapshot.document.content !== markdown) entries.push({
    root,
    relativePath: ARTIFACT_PATHS.doctorDocument,
    content: markdown,
    force: true,
    expectedState: snapshot.document.state,
    label: "Doctor document"
  });
  if (entries.length > 0) writeFileSetTransaction(entries, {
    fsOps: options.fsOps,
    transactionBase: ARTIFACT_PATHS.transactionsDir,
    transactionId: options.transactionId
  });
  return next;
}
function commitChanged(root, current, next, snapshot, options) {
  if (sameState2(current, next) && snapshot.document.content !== null) return current;
  if (sameState2(current, next) && snapshot.json.content === null && snapshot.document.content === null) return current;
  return writeDoctorState(root, next, snapshot, options);
}
function setDoctorEnabled(root, enabled, options = {}) {
  if (typeof enabled !== "boolean") throw new Error("Doctor enabled state must be boolean.");
  const snapshot = readSnapshot(root, options);
  if (snapshot.state.enabled === enabled) return commitChanged(root, snapshot.state, snapshot.state, snapshot, options);
  const next = { ...snapshot.state, enabled, updatedAt: timestamp2(options.now) };
  return writeDoctorState(root, next, snapshot, options);
}
function normalizedIssue(issue2, seenAt, previous = null) {
  const issueId = text(issue2.issueId, "Doctor issueId");
  if (!ISSUE_ID.test(issueId)) throw new Error("Doctor issueId must be a safe identifier.");
  const next = {
    issueId,
    category: text(issue2.category, "Doctor issue category"),
    severity: issue2.severity,
    summary: text(issue2.summary, "Doctor issue summary"),
    firstSeenAt: previous?.firstSeenAt ?? seenAt,
    lastSeenAt: previous?.lastSeenAt ?? seenAt,
    occurrences: previous?.occurrences ?? 1,
    action: text(issue2.action, "Doctor issue action"),
    state: "open",
    detectedBy: text(issue2.detectedBy, "Doctor issue detectedBy")
  };
  validateIssue(next);
  return next;
}
function visibleIssueSame(left, right) {
  return left?.state === "open" && left.category === right.category && left.severity === right.severity && left.summary === right.summary && left.action === right.action && left.detectedBy === right.detectedBy;
}
function recordDoctorIssue(root, issue2, options = {}) {
  const snapshot = readSnapshot(root, options);
  const current = snapshot.state;
  if (!current.enabled && options.manual !== true) return current;
  const seenAt = timestamp2(options.now);
  const previous = current.issues.find((entry) => entry.issueId === issue2.issueId) ?? null;
  const candidate = normalizedIssue(issue2, seenAt, previous);
  if (visibleIssueSame(previous, candidate)) return commitChanged(root, current, current, snapshot, options);
  const nextIssue = { ...candidate, lastSeenAt: seenAt, occurrences: previous ? Math.min(previous.occurrences + 1, 9999) : 1 };
  const next = {
    enabled: current.enabled,
    issues: retainedIssues([...current.issues.filter((entry) => entry.issueId !== nextIssue.issueId), nextIssue]),
    updatedAt: seenAt
  };
  return writeDoctorState(root, next, snapshot, options);
}
function retainedIssues(issues) {
  const open = issues.filter((issue2) => issue2.state === "open");
  const resolved = issues.filter((issue2) => issue2.state === "resolved").sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt)).slice(0, RESOLVED_LIMIT);
  return [...open, ...resolved];
}
function resolveDoctorIssues(root, openIssueIds, options = {}) {
  const snapshot = readSnapshot(root, options);
  const current = snapshot.state;
  if (!current.enabled && options.manual !== true) return current;
  const open = new Set(openIssueIds);
  const changed = current.issues.some((issue2) => issue2.state === "open" && !open.has(issue2.issueId));
  if (!changed) return commitChanged(root, current, current, snapshot, options);
  const resolvedAt = timestamp2(options.now);
  const issues = current.issues.map((issue2) => issue2.state === "open" && !open.has(issue2.issueId) ? { ...issue2, state: "resolved", lastSeenAt: resolvedAt } : issue2);
  return writeDoctorState(root, { enabled: current.enabled, issues: retainedIssues(issues), updatedAt: resolvedAt }, snapshot, options);
}
function reconcileDoctorIssues(root, detectedIssues, options = {}) {
  const snapshot = readSnapshot(root, options);
  const current = snapshot.state;
  if (!current.enabled && options.manual !== true) return current;
  const scope = options.detectedBy === void 0 ? null : text(options.detectedBy, "Doctor reconcile detectedBy");
  const previousById = new Map(current.issues.map((issue2) => [issue2.issueId, issue2]));
  const seenAt = timestamp2(options.now);
  const detected = detectedIssues.map((issue2) => normalizedIssue(issue2, seenAt, previousById.get(issue2.issueId) ?? null));
  const detectedById = new Map(detected.map((issue2) => [issue2.issueId, issue2]));
  let changed = false;
  const reconciled = current.issues.filter((issue2) => !detectedById.has(issue2.issueId)).map((issue2) => {
    if (issue2.state === "open" && (scope === null || issue2.detectedBy === scope)) {
      changed = true;
      return { ...issue2, state: "resolved", lastSeenAt: seenAt };
    }
    return issue2;
  });
  for (const issue2 of detected) {
    const previous = previousById.get(issue2.issueId);
    if (visibleIssueSame(previous, issue2)) reconciled.push(previous);
    else {
      changed = true;
      reconciled.push({ ...issue2, lastSeenAt: seenAt, occurrences: previous ? Math.min(previous.occurrences + 1, 9999) : 1 });
    }
  }
  if (!changed) return commitChanged(root, current, current, snapshot, options);
  return writeDoctorState(root, { enabled: current.enabled, issues: retainedIssues(reconciled), updatedAt: seenAt }, snapshot, options);
}
function recordDoctorIssueBestEffort(root, issue2, options = {}) {
  try {
    if (!fs12.existsSync(path12.join(root, ARTIFACT_PATHS.installDir))) return false;
    recordDoctorIssue(root, issue2, options);
    return true;
  } catch {
    return false;
  }
}
function reconcileDoctorIssuesBestEffort(root, issues, options = {}) {
  try {
    if (!fs12.existsSync(path12.join(root, ARTIFACT_PATHS.installDir))) return false;
    reconcileDoctorIssues(root, issues, options);
    return true;
  } catch {
    return false;
  }
}

// src/core/project-doctor.mjs
import fs13 from "node:fs";
import path13 from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath as fileURLToPath3 } from "node:url";

// src/core/project-setup-classification.mjs
var ACTIONS = Object.freeze({
  init: Object.freeze(["init", "exit"]),
  reinstall: Object.freeze(["reinstall", "exit"]),
  blocked: Object.freeze(["exit"])
});
function setup(mode, reason) {
  return Object.freeze({ mode, reason, allowedActions: ACTIONS[mode] });
}
function classifyProjectSetup(result) {
  const integration = result?.projectIntegration ?? {};
  const migration = result?.migrationInstallation ?? { state: "absent", upgrade: { ready: false }, reinstall: { ready: false } };
  const workspace = result?.workspaceState ?? { mode: "unavailable", healthy: false };
  const copiedRuntime = result?.legacyCopiedRuntime?.detected === true;
  const reinstallReady = migration.reinstall?.ready === true;
  if (migration.state === "conflicting-manifests") {
    return reinstallReady ? setup("reinstall", "conflicting-manifests") : setup("blocked", "conflicting-manifests");
  }
  if (migration.state === "valid-legacy") return setup("blocked", "valid-legacy");
  if (migration.state === "invalid-legacy") {
    return reinstallReady ? setup("reinstall", "invalid-legacy") : setup("blocked", "invalid-legacy");
  }
  if (["invalid", "drifted"].includes(integration.state)) return setup("blocked", integration.state);
  if (copiedRuntime) return setup("blocked", "legacy-copied-runtime");
  if (["current", "needs-sync"].includes(integration.state)) return setup("reinstall", integration.state);
  if (workspace.mode !== "absent") {
    return reinstallReady ? setup("reinstall", "unsupported-workspace") : setup("blocked", "unsupported-workspace");
  }
  return setup("init", "clean-uninitialized");
}

// src/core/project-doctor.mjs
var MODULE_DIRECTORY = path13.dirname(fileURLToPath3(import.meta.url));
var DEFAULT_PACKAGE_ROOT = path13.resolve(MODULE_DIRECTORY, "../..");
function messageFor2(error) {
  return error instanceof Error ? error.message : String(error);
}
function plainObject6(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function lstatOrNull5(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function regularNonSymlink(fsOps, targetPath) {
  const stat = lstatOrNull5(fsOps, targetPath);
  return stat !== null && stat.isFile() && !stat.isSymbolicLink();
}
function defaultInspectPathExecutable() {
  const result = spawnSync("which", ["dove"], { encoding: "utf8", shell: false, timeout: 5e3, maxBuffer: 64 * 1024 });
  if (result.error?.code === "ENOENT" || result.status !== 0) return { found: false, path: null, usable: false, state: "unavailable" };
  const executablePath = String(result.stdout ?? "").split(/\r?\n/u).map((item) => item.trim()).find(Boolean) ?? null;
  return { found: executablePath !== null, path: executablePath, usable: executablePath !== null, state: executablePath ? "found" : "unavailable" };
}
function inspectUserCli(options) {
  const fsOps = options.fsOps ?? fs13;
  const packageRoot = path13.resolve(options.packageRoot ?? DEFAULT_PACKAGE_ROOT);
  const runtimePaths = (options.packageRuntimePaths ?? PACKAGE_RUNTIME_PATHS).map((relativePath) => {
    const absolutePath = path13.resolve(packageRoot, relativePath);
    const relative = path13.relative(packageRoot, absolutePath);
    const contained = relative !== "" && !relative.startsWith("..") && !path13.isAbsolute(relative);
    const healthy2 = contained && regularNonSymlink(fsOps, absolutePath);
    return { path: relativePath, healthy: healthy2, state: healthy2 ? "current" : contained ? "missing-or-invalid" : "outside-package-root" };
  });
  const executablePath = path13.resolve(options.executablePath ?? path13.join(packageRoot, "bin/dove-package.mjs"));
  const executableRelative = path13.relative(packageRoot, executablePath);
  const executableContained = executableRelative === "" || !executableRelative.startsWith("..") && !path13.isAbsolute(executableRelative);
  let pathExecutable;
  try {
    const inspected = options.inspectPathExecutable ? options.inspectPathExecutable({ command: "dove", packageRoot, executablePath }) : defaultInspectPathExecutable();
    pathExecutable = plainObject6(inspected) ? { found: inspected.found === true || typeof inspected.path === "string", path: inspected.path ?? null, usable: inspected.usable === true || inspected.found === true, state: inspected.state ?? "unknown" } : { found: false, path: null, usable: false, state: "invalid-result" };
  } catch (error) {
    pathExecutable = { found: false, path: null, usable: false, state: "failed", message: messageFor2(error) };
  }
  const executableHealthy = executableContained && regularNonSymlink(fsOps, executablePath);
  const executable = { path: executablePath, healthy: executableHealthy, state: executableHealthy ? "current" : "missing-or-invalid" };
  const healthy = runtimePaths.every((entry) => entry.healthy) && executable.healthy && pathExecutable.usable;
  return {
    healthy,
    state: healthy ? "healthy" : "unhealthy",
    package: { name: options.packageName ?? null, version: options.packageVersion ?? null, root: packageRoot },
    runtimePaths,
    executable,
    pathExecutable,
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
  const fsOps = options.fsOps ?? fs13;
  const current = lstatOrNull5(fsOps, path13.join(root, INSTALLATION_MANIFEST_PATH));
  const legacy = lstatOrNull5(fsOps, path13.join(root, LEGACY_INSTALLATION_MANIFEST_PATH));
  const migrationPath = legacy ? LEGACY_INSTALLATION_MANIFEST_PATH : current ? INSTALLATION_MANIFEST_PATH : null;
  const result = (state2, fields = {}) => ({ state: state2, root, markerPath: migrationPath, upgrade: { ready: false, error: null, preview: null }, reinstall: { ready: false, error: null, preview: null }, ...fields });
  if (current && legacy) return result("conflicting-manifests", { error: "Dove found both current and 1.0 installation manifests." });
  if (!legacy && !current) {
    const legacyDirectory = lstatOrNull5(fsOps, path13.join(root, ".dove-install"));
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
    const upgrade = (() => {
      try {
        return { ready: true, error: null, preview: previewProjectUpgrade(root, options) };
      } catch (error) {
        return { ready: false, error: messageFor2(error), preview: null };
      }
    })();
    const reinstall = (() => {
      try {
        return { ready: true, error: null, preview: previewProjectCompleteReinstall(root, options) };
      } catch (error) {
        return { ready: false, error: messageFor2(error), preview: null };
      }
    })();
    return result(upgrade.ready ? "valid-legacy" : "invalid-legacy", { error: upgrade.error, manifest: { path: migrationPath, revision: manifest.revision, package: manifest.package, runtime: manifest.runtime, hosts: [...manifest.hosts] }, upgrade, reinstall });
  } catch (error) {
    return result("invalid-legacy", { error: messageFor2(error) });
  }
}
function researchState(root, options) {
  if (!root) return { healthy: false, state: "unavailable", mode: "unavailable", error: "Project root is unavailable." };
  try {
    const inspected = (options.inspectResearchDocuments ?? inspectResearchDocuments)(root, { fsOps: options.fsOps });
    if (!plainObject6(inspected)) throw new Error("Research document inspection returned an invalid result.");
    const mode = inspected.state === "absent" ? "absent" : inspected.state === "previous-research-format" ? "previous-research-format" : inspected.healthy === true ? "current" : "invalid";
    return { ...inspected, mode, healthy: inspected.healthy === true };
  } catch (error) {
    return { healthy: false, state: "invalid", mode: "invalid", error: messageFor2(error) };
  }
}
function inspectLegacy(root, options) {
  if (!root) return { state: "unavailable", detected: false, healthy: true, root: null, copiedRuntimeHits: [] };
  try {
    const result = inspectRetiredCopiedRuntime(root, { fsOps: options.fsOps });
    return { ...result, healthy: !result.detected };
  } catch (error) {
    return { state: "invalid", detected: false, healthy: false, root, copiedRuntimeHits: [], error: messageFor2(error) };
  }
}
function actionsFor(result) {
  const actions = [];
  const upgradeReady = result.migrationInstallation.state === "valid-legacy";
  if (upgradeReady) actions.push({ kind: "upgrade", command: "dove upgrade" });
  if (!upgradeReady && result.workspaceState.state === "previous-research-format") actions.push({ kind: "export-research", command: "dove export-research" });
  else if (!upgradeReady && result.setup.mode === "init") actions.push({ kind: "init", command: "dove init" });
  else if (!upgradeReady && result.projectIntegration.state === "needs-sync") actions.push({ kind: "sync", command: "dove sync" });
  else if (!upgradeReady && result.setup.mode === "reinstall") actions.push({ kind: "reinstall", command: "dove reinstall" });
  else if (!upgradeReady && result.setup.mode === "blocked") actions.push({ kind: "inspect", command: "dove doctor --json" });
  return actions;
}
function inspectProjectDoctor(start, options = {}) {
  const userCli = inspectUserCli(options);
  let setupRoot = null;
  try {
    setupRoot = resolveProjectRootForSetup(start, { fsOps: options.fsOps });
  } catch {
    setupRoot = typeof start === "string" ? path13.resolve(start) : null;
  }
  const projectIntegration = inspectIntegration(start, options);
  const safeRoot = projectIntegration.root ?? setupRoot;
  const migrationInstallation = safeRoot ? inspectMigration(safeRoot, options) : { state: "absent", root: null, upgrade: { ready: false }, reinstall: { ready: false }, error: "Project root is unavailable." };
  const workspaceState = researchState(safeRoot, options);
  const legacyCopiedRuntime = inspectLegacy(safeRoot, options);
  const setup2 = classifyProjectSetup({ projectIntegration, migrationInstallation, workspaceState, legacyCopiedRuntime });
  const ready = userCli.healthy && projectIntegration.healthy && workspaceState.healthy && legacyCopiedRuntime.healthy;
  const result = {
    ready,
    state: ready ? "ready" : "attention",
    target: safeRoot,
    userCli,
    projectIntegration,
    migrationInstallation,
    workspaceState,
    legacyCopiedRuntime,
    setup: setup2
  };
  result.actions = actionsFor(result);
  return result;
}
export {
  ARTIFACT_PATHS,
  COMMAND_SURFACES,
  COMMAND_SURFACE_BY_ID,
  DOVE_PRIMARY_ROLES,
  HOST_ADAPTERS,
  HOST_ADAPTER_POLICY,
  PACKAGE_NAME,
  PACKAGE_VERSION,
  PROJECT_HOST_IDS,
  RESEARCH_DOCUMENT_PATHS,
  USER_RESPONSE_POLICY,
  allGeneratedCommandAdapterPaths,
  ambientContextForPrompt,
  classifyLessonsIntent,
  commandAdapterPathsForHost,
  completeReinstallDoveLifecycle,
  completeReinstallProjectIntegration,
  doctorIssuesFromInspection,
  exportResearch,
  generatedRoleDefinitionEntries,
  initializeProjectIntegration,
  inspectProjectDoctor,
  inspectProjectIntegration,
  inspectResearchDocuments,
  isHighConfidenceAmbientWorkPrompt,
  lessonsContextForPrompt,
  previewProjectCompleteReinstall,
  previewProjectUpgrade,
  previewResearchExport,
  readDoctorDocument,
  readDoctorState,
  reconcileDoctorIssues,
  reconcileDoctorIssuesBestEffort,
  recordDoctorIssue,
  recordDoctorIssueBestEffort,
  renderClaudeAmbientRule,
  renderClaudeAmbientSkill,
  renderClaudeLessonsIntakeSkill,
  renderClaudeReviewerAgent,
  renderDoctorDocument,
  renderOpenCodeReviewerAgent,
  renderOpenCodeRoleSkill,
  resolveDoctorIssues,
  reviewerPrompt,
  setDoctorEnabled,
  syncProjectIntegration,
  upgradeDoveLifecycle,
  upgradeProjectIntegration,
  userPromptSubmitOutput,
  validateDoctorState
};

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { initializeProjectIntegration } from "../../src/core/project-installation.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../../src/core/package-metadata.mjs";
import { USER_ORIGINALS_PATH, USER_ORIGINALS_INDEX_PATH } from "../../src/core/user-originals.mjs";
import { sessionStartOutput, userOriginalSourceContext } from "../../src/core/session-start-hook.mjs";
import { DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP } from "../../src/core/dove-author-preferences.mjs";
import { DOVE_RESEARCH_REFLECTION_CONTINUITY } from "../../src/core/dove-research-contract.mjs";
import { renderUninstallInventory } from "../../src/cli/terminal-output.mjs";

// The hooks consult the user-level hostMigration switch; keep it virtual and absent.
const env = { HOME: "/virtual-home", XDG_CONFIG_HOME: "/virtual-config" };
const absentSettings = (target) => String(target).startsWith("/virtual-config/");
const enoent = () => { throw Object.assign(new Error("absent"), { code: "ENOENT" }); };
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCRATCH = path.resolve(process.env.TMPDIR || path.join(ROOT, ".claude/tmp"));
const BINARIES = ["bin/dove.mjs", "bin/dove-package.mjs"];
const OWN_LINE = /^- \d{4}-\d{2}-\d{2} \d{2}:\d{2} · 本人 · /u;
const INCOMPLETE = /未(?:扫描|整理|完成)|不完整|incomplete|pending|partial/iu;
const userRecord = (timestamp, content, extra = {}) => JSON.stringify({ type: "user", timestamp, message: { role: "user", content }, ...extra });
const ownLine = (timestamp, text) => `- ${timestamp.slice(0, 16).replace("T", " ")} · 本人 · ${text}`;
const ownLines = (text) => text.split("\n").filter((line) => OWN_LINE.test(line));
const context = (output) => output.hookSpecificOutput.additionalContext;

function fixture(t) {
  fs.mkdirSync(SCRATCH, { recursive: true });
  const root = fs.mkdtempSync(path.join(SCRATCH, "dove-session-originals-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, "synthetic project");
  const home = path.join(root, "home");
  const fixtureEnv = { ...process.env, HOME: home, XDG_CONFIG_HOME: path.join(root, "config"), npm_config_prefix: path.join(root, "prefix") };
  fs.mkdirSync(project);
  initializeProjectIntegration(project, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"], env: fixtureEnv });
  const session = path.join(home, ".claude/projects", project.replace(/[^A-Za-z0-9]/gu, "-"), "session.jsonl");
  fs.mkdirSync(path.dirname(session), { recursive: true });
  fs.writeFileSync(session, "");
  const pointer = path.join(root, "host-source-pointer.jsonl");
  fs.writeFileSync(pointer, `${userRecord("2026-10-16T15:00:00Z", "POINTER_NOT_AN_OWN_QUOTE")}\n`);
  const card = "Current round: rounds/003-brief.md\nRound status: ongoing\nMainline: Synthetic user goal\n";
  for (const [relative, content] of [
    [".dove/research/IDENTITY.md", card],
    [".dove/research/EVAL.md", "SYNTHETIC_RESEARCH_NOT_TO_READ\n"],
    [".dove/research/watch/config.json", '{"enabled":false}\n'],
    [".dove/reviews/synthetic/review.json", '{"private":"SYNTHETIC_REVIEW_NOT_TO_READ"}\n'],
    [".dove/runs/synthetic/run.jsonl", '{"private":"SYNTHETIC_RUN_NOT_TO_READ"}\n'],
    [".dove/install/unrelated.txt", "Preserve unrelated installation files.\n"]
  ]) {
    const target = path.join(project, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return { root, project, home, session, pointer, card, env: fixtureEnv, cachePaths: [USER_ORIGINALS_PATH, USER_ORIGINALS_INDEX_PATH].map((relative) => path.join(project, relative)) };
}

function snapshot(root, cachePaths = []) {
  const entries = [];
  const visit = (target) => {
    if (cachePaths.includes(target)) return;
    const stat = fs.lstatSync(target, { bigint: true });
    entries.push({
      path: path.relative(root, target), mode: stat.mode,
      // Atomic cache replacement changes its existing parent directory's mtime.
      // Keep that directory in the inventory; ignore no other paths or mtimes.
      mtime: cachePaths.some((file) => path.dirname(file) === target) ? null : stat.mtimeNs,
      bytes: stat.isFile() ? fs.readFileSync(target) : null,
      link: stat.isSymbolicLink() ? fs.readlinkSync(target) : null
    });
    if (stat.isDirectory()) for (const child of fs.readdirSync(target).sort()) visit(path.join(target, child));
  };
  visit(root);
  return entries;
}

function payloadFor(store, source) {
  return { hook_event_name: "SessionStart", source, cwd: store.project, transcript_path: store.pointer };
}

function reanchor(output, payload = {}) {
  const text = context(output);
  assert.ok(text.includes(DOVE_RESEARCH_REFLECTION_CONTINUITY));
  const suffix = text.slice(text.indexOf(DOVE_RESEARCH_REFLECTION_CONTINUITY) + DOVE_RESEARCH_REFLECTION_CONTINUITY.length);
  const pointer = userOriginalSourceContext(payload);
  assert.ok(suffix.endsWith(pointer));
  return (pointer ? suffix.slice(0, -pointer.length) : suffix).trim();
}

function invokeCli(binary, store, source, preload = "") {
  const args = preload ? ["--import", `data:text/javascript,${encodeURIComponent(preload)}`] : [];
  const result = spawnSync(process.execPath, [...args, path.join(ROOT, binary), "hook", "session-start", "--project", store.project], {
    cwd: store.project, input: JSON.stringify(payloadFor(store, source)), encoding: "utf8", timeout: 15_000, env: store.env
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput?.hookEventName, "SessionStart");
  return output;
}

function seedOriginals(store) {
  const entries = [0, 1].map((number) => ({ timestamp: `2026-10-16T10:0${number}:00Z`, text: `EARLIER_OWN_${number}_NOT_IN_LAST_FOUR` }));
  for (const [number, length] of [399, 400, 401, 850].entries()) {
    const timestamp = `2026-10-16T11:0${number}:00Z`;
    const marker = `UNICODE_OWN_${length}_`;
    entries.push({ timestamp, text: marker + "\u{20000}".repeat(length - Array.from(ownLine(timestamp, marker)).length) });
  }
  const noise = [
    userRecord("2026-10-16T12:00:00Z", "主会话 Claude，RELAY_NOT_AN_OWN_QUOTE"),
    userRecord("2026-10-16T12:00:30Z", "Claude 代用户转达：RELAY_FORMAT_NOT_AN_OWN_QUOTE"),
    userRecord("2026-10-16T12:00:45Z", "用户 2026-10-16 决定：RELAY_DECISION_NOT_AN_OWN_QUOTE"),
    userRecord("2026-10-16T12:01:00Z", "META_NOT_AN_OWN_QUOTE", { isMeta: true }),
    userRecord("2026-10-16T12:02:00Z", "COMPACT_SUMMARY_NOT_AN_OWN_QUOTE", { isCompactSummary: true }),
    userRecord("2026-10-16T12:03:00Z", "SIDECHAIN_NOT_AN_OWN_QUOTE", { isSidechain: true }),
    userRecord("2026-10-16T12:04:00Z", "<task-notification>TASK_NOT_AN_OWN_QUOTE</task-notification>"),
    userRecord("2026-10-16T12:04:10Z", "【用户指出资源浪费，需要改】BRACKET_RELAY_NOT_AN_OWN_QUOTE"),
    userRecord("2026-10-16T12:04:20Z", "用户 2026-10-16 诊断结论与新指令：DATED_RELAY_NOT_AN_OWN_QUOTE"),
    userRecord("2026-10-16T12:04:30Z", "用户授权 013 重试：AUTHORIZATION_RELAY_NOT_AN_OWN_QUOTE"),
    userRecord("2026-10-16T12:05:00Z", [{ type: "tool_result", tool_use_id: "synthetic", content: "TOOL_NOT_AN_OWN_QUOTE" }]),
    JSON.stringify({ type: "assistant", timestamp: "2026-10-16T12:06:00Z", message: { role: "assistant", content: "ASSISTANT_NOT_AN_OWN_QUOTE" } }),
    userRecord(undefined, "UNDATED_NOT_AN_OWN_QUOTE")
  ];
  fs.writeFileSync(store.session, [...entries.map(({ timestamp, text }) => userRecord(timestamp, [{ type: "text", text }])), ...noise, ""].join("\n"));
  const unrelated = path.join(store.home, ".claude/projects/unrelated-project/session.jsonl");
  const task = path.join(path.dirname(store.session), "session/subagents/agent-task.jsonl");
  for (const file of [unrelated, task]) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${userRecord("2026-10-16T13:00:00Z", "OUTSIDE_SESSION_NOT_AN_OWN_QUOTE")}\n`);
  }
  return entries;
}

function assertQuotes(output, entries) {
  const text = context(output);
  const quotes = ownLines(text);
  const expected = entries.slice(-4);
  assert.equal(quotes.length, expected.length, "only the last four dated own entries are injected");
  for (const [index, entry] of expected.entries()) {
    const full = ownLine(entry.timestamp, entry.text);
    const characters = Array.from(quotes[index]);
    assert.ok(characters.length <= 400, "each whole dated quote has at most 400 Unicode characters");
    assert.equal(quotes[index].isWellFormed(), true, "a supplementary Unicode character must not be split");
    if (Array.from(full).length <= 400) assert.equal(quotes[index], full, "quotes at the boundary are retained intact");
    else {
      assert.equal(characters.length, 400);
      assert.deepEqual(characters.slice(0, 399), Array.from(full).slice(0, 399));
    }
  }
  assert.doesNotMatch(text, /NOT_AN_OWN_QUOTE|NOT_IN_LAST_FOUR|SYNTHETIC_(?:RESEARCH|REVIEW|RUN)_NOT_TO_READ/u);
}

function privateTranscriptGuard(store, { failRefresh = false } = {}) {
  return `
    import fs from "node:fs";
    import path from "node:path";
    import { fileURLToPath } from "node:url";
    import { syncBuiltinESMExports } from "node:module";
    const project = ${JSON.stringify(store.project)};
    const session = ${JSON.stringify(store.session)};
    const pointer = ${JSON.stringify(store.pointer)};
    const failRefresh = ${JSON.stringify(failRefresh)};
    const check = (target) => {
      if (typeof target === "number") return;
      const file = path.resolve(target instanceof URL ? fileURLToPath(target) : String(target));
      const relative = path.relative(project, file).split(path.sep).join("/");
      if ((file.endsWith(".jsonl") && file !== session) || file === pointer
        || (relative.startsWith(".dove/research/") && relative !== ".dove/research/IDENTITY.md")
        || relative.startsWith(".dove/reviews/") || relative.startsWith(".dove/runs/")) {
        process.stderr.write("Unexpected SessionStart read: " + file + "\\n");
        throw new Error("Unexpected SessionStart read");
      }
      if (failRefresh && file === session) throw new Error("synthetic refresh failure");
    };
    for (const name of ["readFileSync", "openSync", "createReadStream"]) {
      const original = fs[name];
      fs[name] = function(target, ...args) { check(target); return original.call(this, target, ...args); };
    }
    syncBuiltinESMExports();
  `;
}

test("SessionStart startup and clear anchor the canonical bootstrap to the validated project root", () => {
  const project = path.resolve("synthetic project");
  const reference = path.join(project, ".dove/install/AUTHOR_PREFERENCES.md");
  const qualityReference = path.join(project, ".dove/install/RESEARCH_QUALITY.md");
  for (const source of ["startup", "clear"]) {
    for (const status of ["current", "needs-update"]) {
      const output = sessionStartOutput({ source, cwd: path.join(project, "nested") }, { status }, { project, env });
      assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
      const context = output.hookSpecificOutput.additionalContext;
      assert.ok(context.includes(`\`${reference}\``));
      assert.ok(context.includes(`\`${qualityReference}\``));
      assert.equal(context.replace(reference, ".dove/install/AUTHOR_PREFERENCES.md").replace(qualityReference, ".dove/install/RESEARCH_QUALITY.md"), DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP);
      assert.doesNotMatch(context, /offsets|EOF|beginning to end|_FULL\.md/u);
      assert.equal(Boolean(output.systemMessage), status !== "current");
    }
    for (const project of [undefined, "relative-project"]) {
      assert.throws(() => sessionStartOutput({ source }, null, { project }), /absolute project root/u);
    }
  }
});

test("SessionStart compact and resume refresh isolated user originals with source and packaged CLI parity", (t) => {
  const store = fixture(t);
  const protectedBefore = snapshot(store.project, store.cachePaths);
  const originalRead = fs.readFileSync;
  const fsReads = [];
  const fsOps = Object.create(fs);
  fsOps.readFileSync = (target, ...args) => {
    fsReads.push(path.resolve(String(target)));
    if (path.resolve(String(target)) === store.pointer) assert.fail("SessionStart must not read the transcript_path source pointer");
    return originalRead.call(fs, target, ...args);
  };
  const sourceInvoke = (source) => sessionStartOutput(payloadFor(store, source), { status: "current" }, {
    project: store.project, home: store.home, env: store.env, fsOps
  });

  for (const source of ["startup", "clear"]) {
    const output = sourceInvoke(source);
    assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
    assert.deepEqual(ownLines(context(output)), []);
    assert.deepEqual(snapshot(store.project, store.cachePaths), protectedBefore, "startup and clear do not refresh the derived cache");
  }
  assert.deepEqual(store.cachePaths.filter((target) => fs.existsSync(target)), [], "startup and clear do not create original-user caches");

  const entries = seedOriginals(store);
  const sourceOutput = sourceInvoke("compact");
  assertQuotes(sourceOutput, entries);
  assert.ok(fsReads.includes(path.resolve(store.cachePaths[0])), "the derived summary is read through the supplied fsOps");
  assert.ok(context(sourceOutput).includes(store.card.trimEnd()));
  assert.deepEqual(snapshot(store.project, store.cachePaths), protectedBefore, "compact changes no research, card, or configuration files");

  for (const binary of BINARIES) {
    for (const file of store.cachePaths) fs.rmSync(file);
    const before = snapshot(store.root, store.cachePaths);
    const output = invokeCli(binary, store, "compact", privateTranscriptGuard(store));
    assert.deepEqual(output, sourceOutput, `${binary} refreshes absent caches and matches the source hook output`);
    assertQuotes(output, entries);
    assert.deepEqual(snapshot(store.root, store.cachePaths), before);
  }

  for (const source of ["compact", "resume"]) {
    const priorCaches = store.cachePaths.map((file) => fs.readFileSync(file));
    const priorIndex = JSON.parse(priorCaches[1]).files[store.session];
    assert.equal(priorIndex.offset, fs.statSync(store.session).size);
    const appended = { timestamp: `2026-10-16T14:0${source === "compact" ? 0 : 1}:00Z`, text: `${source === "compact" ? "Claude Code 的钩子请继续修正。" : "我授权继续这次修复。"}APPENDED_OWN_${source}_NEW_REQUEST` };
    fs.appendFileSync(store.session, `${userRecord(appended.timestamp, appended.text)}\n`);
    entries.push(appended);
    const expected = sourceInvoke(source);
    const nextIndex = JSON.parse(fs.readFileSync(store.cachePaths[1], "utf8")).files[store.session];
    assert.equal(nextIndex.offset, fs.statSync(store.session).size);
    assert.deepEqual(nextIndex.entries.slice(0, priorIndex.entries.length), priorIndex.entries);
    assert.equal(nextIndex.entries.length, priorIndex.entries.length + 1, "refresh adds just the appended own entry");
    assertQuotes(expected, entries);
    for (const binary of BINARIES) {
      store.cachePaths.forEach((file, index) => fs.writeFileSync(file, priorCaches[index]));
      const before = snapshot(store.root, store.cachePaths);
      const output = invokeCli(binary, store, source, privateTranscriptGuard(store));
      assert.deepEqual(output, expected, `${binary} incrementally refreshes ${source} from the previous offset`);
      assertQuotes(output, entries);
      assert.deepEqual(JSON.parse(fs.readFileSync(store.cachePaths[1], "utf8")).files[store.session], nextIndex);
      assert.deepEqual(snapshot(store.root, store.cachePaths), before);
    }
    assert.deepEqual(snapshot(store.project, store.cachePaths), protectedBefore, `${source} changes no project-owned research or configuration`);
  }

  fs.appendFileSync(store.session, `${userRecord("2026-10-16T15:02:00Z", "FAILURE_TRIGGER_NOT_EMITTED")}\n`);
  const stale = "# stale cache\n- 2026-10-16 15:00 · 本人 · STALE_QUOTE_MUST_NOT_BE_EMITTED\n";
  fs.writeFileSync(store.cachePaths[0], stale);
  const failingFsOps = Object.create(fs);
  failingFsOps.openSync = () => { throw new Error("synthetic session read failure"); };
  const failed = sessionStartOutput(payloadFor(store, "resume"), { status: "current" }, {
    project: store.project, home: store.home, env: store.env, fsOps: failingFsOps
  });
  const failedContext = reanchor(failed, payloadFor(store, "resume"));
  assert.ok(failedContext.length > 0, "refresh failure still provides the compact/resume explanation");
  assert.doesNotMatch(failedContext, /STALE_QUOTE_MUST_NOT_BE_EMITTED/u);
  assert.deepEqual(ownLines(failedContext), [], "cached stale quotes are not emitted after refresh failure");
});

test("SessionStart marks an unfinished original-user scan as incomplete without reading the source pointer", (t) => {
  const store = fixture(t);
  const records = [0, 1, 2].map((index) => `${userRecord(`2026-10-16T16:0${index}:00Z`, `PENDING_OWN_ENTRY_${index}`)}\n`);
  fs.writeFileSync(store.session, records.join(""));
  const fsOps = Object.create(fs);
  let now = 10_000;
  let reads = 0;
  t.mock.method(Date, "now", () => now);
  fsOps.readSync = (fd, buffer, offset, length, position) => {
    const count = fs.readSync(fd, buffer, offset, Math.min(length, Buffer.byteLength(records[reads] ?? "")), position);
    now += reads++ === 0 ? 1499 : 1;
    return count;
  };
  const before = snapshot(store.root, store.cachePaths);
  const output = sessionStartOutput(payloadFor(store, "compact"), { status: "current" }, {
    project: store.project, home: store.home, env: store.env, fsOps, budgetMs: 99_999
  });
  const delivered = reanchor(output, payloadFor(store, "compact"));
  assert.equal(reads, 2, "the hook enforces its 1500 ms scan budget instead of the supplied general budget");
  assert.equal(ownLines(delivered).length, 2);
  assert.match(delivered, INCOMPLETE, "unfinished scan coverage is explicitly marked incomplete");
  assert.deepEqual(snapshot(store.root, store.cachePaths), before);
});

test("user-original source helper returns only a source hint without reading or copying history", (t) => {
  const read = t.mock.method(fs, "readFileSync", () => assert.fail("source hint must not read any file"));
  for (const transcript_path of [undefined, null, "", 42, {}]) {
    assert.equal(userOriginalSourceContext({ transcript_path }), "");
  }
  const transcript_path = '/unread/用户 "source"\n.jsonl';
  const payload = { transcript_path, prompt: "CURRENT_USER_BODY_NOT_TO_COPY", transcript: "PARENT_HISTORY_NOT_TO_COPY" };
  const before = { ...payload };
  const hint = userOriginalSourceContext(payload);
  assert.ok(hint.includes(JSON.stringify(transcript_path)));
  assert.match(hint, /mentor.*last-read date\/range.*dated user originals.*not execution records/iu);
  assert.match(hint, /current user's exact words.*not yet in the file/iu);
  assert.doesNotMatch(hint, /CURRENT_USER_BODY_NOT_TO_COPY|PARENT_HISTORY_NOT_TO_COPY|\d{4}-\d{2}-\d{2}/u);
  assert.deepEqual(payload, before);
  assert.equal(read.mock.callCount(), 0);
});

test("SessionStart startup and clear append the original-user pointer without reading its source", (t) => {
  const read = t.mock.method(fs, "readFileSync", (target) => absentSettings(target) ? enoent() : assert.fail("startup source handoff must not read files"));
  const project = "/virtual-session-project";
  for (const source of ["startup", "clear"]) {
    const payload = { source, transcript_path: "/never-read-transcript" };
    const base = sessionStartOutput({ source }, { status: "current" }, { project, env });
    const output = sessionStartOutput(payload, { status: "current" }, { project, env });
    assert.equal(output.hookSpecificOutput.additionalContext, base.hookSpecificOutput.additionalContext + userOriginalSourceContext(payload));
    assert.equal(output.systemMessage, undefined);
  }
  assert.ok(read.mock.calls.every(({ arguments: [target] }) => absentSettings(target)));
});

test("uninstall inventory separates deleted files from retained shared configuration edits", () => {
  const preview = {
    action: "uninstall",
    target: path.resolve("synthetic project"),
    removedPaths: [".dove/install/manifest.json"],
    writtenPaths: [".claude/settings.json", ".mcp.json", "shared.json"]
  };
  const output = renderUninstallInventory(preview);
  const deletion = output.slice(output.indexOf("将删除"), output.indexOf("将修改共享配置"));
  assert.match(deletion, /- \.dove\/install\/manifest\.json/u);
  assert.doesNotMatch(deletion, /settings\.json|\.mcp\.json/u);
  assert.match(output, /将修改共享配置（文件保留，仅移除 Dove 片段）\n- \.claude\/settings\.json\n- \.mcp\.json\n- shared\?\.json/u);
  assert.match(output, /取消不会修改任何文件/u);
  assert.match(renderUninstallInventory({ ...preview, writtenPaths: [] }), /将修改共享配置[^\n]*\n- 无/u);
});

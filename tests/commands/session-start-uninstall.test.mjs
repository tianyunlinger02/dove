import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { sessionStartOutput, userOriginalSourceContext } from "../../src/core/session-start-hook.mjs";
import { DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP } from "../../src/core/dove-author-preferences.mjs";
import { DOVE_RESEARCH_REFLECTION_CONTINUITY } from "../../src/core/dove-research-contract.mjs";
import { renderUninstallInventory } from "../../src/cli/terminal-output.mjs";

// The hooks consult the user-level hostMigration switch; keep it virtual and absent.
const env = { HOME: "/virtual-home", XDG_CONFIG_HOME: "/virtual-config" };
const absentSettings = (target) => String(target).startsWith("/virtual-config/");
const enoent = () => { throw Object.assign(new Error("absent"), { code: "ENOENT" }); };

test("SessionStart startup and clear anchor the canonical bootstrap to the validated project root", () => {
  const project = path.resolve("synthetic project");
  const reference = path.join(project, ".dove/install/AUTHOR_PREFERENCES.md");
  const qualityReference = path.join(project, ".dove/install/RESEARCH_QUALITY.md");
  for (const source of ["startup", "clear"]) {
    for (const status of ["current", "needs-update"]) {
      const output = sessionStartOutput({ source, cwd: path.join(project, "nested") }, { status }, { project });
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

test("SessionStart compact and resume include the researcher-owned identity card without rewriting it", () => {
  const project = "/virtual-session-project";
  const cardPath = path.join(project, ".dove/research/IDENTITY.md");
  const card = "Current round: rounds/003-brief.md\nRound status: ongoing\nMainline: Synthetic user goal\n";
  let cardBytes = Buffer.from(card);
  const reads = [];
  const directories = new Set([project, path.join(project, ".dove"), path.dirname(cardPath)]);
  const fsOps = {
    realpathSync: (target) => target,
    lstatSync(target) {
      const isFile = target === cardPath && cardBytes !== null;
      if (!isFile && !directories.has(target)) throw Object.assign(new Error("absent"), { code: "ENOENT" });
      return { isSymbolicLink: () => false, isDirectory: () => directories.has(target), isFile: () => isFile };
    },
    readFileSync(target) {
      if (absentSettings(target)) return enoent();
      assert.equal(target, cardPath, "continuation reads only the identity card, not the transcript or old history");
      reads.push(target);
      return cardBytes;
    },
    writeFileSync: () => assert.fail("SessionStart must not write")
  };
  for (const source of ["compact", "resume"]) {
    const payload = { source, transcript_path: "/never-read-transcript" };
    const output = sessionStartOutput(payload, { status: "current" }, { project, fsOps, env });
    assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
    const context = output.hookSpecificOutput.additionalContext;
    assert.ok(context.includes(card.trimEnd()));
    assert.ok(context.includes(DOVE_RESEARCH_REFLECTION_CONTINUITY));
    assert.ok(context.endsWith(userOriginalSourceContext(payload)));
    assert.equal(cardBytes.toString(), card, "continuation presents rather than corrects the card");
  }
  assert.deepEqual(reads, [cardPath, cardPath]);
  cardBytes = null;
  for (const source of ["compact", "resume"]) {
    const context = sessionStartOutput({ source }, { status: "current" }, { project, fsOps, env }).hookSpecificOutput.additionalContext;
    assert.match(context, /No readable short identity card/iu);
    assert.doesNotMatch(context, /^Mainline:/mu, "missing card is not reconstructed on continuation");
    assert.equal(cardBytes, null, "continuation never creates an identity card");
  }
  assert.deepEqual(reads, [cardPath, cardPath]);
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

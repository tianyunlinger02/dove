import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { sessionStartOutput } from "../../src/core/session-start-hook.mjs";
import { DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP } from "../../src/core/dove-author-preferences.mjs";
import { renderUninstallInventory } from "../../src/cli/terminal-output.mjs";

test("SessionStart startup and clear anchor the canonical bootstrap to the validated project root", () => {
  const project = path.resolve("synthetic project");
  const reference = path.join(project, ".dove/install/AUTHOR_PREFERENCES.md");
  for (const source of ["startup", "clear"]) {
    for (const status of ["current", "needs-update"]) {
      const output = sessionStartOutput({ source, cwd: path.join(project, "nested") }, { status }, { project });
      assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
      const context = output.hookSpecificOutput.additionalContext;
      assert.ok(context.includes(`\`${reference}\``));
      assert.equal(context.replace(reference, ".dove/install/AUTHOR_PREFERENCES.md"), DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP);
      assert.match(context, /main agent must personally read/u);
      assert.match(context, /beginning to end/u);
      assert.match(context, /offsets until EOF/u);
      assert.equal(Boolean(output.systemMessage), status !== "current");
    }
    for (const project of [undefined, "relative-project"]) {
      assert.throws(() => sessionStartOutput({ source }, null, { project }), /absolute project root/u);
    }
  }
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

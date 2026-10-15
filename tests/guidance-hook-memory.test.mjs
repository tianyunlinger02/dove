import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { PROJECT_HOST_IDS } from "../src/core/host-registry.mjs";
import { PAPER_SEARCH_MCP_SELECTOR, PAPER_SEARCH_MCP_SERVER_NAME } from "../src/core/paper-search-integration.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { inspectProjectDoctor } from "../src/core/project-doctor.mjs";
import { inspectProjectIntegration } from "../src/core/project-installation.mjs";
import { createProjectInstallationManifest, INSTALLATION_MANIFEST_PATH, serializeProjectInstallationManifest } from "../src/core/project-installation-manifest.mjs";
import { planJsonFragments } from "../src/core/project-installation-plan.mjs";
import { desiredManaged, resourcesForHosts, semanticDigest, sha256, STATUS_LINE_SELECTOR } from "../src/core/project-installation-resources.mjs";
import {
  currentPromptGuidance, inspectCurrentPromptGuidance, PROMPT_GUIDANCE_PATHS,
  userPromptSubmitAttentionOutput, userPromptSubmitOutput
} from "../src/core/user-prompt-submit-hook.mjs";

const ROOT = "/memory/dove/guidance";
const PACKAGE_ROOT = "/memory/dove/package";
const MANIFEST = path.join(ROOT, INSTALLATION_MANIFEST_PATH);
const SETTINGS = ".claude/settings.json";
const MCP = ".mcp.json";
const event = { hook_event_name: "UserPromptSubmit", prompt: "Do not write files." };

// Installation bytes exist only in this Map. No lifecycle writes, disk fixtures,
// CLI processes, or real project hooks are used by these tests.
function memoryInstallation(t, hosts = ["claude"]) {
  for (const name of ["readFileSync", "writeFileSync", "appendFileSync", "mkdirSync", "mkdtempSync", "renameSync", "unlinkSync", "rmSync", "statSync", "lstatSync", "realpathSync", "readdirSync"]) {
    t.mock.method(fs, name, () => assert.fail(`Unexpected disk I/O: ${name}`));
  }
  const files = new Map([[`${PACKAGE_ROOT}/bin/dove-package.mjs`, "memory runtime"]]);
  const reads = [];
  const absent = (file) => Object.assign(new Error(`No in-memory file: ${file}`), { code: "ENOENT" });
  const stat = (file) => {
    const isFile = files.has(file);
    const isDirectory = [...files.keys()].some((name) => name.startsWith(file.endsWith("/") ? file : `${file}/`));
    if (!isFile && !isDirectory) throw absent(file);
    return { isFile: () => isFile, isDirectory: () => isDirectory, isSymbolicLink: () => false, mode: isDirectory ? 0o755 : 0o644 };
  };
  const fsOps = {
    lstatSync: stat,
    statSync: stat,
    realpathSync: (file) => { stat(file); return file; },
    readdirSync: (directory) => [...new Set([...files.keys()].filter((file) => file.startsWith(`${directory}/`)).map((file) => file.slice(directory.length + 1).split("/")[0]))],
    readFileSync(file, encoding) {
      reads.push(file);
      if (!files.has(file)) throw absent(file);
      return encoding ? String(files.get(file)) : Buffer.from(files.get(file));
    }
  };
  const resources = resourcesForHosts(hosts);
  for (const resource of resources.filter((entry) => entry.kind === "exclusive-file")) files.set(path.join(ROOT, resource.path), resource.content);
  for (const relativePath of new Set(resources.filter((entry) => entry.kind === "json-fragment").map((entry) => entry.path))) {
    const planned = planJsonFragments(ROOT, relativePath, resources.filter((entry) => entry.path === relativePath), [], fsOps);
    files.set(path.join(ROOT, relativePath), planned.entry.content);
  }
  const manifest = createProjectInstallationManifest({
    hosts, package: { name: PACKAGE_NAME, version: PACKAGE_VERSION }, managed: desiredManaged(resources), now: "2026-01-01T00:00:00.000Z"
  }, { hostIds: PROJECT_HOST_IDS });
  files.set(MANIFEST, serializeProjectInstallationManifest(manifest, { hostIds: PROJECT_HOST_IDS }));
  reads.length = 0;
  return { files, reads, resources, manifest, fsOps, options: { fsOps, env: { HOME: "/memory/dove/home" }, packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION } };
}

function editJson(files, relativePath, edit) {
  const file = path.join(ROOT, relativePath);
  const value = JSON.parse(files.get(file));
  edit(value);
  files.set(file, `${JSON.stringify(value)}\n`);
}

function promptOutput(options, payload = event) {
  try {
    return userPromptSubmitOutput(payload, inspectCurrentPromptGuidance(ROOT, options), { ...options, project: ROOT });
  } catch {
    return userPromptSubmitAttentionOutput();
  }
}

function doctor(options) {
  return inspectProjectDoctor(ROOT, {
    ...options, packageRoot: PACKAGE_ROOT, packageRuntimePaths: ["bin/dove-package.mjs"],
    inspectResearchDocuments: () => ({ healthy: true, state: "memory-only" })
  });
}

test("unchanged current guidance delivers its package version and fingerprints read-only", (t) => {
  const { files, reads, manifest, resources, options } = memoryInstallation(t);
  const before = [...files];
  const guidance = inspectCurrentPromptGuidance(ROOT, options);
  assert.deepEqual(guidance, currentPromptGuidance(manifest));
  assert.equal(guidance.version, PACKAGE_VERSION);
  assert.deepEqual(guidance.fingerprints, PROMPT_GUIDANCE_PATHS.map((resourcePath) => {
    const resource = resources.find((entry) => entry.path === resourcePath);
    return `${resourcePath} ${resource.digest.slice(0, 12)}`;
  }));
  assert.deepEqual(new Set(reads), new Set([MANIFEST, ...resources.filter((entry) => entry.kind === "exclusive-file").map((entry) => path.join(ROOT, entry.path))]));
  const expected = userPromptSubmitOutput(event, guidance, { ...options, project: ROOT });
  assert.deepEqual(promptOutput(options), expected);
  assert.ok(expected.hookSpecificOutput.additionalContext.startsWith(`Dove ${PACKAGE_VERSION} (disk guidance, not rule reload):`));
  for (const fingerprint of guidance.fingerprints) assert.ok(expected.hookSpecificOutput.additionalContext.includes(fingerprint));
  assert.equal(inspectProjectIntegration(ROOT, options).status, "current");
  assert.equal(doctor(options).projectIntegration.healthy, true);
  assert.deepEqual([...files], before);
});

const configurationChanges = [
  { name: "statusLine", path: SETTINGS, selector: STATUS_LINE_SELECTOR, change: (value) => { value.statusLine.command = "node /memory/local-statusline.mjs"; } },
  { name: "paper-search MCP", path: MCP, selector: PAPER_SEARCH_MCP_SELECTOR, change: (value) => { value.mcpServers[PAPER_SEARCH_MCP_SERVER_NAME].env = { LOCAL_SEARCH: "preserved" }; } },
  { name: "Exa MCP", path: MCP, selector: "/mcpServers/exa", change: (value) => { value.mcpServers.exa.url = "https://example.invalid/local-exa"; } },
  { name: "hook timeout", path: SETTINGS, selector: "/hooks/UserPromptSubmit[dove-user-prompt-submit]", change: (value) => { value.hooks.UserPromptSubmit[0].hooks[0].timeout = 9; } }
];

for (const changes of [...configurationChanges.map((change) => [change]), configurationChanges.slice(0, 3)]) {
  test(`preserved ${changes.map((change) => change.name).join(" + ")} leaves guidance current and doctor truthful`, (t) => {
    const { files, reads, manifest, options } = memoryInstallation(t);
    const expected = promptOutput(options);
    for (const change of changes) {
      editJson(files, change.path, change.change);
      // A bulk upgrade retains the previous ownership digest, not local bytes
      // and not necessarily the current canonical fragment's digest.
      manifest.managed.find((entry) => entry.path === change.path && entry.selector === change.selector).digest = semanticDigest({ previousOwnedFragment: change.name });
    }
    files.set(MANIFEST, serializeProjectInstallationManifest(manifest, { hostIds: PROJECT_HOST_IDS }));
    const before = [...files];
    reads.length = 0;
    assert.deepEqual(inspectCurrentPromptGuidance(ROOT, options), currentPromptGuidance(manifest));
    assert.equal(reads.includes(path.join(ROOT, SETTINGS)), false);
    assert.equal(reads.includes(path.join(ROOT, MCP)), false);
    assert.deepEqual(promptOutput(options), expected);
    const inspection = inspectProjectIntegration(ROOT, options);
    assert.equal(inspection.status, "needs-update", "integration must not be relabeled canonical to make guidance work");
    const expectedDrift = changes.map(({ path, selector }) => ({ path, selector }));
    assert.deepEqual(new Set(inspection.skippedLocalEdits.map(JSON.stringify)), new Set(expectedDrift.map(JSON.stringify)));
    const report = doctor(options);
    assert.equal(report.projectIntegration.healthy, false);
    assert.equal(report.projectIntegration.state, "needs-update");
    assert.deepEqual(report.projectIntegration.drifted, inspection.skippedLocalEdits);
    assert.equal(report.staticChecksPassed, false);
    assert.deepEqual([...files], before, "neither guidance verification nor doctor changes retained configuration or ownership");
  });
}

test("missing non-guidance settings and MCP do not masquerade as changed guidance", (t) => {
  const { files, options } = memoryInstallation(t);
  const expected = promptOutput(options);
  for (const resourcePath of [SETTINGS, MCP]) files.delete(path.join(ROOT, resourcePath));
  const before = [...files];
  assert.deepEqual(promptOutput(options), expected);
  const report = doctor(options);
  assert.equal(report.projectIntegration.healthy, false);
  for (const resourcePath of [SETTINGS, MCP]) assert.ok(report.projectIntegration.updatePaths.includes(resourcePath));
  assert.deepEqual([...files], before);
});

for (const state of ["changed", "missing"]) {
  test(`${state} rule, Skills, agent instructions and all quality/author references still warn`, (t) => {
    const { files, resources, options } = memoryInstallation(t);
    editJson(files, SETTINGS, configurationChanges[0].change);
    editJson(files, MCP, configurationChanges[1].change);
    const before = [...files];
    const guidance = resources.filter((entry) => entry.kind === "exclusive-file");
    assert.ok(guidance.some((entry) => entry.path.startsWith(".claude/rules/")));
    assert.ok(guidance.some((entry) => entry.path.startsWith(".claude/skills/")));
    assert.ok(guidance.some((entry) => entry.path.startsWith(".claude/agents/")));
    assert.equal(guidance.filter((entry) => entry.path.startsWith(".dove/install/")).length, 4);
    for (const resource of guidance) {
      const file = path.join(ROOT, resource.path);
      if (state === "changed") files.set(file, `${resource.content}\nLocal guidance edit\n`);
      else files.delete(file);
      assert.throws(() => inspectCurrentPromptGuidance(ROOT, options), /guidance is changed or missing/u, resource.path);
      assert.deepEqual(promptOutput(options), userPromptSubmitAttentionOutput(), resource.path);
      files.set(file, resource.content);
    }
    assert.deepEqual(new Map(files), new Map(before));
    assert.equal(inspectCurrentPromptGuidance(ROOT, options).version, PACKAGE_VERSION);
  });
}

for (const state of ["missing ownership", "stale digest", "locally adopted bytes"]) {
  test(`guidance ${state} cannot pass just because the recorded package version matches`, (t) => {
    const { files, manifest, options } = memoryInstallation(t);
    const resourcePath = PROMPT_GUIDANCE_PATHS[0];
    if (state === "missing ownership") manifest.managed = manifest.managed.filter((entry) => entry.path !== resourcePath);
    else {
      const localBytes = "Locally changed rule\n";
      manifest.managed.find((entry) => entry.path === resourcePath).digest = sha256(localBytes);
      if (state === "locally adopted bytes") files.set(path.join(ROOT, resourcePath), localBytes);
    }
    files.set(MANIFEST, serializeProjectInstallationManifest(manifest, { hostIds: PROJECT_HOST_IDS }));
    const before = [...files];
    assert.throws(() => inspectCurrentPromptGuidance(ROOT, options), /guidance inventory does not match/u);
    assert.deepEqual(promptOutput(options), userPromptSubmitAttentionOutput());
    assert.deepEqual([...files], before);
  });
}

test("stale or incompatible package metadata and non-Claude integration still warn", (t) => {
  const { files, manifest, options } = memoryInstallation(t);
  for (const packageInfo of [
    { name: PACKAGE_NAME, version: "0.0.0" },
    { name: PACKAGE_NAME, version: `${Number(PACKAGE_VERSION.split(".")[0]) + 1}.0.0` },
    { name: `${PACKAGE_NAME}-different`, version: PACKAGE_VERSION }
  ]) {
    files.set(MANIFEST, serializeProjectInstallationManifest({ ...manifest, package: packageInfo }, { hostIds: PROJECT_HOST_IDS }));
    assert.throws(() => inspectCurrentPromptGuidance(ROOT, options), /requires current Claude integration/u);
    assert.deepEqual(promptOutput(options), userPromptSubmitAttentionOutput());
  }
  files.set(MANIFEST, serializeProjectInstallationManifest({ ...manifest, hosts: ["dsh"] }, { hostIds: PROJECT_HOST_IDS }));
  assert.throws(() => inspectCurrentPromptGuidance(ROOT, options), /requires current Claude integration/u);
  assert.deepEqual(promptOutput(options), userPromptSubmitAttentionOutput());
});

test("guidance symlinks still warn without reading their targets", (t) => {
  const { reads, fsOps, options } = memoryInstallation(t);
  const rule = path.join(ROOT, PROMPT_GUIDANCE_PATHS[0]);
  const lstat = fsOps.lstatSync;
  fsOps.lstatSync = (file) => file === rule ? { ...lstat(file), isSymbolicLink: () => true } : lstat(file);
  assert.throws(() => inspectCurrentPromptGuidance(ROOT, options), /must not be a symbolic link/u);
  assert.deepEqual(promptOutput(options), userPromptSubmitAttentionOutput());
  assert.equal(reads.includes(rule), false);
});

test("preserved configuration still delivers the identity card and source pointer without reading conversation", (t) => {
  const { files, reads, options } = memoryInstallation(t);
  editJson(files, SETTINGS, configurationChanges[0].change);
  const card = "Mainline: Preserve the confirmed research goal.\nCurrent round: 001-brief.md\nRound status: ongoing\n";
  files.set(`${ROOT}/.dove/research/IDENTITY.md`, card);
  const before = [...files];
  const payload = { ...event, prompt: "CURRENT_USER_BODY_NOT_TO_COPY", transcript_path: "/memory/private-session.jsonl", transcript: "HISTORY_NOT_TO_COPY" };
  const output = promptOutput(options, payload);
  const context = output.hookSpecificOutput.additionalContext;
  assert.ok(context.includes(card.trim()));
  assert.ok(context.includes(payload.transcript_path));
  assert.doesNotMatch(context, /CURRENT_USER_BODY_NOT_TO_COPY|HISTORY_NOT_TO_COPY/u);
  assert.equal(reads.includes(payload.transcript_path), false);
  assert.deepEqual([...files], before);
});

#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { COMMAND_SURFACES, MANAGED_PACKAGE_PATHS, PACKAGE_LEGAL_PATHS } from "../src/core/command-manifest.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { EXA_WEB_SUPPORT_SKILL_PATH } from "../src/core/web-access-integration.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_SCRIPTS = ["build", "build:check", "commands:check", "commands:validate", "installation:validate", "uninstall:validate", "review-runtime:validate", "runs:validate", "behavior:validate", "behavior:eval", "package:validate", "check", "release:check"];
const PRODUCTION_DEPENDENCY_FIELDS = ["dependencies", "optionalDependencies", "peerDependencies", "bundleDependencies", "bundledDependencies"];
const REQUIRED_PACKAGE_KEYWORDS = ["research", "academic-writing", "experiments", "claude-code", "markdown", "cli"];
const THIRD_PARTY_LICENSES = new Set(["MIT", "ISC"]);
const FORBIDDEN_PACKAGE_PATHS = [
  ".paper",
  ".claude/agents/dove-reviewer.md",
  ".claude/agents/dove-reader.md",
  ".claude/agents/dove-referee.md",
  ".opencode.json",
  ".opencode/agents/dove-reviewer.md",
  ".opencode/agents/dove-reader.md",
  ".opencode/agents/dove-referee.md",
  ".opencode/skills/dove-planner/SKILL.md",
  ".opencode/skills/dove-builder/SKILL.md",
  ".opencode/skills/dove-reviewer/SKILL.md",
  ".opencode/skills/dove-reader/SKILL.md",
  ".opencode/skills/dove-referee/SKILL.md",
  "mcp/dove-state-server-package.mjs",
  "scripts/doctor-mcp-probe-package.mjs"
];
const FORBIDDEN_SCRIPTS = ["mcp:serve", "mcp:validate"];

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));

function assertAbsentProductionDependencies(manifest, label) {
  for (const field of PRODUCTION_DEPENDENCY_FIELDS) {
    assert.equal(Object.hasOwn(manifest, field), false, `${label} must not declare production ${field}`);
  }
}

function assertNonEmptyTrimmedString(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.equal(value.trim(), value, `${label} must be trimmed`);
  assert.notEqual(value, "", `${label} must be non-empty`);
}

function assertPackageMetadata() {
  assert.equal(packageJson.name, "dove");
  assert.equal(packageJson.name, PACKAGE_NAME);
  assert.equal(packageJson.version, PACKAGE_VERSION);
  assertNonEmptyTrimmedString(packageJson.description, "package description");
  assert.equal(packageJson.author, "tianyunlinger02");
  assert.equal(packageJson.license, "SEE LICENSE IN LICENSE");
  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.main, "dist/index.mjs");
  assert.deepEqual(packageJson.bin, { dove: "bin/dove-package.mjs" });
  assert.deepEqual(packageJson.exports, { ".": "./dist/index.mjs" });
  assert.equal(packageJson.engines?.node, ">=22");
  assert.equal(typeof packageJson.repository?.url, "string");
  assert.match(packageJson.repository.url, /github\.com\/tianyunlinger02\/dove\.git$/u);
  assert.equal(typeof packageJson.bugs?.url, "string");
  assert.match(packageJson.bugs.url, /github\.com\/tianyunlinger02\/dove\/issues$/u);
  assert.equal(typeof packageJson.homepage, "string");
  assert.match(packageJson.homepage, /github\.com\/tianyunlinger02\/dove#readme$/u);
  assert.equal(Array.isArray(packageJson.keywords), true, "package keywords must be an array");
  for (const requiredKeyword of REQUIRED_PACKAGE_KEYWORDS) {
    assert.equal(packageJson.keywords.includes(requiredKeyword), true, `package keywords must include ${requiredKeyword}`);
  }
  for (const [index, keyword] of packageJson.keywords.entries()) assertNonEmptyTrimmedString(keyword, `package keyword ${index}`);
  assert.equal(new Set(packageJson.keywords).size, packageJson.keywords.length, "package keywords must be unique");
  assert.equal(packageJson.devDependencies?.["@inquirer/prompts"], "^7.10.1");
  assert.equal(packageJson.devDependencies?.esbuild, "^0.28.1");
  assertAbsentProductionDependencies(packageJson, "package.json");
}

function assertLegalInventory(bundledPackageNames) {
  assert.deepEqual(PACKAGE_LEGAL_PATHS, ["LICENSE", "THIRD_PARTY_NOTICES.md"]);
  for (const relativePath of PACKAGE_LEGAL_PATHS) {
    assert.equal(packageJson.files.includes(relativePath), true, `package files manifest must include legal path ${relativePath}`);
    assert.equal(fs.existsSync(path.join(ROOT, relativePath)), true, `legal file must exist: ${relativePath}`);
  }

  const licenseText = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8");
  assert.match(licenseText, /^# PolyForm Noncommercial License 1\.0\.0\n/u);
  assert.match(licenseText, /<https:\/\/polyformproject\.org\/licenses\/noncommercial\/1\.0\.0>/u);
  assert.match(licenseText, /## Noncommercial Purposes\n\nAny noncommercial purpose is a permitted purpose\./u);
  assert.doesNotMatch(licenseText, /Permission to use, copy, modify,[\s\S]{0,200}for any purpose/u);

  const noticesText = fs.readFileSync(path.join(ROOT, "THIRD_PARTY_NOTICES.md"), "utf8");
  assert.match(noticesText, /^# Third-Party Notices\n/u);
  assert.match(noticesText, /Dove PolyForm Noncommercial License does not replace or restrict the rights granted by these third-party licenses/u);
  const licenseTextsAt = noticesText.indexOf("## License texts");
  assert.notEqual(licenseTextsAt, -1, "third-party license texts section is missing");
  const listedPackages = [];
  for (const match of noticesText.matchAll(/^- `((?:@[^/]+\/)?[^@`]+)@([^`]+)` — (MIT|ISC)$/gmu)) {
    const [, name, version, license] = match;
    const lockMetadata = packageLock.packages?.[`node_modules/${name}`];
    assert.ok(lockMetadata, `bundled package is absent from lockfile: ${name}`);
    assert.equal(version, lockMetadata.version, `notice version must match lockfile for ${name}`);
    assert.equal(license, lockMetadata.license, `notice license must match lockfile for ${name}`);
    assert.equal(THIRD_PARTY_LICENSES.has(license), true, `unexpected bundled license for ${name}: ${license}`);
    assert.equal(noticesText.slice(licenseTextsAt).includes(`${name}@${version}`), true, `license text must identify ${name}@${version}`);
    listedPackages.push(name);
  }
  assert.deepEqual([...new Set(listedPackages)].sort(), bundledPackageNames, "third-party notices must cover exactly the packages bundled into the standalone CLI");
  assert.match(noticesText.slice(licenseTextsAt), /Permission is hereby granted, free of charge/u);
  assert.match(noticesText.slice(licenseTextsAt), /Permission to use, copy, modify, and\/or distribute this software/u);
}

function assertLockfile() {
  assert.equal(packageLock.name, packageJson.name);
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.lockfileVersion, 3);
  assert.equal(packageLock.requires, true);
  const rootPackage = packageLock.packages?.[""];
  assert.ok(rootPackage, "package-lock root package metadata is missing");
  assert.equal(rootPackage.name, packageJson.name);
  assert.equal(rootPackage.version, packageJson.version);
  assert.equal(rootPackage.license, packageJson.license);
  assert.deepEqual(rootPackage.bin, packageJson.bin);
  assert.deepEqual(rootPackage.devDependencies, packageJson.devDependencies);
  assertAbsentProductionDependencies(rootPackage, "package-lock root package");
  assert.equal(Object.hasOwn(packageLock, "dependencies"), false, "package-lock must not have lockfile v1/v2 dependency mirror");
  for (const [packagePath, metadata] of Object.entries(packageLock.packages ?? {})) {
    if (packagePath === "") continue;
    assert.equal(metadata.dev, true, `lockfile package ${packagePath} must be dev-only`);
  }
}

function spawnChecked(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, ...options });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function realPackagePack(tempRoot) {
  const packed = spawnChecked("npm", ["pack", ROOT, "--json", "--ignore-scripts"], { cwd: tempRoot });
  const parsed = JSON.parse(packed.stdout);
  assert.equal(Array.isArray(parsed), true, "npm pack --json must return an array");
  assert.equal(parsed.length, 1, "npm pack must produce exactly one tarball");
  const pack = parsed[0];
  const tarball = path.join(tempRoot, pack.filename);
  assert.equal(fs.existsSync(tarball), true, `real npm pack tarball missing: ${tarball}`);
  assert.equal(path.dirname(fs.realpathSync.native(tarball)), fs.realpathSync.native(tempRoot), "npm pack tarball must stay outside the repository");
  return { pack, tarball };
}

function assertBuildCurrent() {
  const result = spawnChecked(process.execPath, [path.join(ROOT, "scripts", "build-package.mjs"), "--check"], { cwd: ROOT });
  const proofLine = result.stderr.match(/^Package build proof: (.+)$/mu);
  assert.ok(proofLine, "package build proof is missing");
  const proof = JSON.parse(proofLine[1]);
  const cliProof = proof.find((item) => item.output === "bin/dove-package.mjs");
  assert.ok(cliProof, "standalone CLI build proof is missing");
  assert.equal(Array.isArray(cliProof.bundledPackageNames), true, "standalone CLI bundled package inventory is missing");
  return cliProof.bundledPackageNames;
}

function assertPackedFiles(pack) {
  assert.equal(pack.name, packageJson.name);
  assert.equal(pack.version, packageJson.version);
  assert.equal(pack.filename, `${packageJson.name}-${packageJson.version}.tgz`);
  const expectedFiles = [...MANAGED_PACKAGE_PATHS, ...PACKAGE_LEGAL_PATHS, "package.json"].sort();
  assert.deepEqual(pack.files.map((file) => file.path).sort(), expectedFiles);
  for (const relativePath of FORBIDDEN_PACKAGE_PATHS) assert.equal(pack.files.some((file) => file.path === relativePath), false, `retired path packed: ${relativePath}`);
  for (const packedFile of pack.files) {
    assert.doesNotMatch(packedFile.path, /(?:^|\/)\.paper(?:\/|$)/u, `.paper path packed: ${packedFile.path}`);
    assert.doesNotMatch(packedFile.path, /^\.opencode\/skills\/dove-(?:planner|builder|reviewer|reader|referee)\/SKILL\.md$/u, `retired role skill packed: ${packedFile.path}`);
    assert.doesNotMatch(packedFile.path, /^\.(?:claude|opencode)\/agents\/dove-(?:reviewer|reader|referee)\.md$/u, `retired review-role agent packed: ${packedFile.path}`);
  }
}

function initInstallProject(projectRoot) {
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "package.json"), JSON.stringify({ private: true, type: "module" }, null, 2));
}

function installPackedPackage(tarball, installRoot) {
  initInstallProject(installRoot);
  spawnChecked("npm", ["install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: installRoot });
  const installedPackageJsonPath = path.join(installRoot, "node_modules", packageJson.name, "package.json");
  const installedPackageJson = JSON.parse(fs.readFileSync(installedPackageJsonPath, "utf8"));
  assert.equal(installedPackageJson.name, packageJson.name);
  assert.equal(installedPackageJson.version, packageJson.version);
  assert.equal(installedPackageJson.license, packageJson.license);
  assertAbsentProductionDependencies(installedPackageJson, "installed package.json");
  const installedPackageRoot = path.dirname(installedPackageJsonPath);
  for (const relativePath of PACKAGE_LEGAL_PATHS) {
    assert.equal(digestFile(path.join(installedPackageRoot, relativePath)), digestFile(path.join(ROOT, relativePath)), `installed legal file must match source: ${relativePath}`);
  }
  for (const packageName of ["@inquirer", "esbuild"]) {
    assert.equal(fs.existsSync(path.join(installRoot, "node_modules", packageName)), false, `--omit=dev install must not install ${packageName}`);
  }
  const installedPackageNames = fs.readdirSync(path.join(installRoot, "node_modules")).filter((entry) => !entry.startsWith("."));
  assert.deepEqual(installedPackageNames, [packageJson.name], "--omit=dev install must install only the package itself");
  return path.join(installRoot, "node_modules", ".bin", process.platform === "win32" ? "dove.cmd" : "dove");
}

function assertInstalledCli(installedBin, cwd) {
  const version = spawnChecked(installedBin, ["--version"], { cwd });
  assert.equal(version.stdout.trim(), packageJson.version);
  const help = spawnChecked(installedBin, ["--help"], { cwd });
  assert.match(help.stdout, /^dove\n/u);
  assert.match(help.stdout, /dove --version/u);
  assert.match(help.stdout, /dove init \[--project <dir>\]/u);
  assert.match(help.stdout, /(?:Dove 负责|The runtime CLI manages project integration)/u);
}

function digestFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function snapshotDirectory(root) {
  const entries = [];
  function visit(directory, prefix) {
    for (const dirent of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? `${prefix}/${dirent.name}` : dirent.name;
      const absolutePath = path.join(directory, dirent.name);
      if (dirent.isSymbolicLink()) {
        entries.push({ path: relativePath, type: "symlink", target: fs.readlinkSync(absolutePath) });
      } else if (dirent.isDirectory()) {
        entries.push({ path: relativePath, type: "directory" });
        visit(absolutePath, relativePath);
      } else if (dirent.isFile()) {
        const stat = fs.statSync(absolutePath);
        entries.push({ path: relativePath, type: "file", mode: stat.mode & 0o7777, size: stat.size, sha256: digestFile(absolutePath) });
      } else {
        entries.push({ path: relativePath, type: "other" });
      }
    }
  }
  visit(root, "");
  return entries;
}

function runPtyBareMenuExit(installedBin, projectRoot) {
  const script = String.raw`
import json
import os
import pty
import select
import signal
import sys
import time

installed_bin = sys.argv[1]
project_root = sys.argv[2]
env = os.environ.copy()
env["NO_COLOR"] = "1"
env["TERM"] = env.get("TERM") or "xterm-256color"

pid, fd = pty.fork()
if pid == 0:
    os.chdir(project_root)
    os.execvpe(installed_bin, [installed_bin], env)

output = b""
sent = False
exit_code = None
deadline = time.time() + 15
try:
    while time.time() < deadline:
        readable, _, _ = select.select([fd], [], [], 0.05)
        if readable:
            try:
                chunk = os.read(fd, 8192)
            except OSError:
                chunk = b""
            if chunk:
                output += chunk
                if (not sent) and ("退出".encode("utf-8") in output or "请选择".encode("utf-8") in output):
                    time.sleep(0.1)
                    os.write(fd, b"\x1b[B\x1b[B\r")
                    sent = True
            else:
                break
        child, status = os.waitpid(pid, os.WNOHANG)
        if child == pid:
            exit_code = os.waitstatus_to_exitcode(status)
            break
    if exit_code is None and not sent:
        os.write(fd, b"\x1b[B\x1b[B\r")
        sent = True
        wait_deadline = time.time() + 5
        while time.time() < wait_deadline:
            readable, _, _ = select.select([fd], [], [], 0.05)
            if readable:
                try:
                    chunk = os.read(fd, 8192)
                except OSError:
                    chunk = b""
                if chunk:
                    output += chunk
            child, status = os.waitpid(pid, os.WNOHANG)
            if child == pid:
                exit_code = os.waitstatus_to_exitcode(status)
                break
    if exit_code is None:
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        time.sleep(0.2)
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        try:
            _, status = os.waitpid(pid, 0)
            exit_code = os.waitstatus_to_exitcode(status)
        except ChildProcessError:
            exit_code = 124
finally:
    try:
        os.close(fd)
    except OSError:
        pass

print(json.dumps({"exitCode": exit_code, "sentExitKeys": sent, "output": output.decode("utf-8", "replace")}))
`;
  const result = spawnChecked("python3", ["-c", script, installedBin, projectRoot], { cwd: projectRoot, timeout: 30000 });
  const smoke = JSON.parse(result.stdout);
  assert.equal(smoke.sentExitKeys, true, "PTY smoke did not send the bare menu exit selection");
  assert.equal(smoke.exitCode, 0, smoke.output);
  assert.match(smoke.output, /退出/u, "PTY smoke must render the exit choice");
  assert.match(smoke.output, /未修改任何文件/u, "PTY smoke must exit without modifying files");
  return smoke;
}

function assertPtyBareMenuExit(installedBin, projectRoot) {
  fs.mkdirSync(projectRoot, { recursive: true });
  const before = snapshotDirectory(projectRoot);
  const smoke = runPtyBareMenuExit(installedBin, projectRoot);
  const after = snapshotDirectory(projectRoot);
  assert.deepEqual(after, before, "bare dove PTY menu exit must not write to the synthetic project");
  return smoke;
}

function assertDoctorRuntime(core, project, packageRoot) {
  const before = snapshotDirectory(project);
  const doctor = core.inspectProjectDoctor(project);
  assert.equal(doctor.userCli.package.root, packageRoot, "public Doctor defaults to its own package, not its parent or the target project");
  assert.equal(doctor.userCli.healthy, true);
  assert.deepEqual(doctor.userCli.missing, []);
  assert.equal(doctor.userCli.executable.path, path.join(packageRoot, "bin/dove-package.mjs"));
  assert.deepEqual(snapshotDirectory(project), before, "Doctor must remain read-only");
}

async function assertTemporaryPublicLibrary() {
  const { build } = await import("esbuild");
  const source = await import("../src/core/index.mjs");
  const scratch = path.join(ROOT, ".claude", "tmp", "dove-wiring-audit");
  fs.mkdirSync(scratch, { recursive: true });
  const tempRoot = fs.mkdtempSync(path.join(scratch, "library-"));
  try {
    const packageRoot = path.join(tempRoot, "package");
    const project = path.join(tempRoot, "project");
    fs.mkdirSync(path.join(packageRoot, "bin"), { recursive: true });
    fs.mkdirSync(path.join(project, ".git"), { recursive: true });
    fs.writeFileSync(path.join(project, "paper.tex"), "Synthetic Doctor target.\n");
    fs.writeFileSync(path.join(packageRoot, "package.json"), JSON.stringify({ name: packageJson.name, type: "module", exports: packageJson.exports }));
    const executable = path.join(packageRoot, "bin/dove-package.mjs");
    fs.writeFileSync(executable, "// Synthetic CLI presence fixture; never executed.\n");
    const outfile = path.join(packageRoot, "dist/index.mjs");
    await build({
      absWorkingDir: ROOT, entryPoints: ["src/core/index.mjs"], outfile,
      bundle: true, platform: "node", target: "node22", format: "esm", external: ["node:*"],
      define: { __DOVE_PACKAGE_NAME__: JSON.stringify(PACKAGE_NAME), __DOVE_PACKAGE_VERSION__: JSON.stringify(PACKAGE_VERSION) },
      logLevel: "silent"
    });
    const library = await import(pathToFileURL(outfile).href);
    assertDoctorRuntime(source, project, ROOT);
    assertDoctorRuntime(library, project, packageRoot);
    const exported = spawnChecked(process.execPath, ["--input-type=module", "-e", `import { inspectProjectDoctor } from "dove"; console.log(JSON.stringify(inspectProjectDoctor(${JSON.stringify(project)}).userCli));`], { cwd: packageRoot });
    assert.deepEqual(JSON.parse(exported.stdout), library.inspectProjectDoctor(project).userCli, "package exports must reach the tested public library without installation");
    const override = library.inspectProjectDoctor(project, { packageRoot: ROOT }).userCli;
    assert.equal(override.package.root, ROOT);
    assert.equal(override.healthy, true);
    fs.renameSync(executable, `${executable}.absent`);
    const missing = library.inspectProjectDoctor(project).userCli;
    assert.equal(missing.package.root, packageRoot);
    assert.equal(missing.healthy, false, "a genuinely missing runtime must still be reported");
    assert.deepEqual(missing.missing, ["bin/dove-package.mjs"]);
    assert.equal(missing.executable.healthy, false);
    console.log(JSON.stringify({ status: "passed", scope: "source and temporary public library Doctor", packageExport: true, installed: false }, null, 2));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (process.argv.includes("--library-only")) {
  await assertTemporaryPublicLibrary();
  process.exit(0);
}

const bundledPackageNames = assertBuildCurrent();
assertPackageMetadata();
assertLegalInventory(bundledPackageNames);
assertLockfile();
assert.equal(Object.hasOwn(packageJson.scripts ?? {}, "review-runtime:validate"), true);
assert.equal(Object.hasOwn(packageJson.scripts ?? {}, "runs:validate"), true);
assert.equal(Object.hasOwn(packageJson.scripts ?? {}, "behavior:validate"), true);
assert.equal(Object.hasOwn(packageJson.scripts ?? {}, "behavior:eval"), true);
for (const script of REQUIRED_SCRIPTS) assert.equal(typeof packageJson.scripts?.[script], "string", `missing package script ${script}`);
assert.match(packageJson.scripts.check, /npm run behavior:validate/u, "check must include deterministic behavior validation");
assert.doesNotMatch(packageJson.scripts["release:check"], /behavior:eval/u, "release:check must not invoke the real behavior runner");
assert.equal(packageJson.files.some((entry) => entry === "evals" || entry.startsWith("evals/")), false, "behavior eval corpus must not be packed");
for (const script of FORBIDDEN_SCRIPTS) assert.equal(Object.hasOwn(packageJson.scripts ?? {}, script), false, `retired package script remains: ${script}`);
for (const relativePath of FORBIDDEN_PACKAGE_PATHS) assert.equal(packageJson.files.includes(relativePath), false, `retired package file remains: ${relativePath}`);
assert.equal(packageJson.files.some((entry) => /user-prompt-submit/iu.test(entry)), false, "package files manifest must not include retired prompt hook files");

assert.deepEqual(COMMAND_SURFACES.map((surface) => surface.id), [
  "dove.research", "dove.status", "dove.source", "dove.experiment", "dove.draft",
  "dove.figure", "dove.review", "dove.rebuttal", "dove.lessons"
]);
assert.equal(MANAGED_PACKAGE_PATHS.includes(`package-resources/hosts/claude/${EXA_WEB_SUPPORT_SKILL_PATH}`), true);

const packageExports = await import(new URL("../dist/index.mjs", import.meta.url));
assert.equal(packageExports.PACKAGE_NAME, packageJson.name);
assert.equal(packageExports.PACKAGE_VERSION, packageJson.version);
for (const retiredExport of ["exportResearch", "previewResearchExport"]) assert.equal(Object.hasOwn(packageExports, retiredExport), false, `retired package export remains: ${retiredExport}`);

for (const bundlePath of ["dist/index.mjs", "bin/dove-package.mjs"]) {
  const bundleText = fs.readFileSync(path.join(ROOT, bundlePath), "utf8");
  assert.doesNotMatch(bundleText, /src\/core\/research-export\.mjs|export-research|previewResearchExport|exportResearch|exportCommand/iu, `${bundlePath} must not contain retired legacy export runtime`);
  assert.doesNotMatch(bundleText, /ambientContextForPrompt|isResearchRelatedWakeupPrompt|renderClaudeAmbientSkill|parseUserPromptSubmitPayload|userPromptSubmitOutput|DOVE_CLAUDE_AMBIENT_HOOK|DOVE_CLAUDE_AMBIENT_SKILL|\.claude\/skills\/dove-intake\/SKILL\.md/iu, `${bundlePath} must not contain retired UserPromptSubmit intake runtime`);
}

const tempBase = path.join(path.dirname(ROOT), ".dove-package-validate");
fs.mkdirSync(tempBase, { recursive: true });
const tempRoot = fs.mkdtempSync(path.join(tempBase, "run-"));
try {
  const { pack, tarball } = realPackagePack(tempRoot);
  assertPackedFiles(pack);
  const installRoot = path.join(tempRoot, "install-project");
  const installedBin = installPackedPackage(tarball, installRoot);
  assertInstalledCli(installedBin, installRoot);
  const syntheticProject = path.join(tempRoot, "synthetic-project");
  const smoke = assertPtyBareMenuExit(installedBin, syntheticProject);
  assertDoctorRuntime(packageExports, syntheticProject, ROOT);
  const installedRoot = path.join(installRoot, "node_modules", packageJson.name);
  assertDoctorRuntime(await import(pathToFileURL(path.join(installedRoot, "dist/index.mjs")).href), syntheticProject, installedRoot);
  console.log(JSON.stringify({ status: "passed", packed: pack.filename, installedVersion: packageJson.version, ptyBareMenuExit: { exitCode: smoke.exitCode, zeroProjectWrites: true } }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
  try { fs.rmdirSync(tempBase); } catch (error) { if (error?.code !== "ENOTEMPTY" && error?.code !== "ENOENT") throw error; }
}

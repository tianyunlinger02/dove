#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const CHECK_MODE = process.argv.includes("--check");
const PACKAGE = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"));
const PACKAGE_DEFINES = {
  __DOVE_PACKAGE_NAME__: JSON.stringify(PACKAGE.name),
  __DOVE_PACKAGE_VERSION__: JSON.stringify(PACKAGE.version)
};
const EXPECTED_OUTPUTS = [
  { entry: "src/core/index.mjs", output: "dist/index.mjs", shebang: false },
  { entry: "bin/dove.mjs", output: "bin/dove-package.mjs", shebang: true },
  { entry: "scripts/dove-user-prompt-submit.mjs", output: "scripts/dove-user-prompt-submit-package.mjs", shebang: true }
];
const NODE_EXTERNAL_IMPORT = /^(?:node:)?(?:assert|assert\/strict|async_hooks|buffer|child_process|crypto|events|fs|os|path|process|readline|stream|string_decoder|tty|url|util)$/u;
const INQUIRER_INPUT = /^node_modules\/@inquirer\//u;
const INQUIRER_SPECIFIER = /^@inquirer\//u;
const REQUIRED_CLI_INQUIRER_PACKAGES = ["@inquirer/prompts", "@inquirer/select", "@inquirer/confirm", "@inquirer/checkbox"];

function projectRelative(filePath) {
  return path.relative(PACKAGE_ROOT, filePath).split(path.sep).join("/");
}

function inputPackage(input) {
  const match = String(input).match(/^node_modules\/(?:((?:@[^/]+\/[^/]+)|[^/]+))\//u);
  return match?.[1] ?? null;
}

function externalImports(metafile) {
  const external = new Set();
  for (const input of Object.values(metafile.inputs ?? {})) {
    for (const item of input.imports ?? []) {
      if (item.external) external.add(item.path);
    }
  }
  return [...external].sort();
}

function assertExternalImports(metafile, label) {
  for (const specifier of externalImports(metafile)) {
    assert.match(specifier, NODE_EXTERNAL_IMPORT, `${label} has non-node external import ${specifier}`);
  }
}

function assertInquirerBundled(metafile, item) {
  const inputs = Object.keys(metafile.inputs ?? {}).sort();
  const inquirerInputs = inputs.filter((input) => INQUIRER_INPUT.test(input));
  const inquirerPackages = new Set(inquirerInputs.map(inputPackage).filter(Boolean));
  const inquirerExternals = externalImports(metafile).filter((specifier) => INQUIRER_SPECIFIER.test(specifier));
  assert.deepEqual(inquirerExternals, [], `${item.output} must bundle Inquirer instead of leaving external package imports`);

  if (item.output === "bin/dove-package.mjs") {
    for (const packageName of REQUIRED_CLI_INQUIRER_PACKAGES) {
      assert.equal(inquirerPackages.has(packageName), true, `${item.output} metafile must prove ${packageName} is bundled`);
    }
    return [...inquirerPackages].sort();
  }

  assert.equal(inquirerInputs.length, 0, `${item.output} must not carry unused Inquirer code`);
  return [];
}

function assertMetafileStandaloneProof(result, item) {
  assert.ok(result.metafile, `${item.output} must produce an esbuild metafile`);
  const outputEntries = Object.entries(result.metafile.outputs ?? {});
  assert.equal(outputEntries.length, 1, `${item.output} metafile must describe one standalone output`);
  const [[outputPath, output]] = outputEntries;
  assert.equal(output.entryPoint, item.entry, `${item.output} metafile must record entry point ${item.entry}`);
  const bundledInquirerPackages = assertInquirerBundled(result.metafile, item);
  return {
    output: item.output,
    metafile: true,
    standalone: true,
    metafileOutput: outputPath,
    bytes: output.bytes,
    inputCount: Object.keys(result.metafile.inputs ?? {}).length,
    bundledInquirerPackages,
    externalImports: externalImports(result.metafile)
  };
}

function assertOutputSet(outputFiles, outputRoot) {
  const actual = outputFiles.map((file) => path.relative(outputRoot, file.path).split(path.sep).join("/")).sort();
  const expected = EXPECTED_OUTPUTS.map((item) => item.output).sort();
  assert.deepEqual(actual, expected, "package build produced unexpected files");
  for (const relativePath of actual) {
    assert.doesNotMatch(relativePath, /(?:\.map$|\/[^/]*chunk[^/]*\.[cm]?js$)/iu, `unexpected map or chunk ${relativePath}`);
  }
}

async function buildAll(outputRoot, write) {
  const outputFiles = [];
  const proof = [];
  for (const item of EXPECTED_OUTPUTS) {
    const outfile = path.join(outputRoot, item.output);
    const result = await build({
      absWorkingDir: PACKAGE_ROOT,
      entryPoints: [item.entry],
      outfile,
      bundle: true,
      splitting: false,
      sourcemap: false,
      platform: "node",
      target: "node22",
      format: "esm",
      packages: "bundle",
      external: ["node:*"],
      define: PACKAGE_DEFINES,
      banner: {
        js: "import { createRequire as __doveCreateRequire } from \"node:module\"; const require = __doveCreateRequire(import.meta.url);"
      },
      metafile: true,
      write,
      logLevel: "silent"
    });
    assertExternalImports(result.metafile, item.output);
    proof.push(assertMetafileStandaloneProof(result, item));
    if (write) {
      outputFiles.push({ path: outfile, contents: fs.readFileSync(outfile) });
    } else {
      assert.equal(result.outputFiles.length, 1, `${item.output} must be one standalone file`);
      outputFiles.push(...result.outputFiles);
    }
  }
  assertOutputSet(outputFiles, outputRoot);
  for (const item of EXPECTED_OUTPUTS.filter((entry) => entry.shebang)) {
    const output = outputFiles.find((file) => projectRelative(file.path).endsWith(item.output) || path.relative(outputRoot, file.path).split(path.sep).join("/") === item.output);
    assert.ok(output, `missing ${item.output}`);
    assert.match(Buffer.from(output.contents).toString("utf8"), /^#!\/usr\/bin\/env node\n/u, `${item.output} must keep its shebang`);
  }
  return { outputFiles, proof };
}

async function checkBuild() {
  const tempBase = path.join(PACKAGE_ROOT, ".claude", "tmp", "package-build-checks");
  fs.mkdirSync(tempBase, { recursive: true });
  const tempRoot = fs.mkdtempSync(path.join(tempBase, "dove-package-build-"));
  try {
    const { outputFiles, proof } = await buildAll(tempRoot, false);
    console.error(`Package build proof: ${JSON.stringify(proof)}`);
    for (const item of EXPECTED_OUTPUTS) {
      const trackedPath = path.join(PACKAGE_ROOT, item.output);
      assert.ok(fs.existsSync(trackedPath), `${item.output} is missing; run npm run build`);
      const generated = outputFiles.find((file) => path.relative(tempRoot, file.path).split(path.sep).join("/") === item.output);
      assert.ok(generated, `temporary build missing ${item.output}`);
      assert.ok(fs.readFileSync(trackedPath).equals(Buffer.from(generated.contents)), `${item.output} has build drift; run npm run build`);
    }
    console.error("Package bundles are up to date.");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    try { fs.rmdirSync(tempBase); } catch (error) { if (error?.code !== "ENOTEMPTY" && error?.code !== "ENOENT") throw error; }
  }
}

if (CHECK_MODE) {
  await checkBuild();
} else {
  const { proof } = await buildAll(PACKAGE_ROOT, true);
  for (const item of EXPECTED_OUTPUTS.filter((entry) => entry.shebang)) {
    fs.chmodSync(path.join(PACKAGE_ROOT, item.output), 0o755);
  }
  console.log(JSON.stringify({ written: EXPECTED_OUTPUTS.map((item) => item.output), proof }, null, 2));
}

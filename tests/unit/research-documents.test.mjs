import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { inspectResearchDocuments, RESEARCH_DOCUMENT_PATHS } from "../../src/core/research-documents.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function write(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

test("absent research documents are normal", () => {
  const root = createTempRoot("dove-documents-absent-");
  assert.deepEqual(inspectResearchDocuments(root), {
    healthy: true,
    state: "absent",
    root: RESEARCH_DOCUMENT_PATHS.root,
    overview: null,
    lessons: null
  });
});

test("exact v2 marker is reported as an explicit export opportunity", () => {
  const root = createTempRoot("dove-documents-v2-");
  write(root, ".dove/format.json", '{"format":"dove-research-v2"}\n');
  assert.deepEqual(inspectResearchDocuments(root), {
    healthy: true,
    state: "previous-research-format",
    root: RESEARCH_DOCUMENT_PATHS.root,
    overview: null,
    lessons: null,
    exportCommand: "dove export-research"
  });
});

test("arbitrary UTF-8 Markdown is accepted without headings or frontmatter", () => {
  const root = createTempRoot("dove-documents-current-");
  write(root, RESEARCH_DOCUMENT_PATHS.overview, "当前先验证失败案例。\n\n[实验](experiments/失败案例.md)\n");
  write(root, RESEARCH_DOCUMENT_PATHS.lessons, "保留负结果。\n");
  assert.deepEqual(inspectResearchDocuments(root), {
    healthy: true,
    state: "current",
    root: RESEARCH_DOCUMENT_PATHS.root,
    overview: { path: RESEARCH_DOCUMENT_PATHS.overview },
    lessons: { path: RESEARCH_DOCUMENT_PATHS.lessons }
  });
});

test("missing overview is normal while unsafe file shapes are reported without modifying files", () => {
  const missing = createTempRoot("dove-documents-missing-");
  fs.mkdirSync(path.join(missing, RESEARCH_DOCUMENT_PATHS.root), { recursive: true });
  const before = fs.readdirSync(missing, { recursive: true }).map(String).sort();
  assert.deepEqual(inspectResearchDocuments(missing), {
    healthy: true,
    state: "current",
    root: RESEARCH_DOCUMENT_PATHS.root,
    overview: null,
    lessons: null
  });
  assert.deepEqual(fs.readdirSync(missing, { recursive: true }).map(String).sort(), before);

  const linked = createTempRoot("dove-documents-symlink-");
  const outside = createTempRoot("dove-documents-outside-");
  write(outside, "RESEARCH.md", "outside\n");
  fs.mkdirSync(path.join(linked, ".dove"), { recursive: true });
  fs.symlinkSync(path.join(outside), path.join(linked, RESEARCH_DOCUMENT_PATHS.root));
  const linkedResult = inspectResearchDocuments(linked);
  assert.equal(linkedResult.state, "invalid");
  assert.match(linkedResult.error, /real directory|symbolic/iu);
});

test("invalid UTF-8 and null bytes are rejected structurally", () => {
  const invalid = createTempRoot("dove-documents-utf8-");
  write(invalid, RESEARCH_DOCUMENT_PATHS.overview, Buffer.from([0xc3, 0x28]));
  assert.match(inspectResearchDocuments(invalid).error, /valid UTF-8/iu);

  const nul = createTempRoot("dove-documents-null-");
  write(nul, RESEARCH_DOCUMENT_PATHS.overview, "research\0state\n");
  assert.match(inspectResearchDocuments(nul).error, /null bytes/iu);
});

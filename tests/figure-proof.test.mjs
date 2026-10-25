import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import zlib from "node:zlib";

import { findExecutable, figureTools } from "../src/core/figure-generation.mjs";
import { composeFigureProof, composePageOverview, lengthInInches, parseFigureSpec } from "../src/core/figure-proof.mjs";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(width, height, [r, g, b]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function pngSize(file) {
  const bytes = fs.readFileSync(file);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function pillowPython() {
  const candidates = [process.env.DOVE_FIGURE_PYTHON, figureTools({ env: process.env }).pptPython, findExecutable("python3", process.env)].filter(Boolean);
  return candidates.find((candidate) => spawnSync(candidate, ["-c", "import PIL"], { stdio: "ignore" }).status === 0) ?? null;
}

test("printed widths are read with their unit and each figure names its width", () => {
  assert.ok(Math.abs(lengthInInches("83.34mm") - 3.2811) < 1e-4);
  assert.equal(lengthInInches("3.28in"), 3.28);
  assert.ok(Math.abs(lengthInInches("236.84pt") - 3.2771) < 1e-4);
  assert.ok(Math.abs(lengthInInches("17.463 cm") - 6.875) < 1e-3);
  assert.throws(() => lengthInInches("3.28"), /with its unit/u);
  assert.throws(() => lengthInInches("0mm"), /out of range/u);
  assert.deepEqual(parseFigureSpec("figs/a@b.pdf@174.63mm").file, "figs/a@b.pdf");
  assert.throws(() => parseFigureSpec("figs/overview.pdf"), /<file>@<width>/u);
});

test("before/after and the whole set are composed at their printed widths", (t) => {
  const python = pillowPython();
  if (!python) {
    t.skip("no Python with Pillow on this machine");
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dove-proof-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "before.png"), png(200, 100, [200, 40, 40]));
  fs.writeFileSync(path.join(root, "after.png"), png(1200, 600, [40, 40, 200]));
  fs.writeFileSync(path.join(root, "wide.png"), png(2100, 700, [40, 160, 40]));

  const compare = composeFigureProof(root, { compare: true, before: "before.png", after: "after.png", width: "83.34mm", output: "checks/compare.png", python });
  const single = Math.round(lengthInInches("83.34mm") * 150);
  const [width] = pngSize(compare.outputPath);
  assert.ok(width > 2 * single && width < 2 * single + 150, "single-column figures sit side by side at their printed width");
  assert.deepEqual(compare.items.map((item) => item.enough), [false, true], "a 200-pixel raster is too soft for 83 mm at 300 dpi");
  assert.equal(compare.items[0].neededPx, Math.round(lengthInInches("83.34mm") * 300));

  const again = composeFigureProof(root, { compare: true, before: "before.png", after: "after.png", width: "83.34mm", output: "checks/compare.png", python });
  assert.notEqual(again.outputPath, compare.outputPath, "an existing proof is never overwritten");

  const proof = composeFigureProof(root, { proof: true, figure: ["wide.png@174.63mm", "before.png@83.34mm", "after.png@83.34mm"], output: "checks/set.png", python });
  const [setWidth, setHeight] = pngSize(proof.outputPath);
  const page = Math.round(lengthInInches("174.63mm") * 150);
  assert.ok(setWidth >= page && setWidth < page + 100, "the page is as wide as the widest figure");
  assert.ok(setHeight > Math.round((700 / 2100) * page) + single / 2, "the two single-column figures share a row below the wide one");
  assert.match(proof.items[0].label, /wide\.png - 174\.6 mm/u);
});

test("a manuscript's pages are laid out in one sheet with blank columns and the body length", (t) => {
  const python = pillowPython();
  const pdflatex = findExecutable("pdflatex", process.env);
  if (!python || !pdflatex || !findExecutable("pdftotext", process.env) || !findExecutable("pdftoppm", process.env)) {
    t.skip("needs Pillow, pdflatex and poppler");
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dove-pages-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const paragraph = "Garments are structured objects whose panels are sewn together and draped on a body, and a writer of such objects must keep every seam consistent. ".repeat(6);
  // Page one: the left column and a third of the right one; page two starts the references.
  const body = Array.from({ length: 5 }, () => paragraph).join("\n\n");
  fs.writeFileSync(path.join(root, "paper.tex"), [
    "\\documentclass[letterpaper,twocolumn,10pt]{article}",
    "\\usepackage[margin=0.75in]{geometry}",
    "\\begin{document}",
    "\\section{Introduction}",
    body,
    "\\clearpage",
    "\\section*{References}",
    Array.from({ length: 12 }, (_, index) => `[${index + 1}] A. Author and B. Author. A paper about panels and seams. In Proceedings, 2025.\n`).join("\n"),
    "\\end{document}",
    ""
  ].join("\n"));
  const build = spawnSync(pdflatex, ["-interaction=nonstopmode", "-halt-on-error", "paper.tex"], { cwd: root, encoding: "utf8" });
  assert.equal(build.status, 0, build.stdout.slice(-500));
  const result = composePageOverview(root, { pages: "paper.pdf", bodyPages: 2, output: "checks/pages.png", python });
  assert.equal(result.pages, 2);
  assert.equal(result.columns, 2);
  assert.equal(result.referencesPage, 2);
  assert.ok(result.bodyPages >= 1 && result.bodyPages < 1.2, `body pages ${result.bodyPages}`);
  assert.ok(result.flags.some((flag) => /第 1 页右栏底部空着约/u.test(flag)), result.flags.join("; "));
  assert.ok(result.flags.some((flag) => /上限 2 页，还有约/u.test(flag)), result.flags.join("; "));
  assert.ok(!result.flags.some((flag) => /第 2 页/u.test(flag)), "the reference pages are not a layout problem");
  assert.ok(fs.existsSync(result.outputPath));
});

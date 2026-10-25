import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import zlib from "node:zlib";

import { findExecutable, figureTools } from "../src/core/figure-generation.mjs";
import { composeFigureProof, lengthInInches, parseFigureSpec } from "../src/core/figure-proof.mjs";

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

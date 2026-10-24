import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { renderLedgerRow, roundLedger } from "../src/core/round-ledger.mjs";
import { ACTIVITY_BUCKET_MS, ACTIVITY_INDEX_PATH, USER_ORIGINALS_PATH } from "../src/core/user-originals.mjs";

const at = (iso) => Date.parse(iso);
const bucket = (iso) => String(Math.floor(at(iso) / ACTIVITY_BUCKET_MS));

function project(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dove-ledger-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [relative, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.writeFileSync(path.join(root, relative), text);
  }
  return path.resolve(root);
}

test("rounds on the same day are split where each result was first written", (t) => {
  const root = project(t, {
    ".dove/research/IDENTITY.md": "Current round: rounds/003-brief.md\nRound status: ongoing\n",
    ".dove/research/rounds/001-brief.md": "Author: mentor\n预测：F1 10 → 12–14\n",
    ".dove/research/rounds/001-result.md": "判定：未兑现\n实测：F1 10.5\n",
    ".dove/research/rounds/002-brief.md": "Author: mentor\n预测：F1 10.5 → 12\n",
    ".dove/research/rounds/002-result.md": "判定：兑现\n实测：F1 12.0\n",
    ".dove/research/rounds/003-brief.md": "Author: mentor\n",
    [USER_ORIGINALS_PATH]: [
      "- 2026-10-22 01:30 · 本人 · 继续跑",
      "- 2026-10-22 02:10 · 本人 · 别给自己设那么多限制",
      "- 2026-10-22 05:00 · 本人 · 说人话",
      "- 2026-10-22 07:00 · 本人 · 又跑偏了"
    ].join("\n")
  });
  const marks = {
    "brief:1": at("2026-10-22T01:00:00Z"),
    "result:1": at("2026-10-22T03:00:00Z"),
    "brief:2": at("2026-10-22T03:05:00Z"),
    "result:2": at("2026-10-22T06:00:00Z"),
    "brief:3": at("2026-10-22T06:10:00Z")
  };
  const buckets = {
    [bucket("2026-10-22T01:20:00Z")]: { agents: 2, chars: 1000, hedges: 3 },
    [bucket("2026-10-22T02:40:00Z")]: { agents: 1, compactions: 1, mentor: 1 },
    [bucket("2026-10-22T04:00:00Z")]: { agents: 5, chars: 2000, hedges: 2, gates: 4, claims: 2, unrun: 1 },
    [bucket("2026-10-22T07:00:00Z")]: { agents: 7 }
  };
  fs.writeFileSync(path.join(root, ACTIVITY_INDEX_PATH), JSON.stringify({ schema: 2, root, files: { "/t/a.jsonl": { offset: 1, buckets, marks } } }));
  const ledger = roundLedger(root, { now: at("2026-10-22T08:00:00Z") });
  const byNumber = Object.fromEntries(ledger.rows.map((row) => [row.number, row]));
  assert.deepEqual(ledger.rows.map((row) => row.number), [3, 2, 1], "newest first");
  assert.deepEqual([byNumber[1].agents, byNumber[1].compactions, byNumber[1].mentor, byNumber[1].corrections], [3, 1, 1, 1]);
  assert.deepEqual([byNumber[2].agents, byNumber[2].gates, byNumber[2].unrunClaims, byNumber[2].corrections], [5, 4, 1, 1]);
  assert.deepEqual([byNumber[3].agents, byNumber[3].open, byNumber[3].corrections], [7, true, 1], "the open round runs to now");
  assert.equal(byNumber[1].duration, "2 小时");
  assert.equal(byNumber[1].hedgesPer1k, 3);
  assert.equal(byNumber[1].calibration.hit, false);
  assert.equal(byNumber[2].calibration.hit, true);
  assert.deepEqual([ledger.summary.finished, ledger.summary.calibrated, ledger.summary.hits, ledger.summary.correctionsPerRound], [2, 2, 1, 1]);
  assert.match(renderLedgerRow(byNumber[1]), /^第 1 轮（.*，2 小时）；子代理 3 次、上下文压缩 1 次、导师 1 次；用户纠正 1 次；判定 未兑现；预测 F1 10 → 12–14 → 实测 F1 10\.5（不在预测范围内，预测的变化是实际的 6 倍）/u);
});

test("without scanned transcripts the ledger still lists rounds, verdicts and corrections", (t) => {
  const root = project(t, {
    ".dove/research/rounds/001-brief.md": "Author: mentor\n",
    ".dove/research/rounds/001-result.md": "判定：方法取舍（放弃类别分支）\n"
  });
  const ledger = roundLedger(root, { now: Date.now() });
  assert.equal(ledger.activityScanned, false);
  assert.deepEqual([ledger.rows[0].agents, ledger.rows[0].verdictLabel, ledger.rows[0].corrections], [null, "方法取舍", 0]);
  assert.match(renderLedgerRow(ledger.rows[0]), /判定 方法取舍（放弃类别分支）；没写预测和实测$/u);
});

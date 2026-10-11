import assert from "node:assert/strict";
import test from "node:test";

import { identityCardContext, parseDoveCurrentRound, readDoveIdentityCard } from "../../src/core/identity-card.mjs";

test("oversized identity retains a UTF-8-safe beginning instead of becoming missing", () => {
  const beginning = "Mainline: 合成目标\nCurrent round: rounds/003-brief.md\nRound status: ongoing\n";
  const card = beginning + "甲".repeat(1500);
  const options = {
    fsOps: {
      realpathSync: (target) => target,
      lstatSync: (target) => ({ isSymbolicLink: () => false, isDirectory: () => !target.endsWith(".md"), isFile: () => target.endsWith(".md") }),
      readFileSync: () => Buffer.from(card)
    }
  };
  const text = readDoveIdentityCard("/virtual", options);
  assert.ok(Buffer.byteLength(text) <= 4096);
  assert.ok(text.startsWith(beginning));
  assert.equal(text.includes("�"), false);
  const context = identityCardContext("/virtual", options);
  assert.match(context, /exceeds 4KB/iu);
  assert.doesNotMatch(context, /No readable/iu);
  assert.deepEqual(parseDoveCurrentRound(text), { brief: "rounds/003-brief.md", ongoing: true });
});

import test from "node:test";

import { assertCliParserAndRenderers } from "./cli-renderers.mjs";
import { assertDoveStatusLineRenderer } from "./statusline.mjs";

test("CLI parser and output renderers expose the current Dove runtime surface", () => {
  assertCliParserAndRenderers();
});

test("Dove status line renders native session facts without inventing research state", () => {
  assertDoveStatusLineRenderer();
});

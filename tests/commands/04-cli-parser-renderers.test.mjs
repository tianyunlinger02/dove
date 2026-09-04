import test from "node:test";

import { assertCliParserAndRenderers } from "./cli-renderers.mjs";

test("CLI parser and output renderers expose the current Dove runtime surface", () => {
  assertCliParserAndRenderers();
});

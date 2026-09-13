import test from "node:test";

import { assertCliParserAndRenderers } from "./cli-renderers.mjs";
import { assertDoveStatusLineCli, assertDoveStatusLineRenderer, assertResearchMainlineParsing, assertResearchMainlineReadBoundary } from "./statusline.mjs";

test("CLI parser and output renderers expose the current Dove runtime surface", () => {
  assertCliParserAndRenderers();
});

test("Dove status line renders native session facts without inventing research state", () => {
  assertDoveStatusLineRenderer();
});

test("Dove mainline display accepts only a unique ordinary overview line", () => {
  assertResearchMainlineParsing();
});

test("Dove mainline display reads only the bounded root overview without writes", () => {
  assertResearchMainlineReadBoundary();
});

test("Dove source and bundled statusline CLI preserve the two-line read-only display", () => {
  assertDoveStatusLineCli();
});

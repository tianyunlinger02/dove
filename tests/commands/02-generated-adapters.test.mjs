import test from "node:test";

import {
  assertCanonicalTerminology,
  assertGeneratedAdapters
} from "./generated-surfaces.mjs";

test("Dove terminology avoids ambiguous route language", () => {
  assertCanonicalTerminology();
});

test("generated host adapters match canonical command renderers", () => {
  assertGeneratedAdapters();
});

import test from "node:test";

import {
  assertCanonicalTerminology,
  assertGeneratedAdapters,
  assertSourceIdentityGuidanceProjection
} from "./generated-surfaces.mjs";

test("Dove terminology avoids ambiguous route language", () => {
  assertCanonicalTerminology();
});

test("generated host adapters match canonical command renderers", () => {
  assertGeneratedAdapters();
});

test("Source DOI identity guidance stays canonical and projected", () => {
  assertSourceIdentityGuidanceProjection();
});

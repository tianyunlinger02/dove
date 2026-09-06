import test from "node:test";

import {
  assertCanonicalTerminology,
  assertFinalEntrypointWiring,
  assertGeneratedAdapters,
  assertSourceIdentityGuidanceProjection
} from "./generated-surfaces.mjs";

test("Dove terminology avoids ambiguous route language", () => {
  assertCanonicalTerminology();
});

test("generated host adapters match canonical command renderers", () => {
  assertGeneratedAdapters();
});

test("final Claude context + command and standalone DSH preserve scientific judgment", () => {
  assertFinalEntrypointWiring();
});

test("Source DOI identity guidance stays canonical and projected", () => {
  assertSourceIdentityGuidanceProjection();
});

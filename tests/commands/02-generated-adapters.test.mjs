import test from "node:test";

import {
  assertFinalEntrypointWiring,
  assertGeneratedAdapters,
  assertQualityReferenceResources,
  assertSourceIdentityGuidanceProjection
} from "./generated-surfaces.mjs";

test("generated host adapters match canonical command renderers", () => {
  assertGeneratedAdapters();
});

test("final Claude context + command and standalone DSH preserve scientific judgment", () => {
  assertFinalEntrypointWiring();
});

test("Source DOI identity guidance stays canonical and projected", () => {
  assertSourceIdentityGuidanceProjection();
});

test("quality references are rendered and included in host installation resources", () => {
  assertQualityReferenceResources();
});

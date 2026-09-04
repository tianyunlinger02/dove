import test from "node:test";

import {
  assertAmbientRouting,
  assertPackagedAgentPolicy,
  assertPublicDocumentationBoundaries,
  assertResearchDefaultsOwnership,
  assertTrellisSpecMirrors,
  assertUserFacingCliOutput
} from "./ambient-docs.mjs";

test("ambient routing and hidden support guidance stay conservative", () => {
  assertAmbientRouting();
});

test("packaged agent policy remains one Dove research agent", () => {
  assertPackagedAgentPolicy();
});

test("user-facing CLI output stays aligned with Dove lifecycle semantics", () => {
  assertUserFacingCliOutput();
});

test("public documentation preserves Dove boundaries", () => {
  assertPublicDocumentationBoundaries();
});

test("research defaults preserve researcher ownership", () => {
  assertResearchDefaultsOwnership();
});

test("Trellis frontend specs match installed Markdown templates", () => {
  assertTrellisSpecMirrors();
});

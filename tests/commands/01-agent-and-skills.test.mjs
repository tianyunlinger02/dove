import test from "node:test";

import {
  assertDoveAgentPersona,
  assertHostPolicy,
  assertSkillManifest
} from "./agent-capabilities.mjs";

test("Dove agent persona and packaged agent definition", () => {
  assertDoveAgentPersona();
});

test("Dove flat Skill manifest and semantic contracts", () => {
  assertSkillManifest();
});

test("host adapter and response policies stay bounded", () => {
  assertHostPolicy();
});

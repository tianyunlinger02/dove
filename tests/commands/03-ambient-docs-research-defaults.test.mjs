import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  DOVE_RESEARCH_CORRECTION_RECORDING,
  DOVE_RESEARCH_EVALUATION,
  DOVE_RESEARCH_ROUND_RECORDS
} from "../../src/core/dove-research-contract.mjs";
import {
  RESEARCH_DEFAULT_DIRECTORY_PATHS,
  RESEARCH_DEFAULT_DOCUMENTS,
  RESEARCH_DEFAULT_PATHS
} from "../../src/core/research-defaults.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("research bootstrap indexes researcher-owned records without prepopulating research state", () => {
  assert.deepEqual(RESEARCH_DEFAULT_DOCUMENTS.map(({ path: documentPath }) => documentPath), [RESEARCH_DEFAULT_PATHS.overview]);
  assert.deepEqual(RESEARCH_DEFAULT_DIRECTORY_PATHS, [RESEARCH_DEFAULT_PATHS.root]);
  assert.equal(RESEARCH_DEFAULT_PATHS.identity, ".dove/research/IDENTITY.md");
  assert.equal(RESEARCH_DEFAULT_PATHS.evaluation, ".dove/research/EVAL.md");
  assert.equal(RESEARCH_DEFAULT_PATHS.roundsDirectory, ".dove/research/rounds");
  const overview = RESEARCH_DEFAULT_DOCUMENTS[0].content;
  for (const name of ["IDENTITY.md", "EVAL.md", "rounds/", "MENTOR_NOTES.md"]) assert.ok(overview.includes(name));
  assert.match(overview, /user confirms Mainline.*standards.*parallel candidates.*user to choose before method implementation/iu);
  assert.match(overview, /short history index.*leave existing.*in place/iu);
});

test("identity cards retain bounded current state, target tier and sourced restriction scope", () => {
  const card = DOVE_RESEARCH_CORRECTION_RECORDING;
  // These are continuation fields and source/scope distinctions, not a prose template.
  for (const field of ["Current round:", "Round status:", "Mainline", "Target tier", "Deployment inputs/outputs", "Completion", "User restrictions", "Recent corrections", "Research state"]) {
    assert.ok(card.includes(field), `Identity field: ${field}`);
  }
  assert.match(card, /IDENTITY\.md.*1200 characters/iu);
  assert.match(card, /Ask once.*target tier.*missing.*do not assume/iu);
  assert.match(card, /quotation.*date\/source.*original user wording or a relay.*long-term or task-specific/iu);
  assert.match(card, /Relays and task-specific limits are not standing restrictions/iu);
  assert.match(card, /research state after important results.*corrections to action/iu);
});

test("round briefs and results are attributable bounded records linking ordinary artifacts", () => {
  const records = DOVE_RESEARCH_ROUND_RECORDS;
  for (const field of ["rounds/NNN-brief.md", "NNN-result.md", "Author: mentor / user / external", "Changes and version", "Measurements and artifacts", "Prediction versus actual", "Objections to this brief / factual corrections"]) {
    assert.ok(records.includes(field), `Round field: ${field}`);
  }
  assert.match(records, /one brief.*2000.*one result.*3000/iu);
  assert.match(records, /supporting materials in ordinary project directories/iu);
  assert.match(records, /direct user tasks have priority.*external.*mentor/iu);
  assert.match(records, /Save mentor briefs verbatim.*replacement briefs.*author and reason/iu);
  assert.match(records, /historical missions\/.*experiments\/.*claims\/.*without adding entries/iu);
});

test("EVAL is a fixed per-version comparison table with one replaceable current mentor assessment", () => {
  const evaluation = DOVE_RESEARCH_EVALUATION;
  const columns = ["Date", "Version/round", "Protocol/split", "Measurements", "Unseen data/train-test gap", "Conclusion", "Artifacts"];
  assert.ok(evaluation.includes(columns.join("; ")), "The fixed columns keep measurements, generalization and artifact provenance together");
  assert.match(evaluation, /one row per method version/iu);
  assert.match(evaluation, /one short sentence.*200 characters/iu);
  assert.match(evaluation, /engineering logs and process status out/iu);
  assert.match(evaluation, /current eight-dimensional assessment below the table.*1000 characters.*replacing/iu);
});

test("Trellis specs match their installed Markdown templates", () => {
  for (const layer of ["frontend", "guides"]) {
    const source = path.join(ROOT, ".trellis/spec", layer);
    const template = path.join(ROOT, "src/templates/markdown/spec", layer);
    const names = (directory) => fs.readdirSync(directory).filter((name) => name.endsWith(".md")).sort();
    assert.deepEqual(names(template), names(source));
    for (const name of names(source)) {
      assert.ok(
        fs.readFileSync(path.join(source, name)).equals(fs.readFileSync(path.join(template, name))),
        `${layer}/${name}`
      );
    }
  }
});

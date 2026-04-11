import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ensureWorkspace,
  evaluateEvidence,
  initProject,
  loadBoard,
  refreshWiki,
  runReviewLoop,
  syncCitations,
  upsertClaims,
  upsertDraft,
  upsertExperimentPlan,
  upsertExperimentResult,
  upsertNote,
  upsertOutline
} from "../../src/core/index.mjs";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "paper-factory-evidence-"));
}

test("upsertClaims rejects claims with unknown sources", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  upsertNote(root, {
    title: "note",
    sectionId: "introduction",
    summary: "summary"
  });

  assert.throws(() => {
    upsertClaims(root, {
      claims: [{ id: "claim-1", text: "Unsupported", sectionId: "introduction", sourceIds: ["missing-source"] }]
    });
  }, /unknown sources/);
});

test("strict mode blocks drafting before evidence exists", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { strictMode: true });

  assert.throws(() => {
    upsertDraft(root, {
      sectionId: "introduction",
      body: "# Introduction\n\nPremature draft.\n"
    });
  }, /Strict mode requires an approved outline stage before drafting/);
});

test("strict mode requires the real planning stage before outlining", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { strictMode: true });

  assert.throws(() => {
    upsertOutline(root, {
      sections: [{ id: "introduction", title: "Introduction", status: "drafting", goal: "Goal" }]
    });
  }, /Strict mode requires planning before outlining/);
});

test("upsertNote rejects unknown source references", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  assert.throws(() => {
    upsertNote(root, {
      title: "bad note",
      sectionId: "introduction",
      sourceIds: ["missing-source"],
      summary: "summary"
    });
  }, /unknown sources/);
});

test("upsertClaims merges claims instead of overwriting the full index", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  fs.writeFileSync(path.join(root, ".paper", "sources", "index.json"), JSON.stringify({
    version: 1,
    items: [
      { id: "source-a", citationKey: "source-a", title: "A", authors: [], year: 2024 },
      { id: "source-b", citationKey: "source-b", title: "B", authors: [], year: 2025 }
    ],
    updatedAt: null
  }, null, 2));

  upsertClaims(root, {
    claims: [{ id: "claim-a", text: "Claim A", sectionId: "introduction", sourceIds: ["source-a"] }]
  });
  const merged = upsertClaims(root, {
    claims: [{ id: "claim-b", text: "Claim B", sectionId: "method", sourceIds: ["source-b"] }]
  });

  assert.equal(merged.claims.length, 2);
  assert.equal(loadBoard(root).currentPhase, "plan");
});

test("experiment results reject unknown outcomes and mismatched claim links", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  fs.writeFileSync(path.join(root, ".paper", "sources", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }],
    updatedAt: null
  }, null, 2));
  fs.writeFileSync(path.join(root, ".paper", "notes", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "intro-note", title: "Intro note", sectionId: "introduction", sourceIds: ["known-source"], summary: "summary" }],
    updatedAt: null
  }, null, 2));
  upsertClaims(root, {
    claims: [{ id: "claim-1", text: "Claim 1", sectionId: "introduction", sourceIds: ["known-source"], noteIds: ["intro-note"] }]
  });
  upsertExperimentPlan(root, {
    id: "exp-1",
    title: "Experiment 1",
    claimId: "claim-1",
    methodology: "Method",
    successMetric: "Metric"
  });
  const preservedPlan = upsertExperimentPlan(root, {
    id: "exp-1",
    status: "in-progress"
  });
  assert.equal(preservedPlan.claimId, "claim-1");

  assert.throws(() => {
    upsertExperimentResult(root, {
      experimentId: "exp-1",
      claimId: "claim-1",
      outcome: "mystery"
    });
  }, /invalid outcome/);

  assert.throws(() => {
    upsertExperimentResult(root, {
      experimentId: "exp-1",
      claimId: "claim-2",
      outcome: "supports"
    });
  }, /unknown claim/);

  assert.throws(() => {
    upsertExperimentResult(root, {
      experimentId: "exp-1",
      outcome: "supports"
    });
  }, /must include claimId/);
});

test("review loop flags unknown citations and draft-claim mismatches", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  fs.writeFileSync(path.join(root, ".paper", "sources", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }],
    updatedAt: null
  }, null, 2));
  fs.writeFileSync(path.join(root, ".paper", "notes", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "intro-note", title: "Intro note", sectionId: "introduction", sourceIds: ["known-source"], summary: "summary" }],
    updatedAt: null
  }, null, 2));

  upsertClaims(root, {
    claims: [{ id: "claim-1", text: "Claim 1", sectionId: "introduction", sourceIds: ["known-source"], noteIds: ["intro-note"] }]
  });
  upsertDraft(root, {
    sectionId: "introduction",
    body: "# Introduction\n\nThis section cites [cite:unknown-source].\n"
  });

  const evidence = evaluateEvidence(root);
  assert.equal(evidence.missingCitationRefs.length, 1);
  assert.equal(evidence.draftClaimMismatches.length, 1);

  const review = runReviewLoop(root, { scope: "introduction" });
  assert.equal(review.verdict, "needs-evidence");
});

test("citation sync writes references and wiki/rebuttal helpers create artifacts", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  fs.writeFileSync(path.join(root, ".paper", "sources", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "known-source", citationKey: "known-source", title: "Known", authors: ["Doe"], year: 2026, sourceType: "paper" }],
    updatedAt: null
  }, null, 2));
  fs.writeFileSync(path.join(root, ".paper", "notes", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "intro-note", title: "Intro note", sectionId: "introduction", sourceIds: ["known-source"], summary: "summary" }],
    updatedAt: null
  }, null, 2));

  upsertDraft(root, {
    sectionId: "introduction",
    body: "# Introduction\n\nSupported text [cite:known-source].\n"
  });

  const citations = syncCitations(root, { citedOnly: true });
  assert.equal(citations.missingKeys.length, 0);
  const bib = fs.readFileSync(path.join(root, ".paper", "bibliography", "references.bib"), "utf8");
  assert.match(bib, /@article\{known-source/);

  const wiki = refreshWiki(root);
  assert.equal(wiki.wikiPath, ".paper/wiki/index.md");
});

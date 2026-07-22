import test from "node:test";
import assert from "node:assert/strict";

import { publicErrorMessage, publicResult } from "../../src/mcp/handlers.mjs";
import { toolDefinitions } from "../../src/mcp/tool-definitions.mjs";

const INTERNAL_TEXT = /\.dove\/|\/home\/|\b[0-9a-f]{64}\b|\b(?:workspaceId|contractDigest|receiptId|criterionId|proposalDigest|proposalToken|confirmArgs|exactReplay|mutationMode|MutationContext)\b/u;
const INTERNAL_KEYS = /^(?:workspaceId|missionId|sourceId|noteId|claimId|experimentId|figureId|reviewId|exchangeId|versionId|lessonId|receiptId|criterionId|contractDigest|sha256|.*Sha256|.*Digest|.*Token|confirmation|mutation|diagnostics|writes|paths)$/u;

function assertPublic(value, location = "root") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPublic(item, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      assert.doesNotMatch(key, INTERNAL_KEYS, `${location} leaked ${key}`);
      assertPublic(item, `${location}.${key}`);
    }
    return;
  }
  if (typeof value === "string") assert.doesNotMatch(value, INTERNAL_TEXT, `${location} leaked ${value}`);
}

const fixtures = {
  init_dove_goal: { status: "initialized", summary: "Initialized workspace-raw-id.", workspaceId: "workspace-raw-id" },
  create_dove_mission: { status: "materialized", summary: "The mission checkpoint is ready.", missionId: "mission-raw-id", mission: { missionId: "mission-raw-id" }, executionHandoff: { missionId: "mission-raw-id", contractDigest: "a".repeat(64) }, confirmation: { confirmArgs: { missionId: "mission-raw-id", proposalDigest: "b".repeat(64) } }, contractDigest: "a".repeat(64) },
  query_dove_mission: { status: "proposal", mission: { goal: "Write report", scope: ["public"], outOfScope: [], targetArtifacts: ["report.md"], expectedArtifacts: [".dove/private.json"], completionCriteria: ["Report complete"], evidenceRequirements: ["source:source-secret", "artifact:report.md"] } },
  query_dove_status: { status: "ok", detail: "full", summary: "Schema 9 healthy.", currentContext: { missionCount: 1, missionScope: "only-mission", receiptCount: 3, sourceCount: 2, integrityAssessment: { status: "incomplete", complete: false, incompleteReasons: ["receipt-schema-invalid"] }, reviewValidity: { covered: false, authoritative: false, failures: ["trusted-review-issuer-missing"] }, researchTree: { nodeCount: 2, statusCounts: { pending: 1, completed: 1 } } }, needsAttention: { status: "incomplete", summary: "Needs work.", reasons: ["contract-digest-stale"], stableGaps: { completion: ["receipt-schema-invalid"], domain: ["report.md", ".dove/private.json"], review: ["review-receipt-missing"], supersession: null } }, nextStep: { label: "Continue report work.", command: "node internal" } },
  ingest_execution_receipt: { status: "ingested", receipt: { receiptId: "receipt-raw-id", artifacts: [{ path: "report.md", kind: "report", sha256: "a".repeat(64) }, { path: ".dove/private.json", kind: "data", sha256: "b".repeat(64) }], validations: [{ reference: "test.log", kind: "test-log", outputHash: "c".repeat(64) }] }, completion: { assessment: { status: "incomplete", complete: false, incompleteReasons: ["criteria-coverage-missing"], artifactCoverage: [{ path: "report.md", covered: true }], criterionCoverage: [], evidenceRequirements: [] } } },
  close_host_outcome: { status: "ingested", receipt: { receiptId: "receipt-host-outcome-raw-id", artifacts: [{ path: "report.md", kind: "other", sha256: "a".repeat(64) }], validations: [{ reference: "test.log", kind: "validation-log", outputHash: "c".repeat(64) }], producer: { kind: "public-execution", actionId: "ingest-execution-receipt" } }, completion: { assessment: { status: "incomplete", complete: false, incompleteReasons: ["criteria-coverage-missing"], artifactCoverage: [{ path: "report.md", covered: true }], criterionCoverage: [], evidenceRequirements: [] } } },
  assess_mission_completion: { status: "incomplete", complete: false, missionId: "mission-raw-id", contractDigest: "a".repeat(64), incompleteReasons: ["execution-receipt-missing"], artifactCoverage: [{ path: "report.md", covered: false, reason: "artifact-current-owner-missing", receiptId: null }], criterionCoverage: [{ criterionId: "criterion-raw-id", criterion: "Write report", covered: false }], evidenceRequirements: [{ requirementId: "requirement-raw-id", requirement: "artifact:report.md", satisfied: false, reason: "required-artifact-not-current" }], diagnostics: { missionPath: ".dove/missions/mission-raw-id.json" } },
  search_network: { status: "ok", summary: "Found one candidate.", candidates: [{ providerId: "provider-raw-id", title: "Paper", url: "https://example.org/paper", snippet: "Useful", sourceName: "Example", publishedAt: "2026-01-01", authors: ["A"], openAccess: true, registrationDraft: { sourceId: "source-raw-id" } }], providerReports: [{ providerId: "provider-raw-id", displayName: "Example", kind: "scholarly", access: "public", status: "ok", resultCount: 1, fetchedCount: 1, capabilities: ["search"], error: null }], nextStep: { label: "Open the candidate.", why: "Verify it.", requiredActions: ["Read it"] } },
  query_network_search_providers: { status: "ok", summary: "One provider available.", providers: [{ providerId: "provider-raw-id", displayName: "Example", kind: "web", status: "available", capabilities: ["search"] }] },
  query_sources: { status: "ok", items: [{ sourceId: "source-raw-id", missionId: "mission-raw-id", contractDigest: "a".repeat(64), title: "Source", authors: ["A"], year: 2026, locator: "https://example.org", sourceType: "web", abstract: "Abstract", lifecycle: "candidate", eligibility: { eligible: false, reason: "source-candidate" }, capturedMaterial: { path: ".dove/sources/materials/raw", sha256: "b".repeat(64) } }] },
  query_dove_lessons: { status: "ok", workspaceId: "workspace-raw-id", items: [{ lessonId: "lesson-raw-id", missionId: "mission-raw-id", contractDigest: "a".repeat(64), scope: "mission", kind: "method", summary: "Reuse evidence.", details: "Visible guidance.", nextTimeGuidance: ["Check first."], tags: ["review"], assessment: { current: true, successorLessonId: "lesson-next" } }] },
  record_dove_lesson: { status: "recorded", summary: "Recorded lesson lesson-raw-id.", lesson: { lessonId: "lesson-raw-id" }, mutation: { paths: [".dove/lessons/lesson-raw-id.json"] } },
  register_source: { status: "recorded", summary: "Registered source candidate source-raw-id.", source: { sourceId: "source-raw-id", capturedMaterial: { path: ".dove/source" } } },
  verify_source: { status: "recorded", summary: "Rejected source source-raw-id.", source: { sourceId: "source-raw-id" } },
  upsert_note: { status: "recorded", summary: "Recorded note note-raw-id.", artifacts: [{ path: ".dove/notes/note-raw-id.json", sha256: "a".repeat(64) }] },
  upsert_claims: { status: "recorded", summary: "Recorded 2 evidence-backed claim(s).", artifacts: [{ path: ".dove/claims/claim-one.json" }] },
  run_experience_workflow: { status: "recorded", summary: "Recorded experiment experiment-raw-id plan, result, and audit.", result: { resultId: "experiment-raw-id", outcome: "Accuracy improved.", evidenceRefs: ["artifact:report.md"] }, audit: { auditId: "experiment-raw-id", passed: false, findings: ["One check failed."], integrityFlags: ["missing-baseline"] } },
  upsert_draft: { status: "recorded", summary: "Recorded draft draft-raw-id.", artifacts: [{ path: ".dove/drafts/draft-raw-id.md" }] },
  upsert_draft_metadata: { status: "recorded", summary: "Recorded metadata for draft draft-raw-id.", artifacts: [{ path: ".dove/drafts/draft-raw-id.metadata.json" }] },
  run_figure_workflow: { status: "recorded", summary: "Imported figure figure-raw-id with provenance and QA.", imported: { figureId: "figure-raw-id", importedFrom: "outputs/figure.png", finalPath: ".dove/figures/figure-raw-id.final.png", finalSha256: "a".repeat(64), caption: "Visible caption." }, qa: { status: "needs-fix", findings: ["Label overlaps."], reviewCoverage: { covered: false, authoritative: false, failures: ["trusted-review-issuer-missing"] } } },
  prepare_review_exchange: { status: "prepared", policy: "external", reviewedArtifactPaths: ["report.md"], exchangeId: "exchange-raw-id", actionablePaths: { input: { path: ".dove/review/input.json", sha256: "a".repeat(64) } } },
  import_review_exchange: { status: "imported", exchangeId: "exchange-raw-id", reviewId: "review-raw-id", review: { status: "completed", verdict: "needs-revision", summary: "Strengthen the baseline.", reviewedArtifactPaths: ["report.md"], findings: [{ findingId: "finding-raw-id", severity: "high", summary: "Baseline is weak.", linkedArtifactPaths: ["report.md"] }], actionItems: ["Add a baseline."], authority: { authoritative: false, issuer: null } } },
  verify_review_coverage: { status: "not-covered", zeroWrite: true, missionId: "mission-raw-id", contractDigest: "a".repeat(64), requestedArtifactPaths: ["report.md"], requestedArtifactSetSha256: "b".repeat(64), covered: false, authoritative: false, failures: ["current-exact-review-coverage-missing", "trusted-review-issuer-missing"], reviews: [{ reviewId: "review-raw-id", reviewPath: ".dove/reviews/review-raw-id.json", verdict: "needs-revision", current: false, authoritative: false, reviewedArtifactPaths: ["report.md"], failures: ["reviewed-artifact-set-hash-mismatch"] }] },
  normalize_rebuttal_issues: { status: "recorded", summary: "Normalized 2 rebuttal issue(s).", artifacts: [{ path: ".dove/rebuttal/issues.json" }] },
  build_rebuttal_strategy: { status: "recorded", summary: "Recorded author-side rebuttal strategy.", artifacts: [{ path: ".dove/rebuttal/strategy.json" }] },
  build_rebuttal: { status: "recorded", summary: "Recorded author-side rebuttal responses.", artifacts: [{ path: ".dove/rebuttal/response.md" }] },
  create_version_snapshot: { status: "recorded", summary: "Created version snapshot version-raw-id.", artifacts: [{ path: ".dove/versions/version-raw-id.json" }] },
  compare_versions: { status: "compared", zeroWrite: true, comparison: { schemaVersion: 1, missionId: "mission-raw-id", fromVersionId: "version-one", toVersionId: "version-two", added: ["added.md", ".dove/private"], removed: ["removed.md"], changed: ["changed.md"] } }
};

test("public projection covers every MCP tool without internal identifiers or paths", () => {
  assert.equal(toolDefinitions.length, 28);
  assert.deepEqual(new Set(Object.keys(fixtures)), new Set(toolDefinitions.map((tool) => tool.name)));
  for (const tool of toolDefinitions) {
    const projected = publicResult(tool.name, fixtures[tool.name]);
    assertPublic(projected, tool.name);
    assert.equal(typeof projected.message, "string", `${tool.name} needs a useful message`);
    assert.notEqual(projected.message, "compact", `${tool.name} returned a display mode as its message`);
    assert.notEqual(projected.message, "full", `${tool.name} returned a display mode as its message`);
  }
});

test("completion, review, experiment, figure, and version projections retain business outcomes", () => {
  const completion = publicResult("assess_mission_completion", fixtures.assess_mission_completion);
  assert.equal(completion.completion.complete, false);
  assert.equal(completion.completion.gaps.length, 1);
  assert.deepEqual(completion.completion.artifacts.map((item) => item.path), ["report.md"]);

  const unavailable = publicResult("close_host_outcome", {
    ...fixtures.close_host_outcome,
    completion: {
      assessment: null,
      assessmentUnavailable: true
    }
  });
  assert.equal(unavailable.completion.status, "unavailable");
  assert.deepEqual(unavailable.verification, [{ path: "test.log", kind: "validation-log" }]);

  const review = publicResult("verify_review_coverage", fixtures.verify_review_coverage);
  assert.equal(review.review.covered, false);
  assert.equal(review.review.failures.length, 2);
  assert.equal(review.review.reviews[0].verdict, "needs-revision");

  const imported = publicResult("import_review_exchange", fixtures.import_review_exchange);
  assert.equal(imported.review.verdict, "needs-revision");
  assert.equal(imported.review.findings[0].summary, "Baseline is weak.");
  assert.deepEqual(imported.review.actionItems, ["Add a baseline."]);

  const experiment = publicResult("run_experience_workflow", fixtures.run_experience_workflow);
  assert.equal(experiment.outcome.summary, "Accuracy improved.");
  assert.equal(experiment.verification.passed, false);

  const figure = publicResult("run_figure_workflow", fixtures.run_figure_workflow);
  assert.equal(figure.outcome.caption, "Visible caption.");
  assert.equal(figure.verification.status, "needs-fix");

  const comparison = publicResult("compare_versions", fixtures.compare_versions);
  assert.deepEqual(comparison.changes.added, [{ path: "added.md" }]);
  assert.deepEqual(comparison.changes.changed, [{ path: "changed.md" }]);
});

test("public errors redact internal paths, digests, replay controls, and tool identifiers", () => {
  const errors = [
    ["upsert_note", "upsert_note failed at .dove/notes/note-secret.json for mission-secret."],
    ["create_dove_mission", `proposalDigest ${"a".repeat(64)} and confirmArgs no longer match /home/user/project/.dove/missions/mission-secret.json.`],
    ["ingest_execution_receipt", "receiptId receipt-secret has contractDigest mismatch in MutationContext."],
    ["verify_source", "Unknown source: source-secret."],
    ["query_dove_status", "Mission mission-secret does not exist."]
  ];
  for (const [name, raw] of errors) {
    const message = publicErrorMessage(name, new Error(raw));
    assertPublic(message, name);
    assert.doesNotMatch(message, new RegExp(name, "u"));
  }
});

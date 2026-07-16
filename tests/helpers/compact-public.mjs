import assert from "node:assert/strict";

const FORBIDDEN_KEYS = new Set([
  "packetId",
  "packetIds",
  "taskPacketId",
  "missionPacketId",
  "runId",
  "receiptId",
  "boundaryId",
  "boundaryType",
  "implementationBoundaryType",
  "implementationReason",
  "ownerRole",
  "nextRole",
  "handoff",
  "handoffSuggestion",
  "providerId",
  "providerStatus",
  "providerError",
  "apiKeyEnv",
  "sourceSvgPath",
  "targetFinalSvgPath",
  "finalSvgPath",
  "outputManifestPath",
  "svgContent",
  "qaPath",
  "resultPath",
  "mutationMode",
  "queueSummary",
  "queuePreview",
  "preActionGuidance",
  "preActionGuidanceSummary",
  "fullResult",
  "diagnostics"
]);

const FORBIDDEN_TEXT = /\.dove\/|\bproject:dove\.[a-z0-9.-]+|--packet-id\b|\b(?:packetId|taskPacketId|missionPacketId|runId|receiptId|boundaryId|boundaryType|mutationMode|patch-plan|direct-process|ownerRole|nextRole|handoff|providerId|sourceSvgPath|targetFinalSvgPath|finalSvgPath|outputManifestPath|svgContent|queueSummary|queuePreview|preActionGuidance|resultCard)\b|\b(?:query_dove_status|run_dove_auto|record_dove_mission_pass|run_figure_workflow|run_dove_operator|record_document_evidence|upsert_note|upsert_draft|register_source|run_review_loop|run_dove_review_loop|run_experience_workflow|set_section_status|reset_dove_version|build_rebuttal|build_rebuttal_strategy|normalize_rebuttal_issues|query_dove_lessons|record_dove_lesson|init_dove_goal)\b/u;

export function assertNoCompactPublicLeaks(value, options = {}) {
  const ignoredKeys = new Set(options.ignoredKeys ?? []);
  const visit = (item, path = "root") => {
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    if (item && typeof item === "object") {
      for (const [key, child] of Object.entries(item)) {
        if (ignoredKeys.has(key)) {
          continue;
        }
        assert.equal(FORBIDDEN_KEYS.has(key) || /(?:^|[A-Za-z])Ids?$/u.test(key), false, `${path} leaked internal key ${key}`);
        visit(child, `${path}.${key}`);
      }
      return;
    }
    if (typeof item === "string") {
      assert.doesNotMatch(item, FORBIDDEN_TEXT, `${path} leaked internal text ${item}`);
    }
  };
  visit(value);
}

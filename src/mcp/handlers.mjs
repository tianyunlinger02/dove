import { assessMissionCompletion } from "../core/completion-gates.mjs";
import { queryDoveMission, queryDoveStatus } from "../core/mission-queries.mjs";
import { ingestExecutionReceipt, resolveExecutionReceiptPostCommit } from "../core/execution-receipts.mjs";
import { queryDoveLessons, recordDoveLesson } from "../core/lessons.mjs";
import { createDoveMission, initDoveGoal } from "../core/mission-contracts.mjs";
import { queryNetworkSearchProviders, searchNetwork } from "../core/network-search.mjs";
import {
  buildRebuttal,
  buildRebuttalStrategy,
  compareVersions,
  createVersionSnapshot,
  normalizeRebuttalIssues,
  runExperienceWorkflow,
  runFigureWorkflow,
  upsertClaims,
  upsertDraft,
  upsertDraftMetadata,
  upsertNote
} from "../core/retained-domain-workflows.mjs";
import { querySources, registerSource, verifySource } from "../core/source-trust.mjs";
import { importReviewExchange, prepareReviewExchange, verifyReviewCoverage } from "../core/review-exchange.mjs";
import { currentMutationContext, normalizeMutationMode, runWithMutationContext } from "../core/mutation-backend.mjs";
import { MUTATING_TOOL_NAMES, TOOL_INPUT_PROPERTY_NAMES, TOOL_INPUT_SCHEMAS } from "./tool-definitions.mjs";
import { assertMcpInputSchema } from "./schema-validation.mjs";

function textResult(data, isError = false) {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }], ...(isError ? { isError: true } : {}) };
}

function cleanControlArgs(args = {}, name) {
  const { resultMode: _resultMode, mutationMode, ...rest } = args;
  return ["init_dove_goal", "create_dove_mission", "record_dove_lesson"].includes(name) ? { ...rest, mutationMode } : rest;
}

function dispatchData(root, name, args) {
  switch (name) {
    case "init_dove_goal": return initDoveGoal(root, args);
    case "create_dove_mission": return createDoveMission(root, args);
    case "query_dove_mission": return queryDoveMission(root, args);
    case "query_dove_status": return queryDoveStatus(root, args);
    case "ingest_execution_receipt": return ingestExecutionReceipt(root, args);
    case "assess_mission_completion": return assessMissionCompletion(root, args);
    case "search_network": return searchNetwork(root, args);
    case "query_network_search_providers": return queryNetworkSearchProviders(root, args);
    case "query_sources": return querySources(root, args);
    case "query_dove_lessons": return queryDoveLessons(root, args);
    case "record_dove_lesson": return recordDoveLesson(root, args);
    case "register_source": return registerSource(root, args);
    case "verify_source": return verifySource(root, args);
    case "upsert_note": return upsertNote(root, args);
    case "upsert_claims": return upsertClaims(root, args);
    case "run_experience_workflow": return runExperienceWorkflow(root, args);
    case "upsert_draft": return upsertDraft(root, args);
    case "upsert_draft_metadata": return upsertDraftMetadata(root, args);
    case "run_figure_workflow": return runFigureWorkflow(root, args);
    case "prepare_review_exchange": return prepareReviewExchange(root, args);
    case "import_review_exchange": return importReviewExchange(root, args);
    case "verify_review_coverage": return verifyReviewCoverage(root, args);
    case "normalize_rebuttal_issues": return normalizeRebuttalIssues(root, args);
    case "build_rebuttal_strategy": return buildRebuttalStrategy(root, args);
    case "build_rebuttal": return buildRebuttal(root, args);
    case "create_version_snapshot": return createVersionSnapshot(root, args);
    case "compare_versions": return compareVersions(root, args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

function assertAllowed(name, args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error(`${name} arguments must be a plain object.`);
  const allowed = TOOL_INPUT_PROPERTY_NAMES.get(name);
  if (!allowed) throw new Error(`Unknown tool: ${name}`);
  const unknown = Object.keys(args).filter((field) => !allowed.has(field));
  if (unknown.length) throw new Error(`${name} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}

export function dispatchToolData(root, name, args = {}) {
  return dispatchData(root, name, args);
}

export function dispatchTool(root, name, args = {}) {
  try {
    assertAllowed(name, args);
    assertMcpInputSchema(name, args, TOOL_INPUT_SCHEMAS.get(name));
    const existing = currentMutationContext(root);
    if (existing && MUTATING_TOOL_NAMES.has(name) && Object.hasOwn(args, "mutationMode") && normalizeMutationMode(args.mutationMode) !== existing.mutationMode) {
      throw new Error(`MCP mutationMode ${args.mutationMode} does not match the active mutation context mode ${existing.mutationMode}.`);
    }
    const proposalOnly = ["init_dove_goal", "create_dove_mission", "record_dove_lesson"].includes(name) && args.confirmed !== true;
    const needsContext = !existing && MUTATING_TOOL_NAMES.has(name) && !proposalOnly;
    const clean = cleanControlArgs(args, name);
    const data = needsContext
      ? runWithMutationContext(root, { actionId: name.replaceAll("_", "-"), mutationMode: args.mutationMode, hostId: "mcp" }, (context) => dispatchData(root, name, { ...clean, ...(["init_dove_goal", "create_dove_mission", "record_dove_lesson"].includes(name) ? { mutationMode: context.mutationMode } : {}) }))
      : dispatchData(root, name, clean);
    if (data && typeof data.then === "function") return data.then((value) => textResult(resolveExecutionReceiptPostCommit(root, value, { committed: needsContext }))).catch((error) => textResult(error instanceof Error ? error.message : String(error), true));
    return textResult(resolveExecutionReceiptPostCommit(root, data, { committed: needsContext }));
  } catch (error) {
    return textResult(error instanceof Error ? error.message : String(error), true);
  }
}

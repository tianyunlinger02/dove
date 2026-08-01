import { assessMissionCompletion } from "../core/completion-gates.mjs";
import { operationForTool, operationInteraction, operationPublicProjector, operationRequiresCheckpoint, operationRoute, operationTargetTool } from "../core/operation-registry.mjs";
import { resolveDoveResponseLanguage } from "../core/i18n.mjs";
import { ARTIFACT_PATHS, DEFAULT_DOVE_RESPONSE_LANGUAGE } from "../core/schema.mjs";
import { classifyInvocationError, classifyInvocationOutcome, createInvocationOutcome } from "../core/operational-outcome.mjs";
import { publicErrorMessage, publicErrorResult, publicResult, renderPublicReport } from "../core/public-reports.mjs";
import { publicMissionNumberForCandidate, queryDoveMission, queryDoveStatus, resolveMissionNumber } from "../core/mission-queries.mjs";
import { closeHostOutcome, resolveExecutionReceiptPostCommit } from "../core/execution-receipts.mjs";
import { prepareResearchDecisionReevaluation, reevaluateResearchDecision } from "../core/research-decision-reevaluation.mjs";
import { recordResearchOutcome } from "../core/research-outcome.mjs";
import { normalizeHostWorkspaceArtifactPath, normalizeHostWorkspaceFilePath, normalizeHostWorkspacePath } from "../core/host-path-normalizer.mjs";
import { readDoveLessons, updateDoveLessons } from "../core/lessons.mjs";
import { createAmbientDoveMission, createDoveMission, manageDoveWorkspace, newMissionId, startDoveSkillMission } from "../core/mission-contracts.mjs";
import {
  recordDoveDraft,
  recordDoveFigure,
  recordDoveRebuttal,
  runExperienceWorkflow,
  upsertClaims
} from "../core/retained-domain-workflows.mjs";
import { querySources, registerSource, verifySource } from "../core/source-trust.mjs";
import { archiveReviewRecord, scopeReviewRecord } from "../core/review-records.mjs";
import { currentMutationContext, runWithMutationContext } from "../core/mutation-backend.mjs";
import { TOOL_INPUT_SCHEMAS, TOOL_OPERATION_SCHEMAS } from "./tool-definitions.mjs";
import { assertMcpInputSchema } from "./schema-validation.mjs";

function textResult(envelope, { isError = false, language = DEFAULT_DOVE_RESPONSE_LANGUAGE } = {}) {
  if (!isPlainObject(envelope?.report) || !isPlainObject(envelope?.hostControl) || !isPlainObject(envelope.hostControl.presentation)) {
    throw new Error("MCP public output requires a sealed report, presentation, and hostControl envelope.");
  }
  const rendered = envelope.hostControl.presentation.mode === "silent"
    ? ""
    : renderPublicReport(envelope.report, { language });
  return {
    content: rendered ? [{ type: "text", text: rendered }] : [],
    structuredContent: envelope,
    ...(isError ? { isError: true } : {})
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function dispatchData(root, name, args) {
  switch (name) {
    case "manage_dove_workspace": return manageDoveWorkspace(root, args);
    case "create_dove_mission": return createDoveMission(root, args);
    case "start_dove_skill_mission": return startDoveSkillMission(root, args);
    case "reevaluate_research_decision": return reevaluateResearchDecision(root, args);
    case "query_dove_mission": return queryDoveMission(root, args);
    case "query_dove_status": return queryDoveStatus(root, args);
    case "assess_mission_completion": return assessMissionCompletion(root, args);
    case "close_host_outcome": return closeHostOutcome(root, args);
    case "record_research_outcome": return recordResearchOutcome(root, args);
    case "query_sources": return querySources(root, args);
    case "read_dove_lessons": return readDoveLessons(root, args);
    case "update_dove_lessons": return updateDoveLessons(root, args);
    case "register_source": return registerSource(root, args);
    case "verify_source": return verifySource(root, args);
    case "upsert_claims": return upsertClaims(root, args);
    case "run_experience_workflow": return runExperienceWorkflow(root, args);
    case "record_dove_draft": return recordDoveDraft(root, args);
    case "record_dove_figure": return recordDoveFigure(root, args);
    case "scope_review_record": return scopeReviewRecord(root, args);
    case "archive_review_record": return archiveReviewRecord(root, args);
    case "record_dove_rebuttal": return recordDoveRebuttal(root, args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

function invokeMutation(root, name, callback) {
  const existing = currentMutationContext(root);
  if (existing) return { data: callback(existing), committed: false };
  return {
    data: runWithMutationContext(root, {
      actionId: name.replaceAll("_", "-"),
      mutationMode: "direct-process",
      hostId: "mcp"
    }, callback),
    committed: true
  };
}

function missionRelationshipArgs(root, args) {
  const result = { ...args };
  if (Object.hasOwn(result, "dependsOnMissionNumbers")) {
    result.dependsOnMissionIds = result.dependsOnMissionNumbers.map((missionNumber) => resolveMissionNumber(root, missionNumber, { operation: "Dove mission dependency selection" }).missionId);
    delete result.dependsOnMissionNumbers;
  }
  if (Object.hasOwn(result, "parentMissionNumber")) {
    const parent = resolveMissionNumber(root, result.parentMissionNumber, { operation: "Dove parent mission selection" });
    result.parentMissionId = parent.missionId;
    delete result.parentMissionNumber;
  }
  return result;
}

function coreCheckpointArgs(root, name, args) {
  if (name !== "create_dove_mission") return args;
  if (typeof args.goal !== "string" || !args.goal) {
    throw new Error("Mission creation requires a goal.");
  }
  return { ...missionRelationshipArgs(root, args), missionId: newMissionId() };
}

function checkpointProposal(root, name, args) {
  return dispatchData(root, name, { ...coreCheckpointArgs(root, name, args), mutationMode: "direct-process" });
}

function applyCheckpoint(root, name, args, proposal) {
  const confirmArgs = proposal?.confirmation?.confirmArgs;
  if (!isPlainObject(confirmArgs)) throw new Error(`${name} did not return private exact replay data.`);
  return invokeMutation(root, name, () => dispatchData(root, name, confirmArgs));
}

function normalizeApprovalAction(value) {
  if (value === "accept" || value === "decline" || value === "cancel") return value;
  throw new Error("Checkpoint approval returned an unsupported action.");
}

function publicCheckpointProposalError(name, args, error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/\.dove\/|\b(?:proposal(?:Digest|Workspace|Version|Token)|confirmArgs|mutationMode|MutationContext|workspaceId|sourceTreeDigest|archiveTarget)\b/u.test(message)) {
    return new Error("The checkpoint could not be prepared because its validated workspace state is not current.");
  }
  return new Error(message);
}

function checkpointApplyError() {
  return new Error("The approved checkpoint could not be applied because its validated inputs or workspace state changed.");
}

function projectInvocation(root, projectorName, data, operation, options = {}) {
  return publicResult(projectorName, data, classifyInvocationOutcome(data, operation, options.invocationArgs ?? data), {
    operation,
    includeTechnicalAppendix: projectorName === "query_dove_status" && data?.detail === "full",
    callbackRoot: root,
    ...(options.callbackResolvers ? { callbackResolvers: options.callbackResolvers } : {}),
    ...(options.selector ? { selector: options.selector } : {})
  });
}

function projectAmbientMissionBeforeCommit(root, name, data, operation, context, options = {}) {
  context.requireCommitPrecondition(ARTIFACT_PATHS.missionsDir);
  const missionNumber = publicMissionNumberForCandidate(root, data.mission, { operation: "Mission result selector preparation" });
  const injectedMissionNumber = options.callbackResolvers?.missionNumber;
  const callbackResolvers = {
    missionNumber: (missionId) => {
      if (missionId !== data.mission.missionId) throw new Error("Mission callback projection does not bind the created candidate.");
      const resolved = typeof injectedMissionNumber === "function" ? injectedMissionNumber(missionId) : missionNumber;
      if (resolved !== missionNumber) throw new Error("Mission callback and result selector do not bind the same public mission.");
      return resolved;
    }
  };
  return projectInvocation(root, name, data, operation, {
    callbackResolvers,
    ...(data.operation === "start-skill" ? { selector: { missionNumber } } : {})
  });
}

function resolveCheckpointPostCommit(root, applied, data) {
  return resolveExecutionReceiptPostCommit(root, data, { committed: applied.committed });
}

function routedInvocation(operation, args) {
  const route = operationRoute(operation, args);
  const targetName = operationTargetTool(operation, args);
  const projectorName = operationPublicProjector(operation, args);
  const targetArgs = { ...args, ...(route?.fixedArgs ?? {}) };
  if (route && !["create_dove_mission", "start_dove_skill_mission", "reevaluate_research_decision"].includes(targetName)) delete targetArgs.operation;
  return { targetName, projectorName, targetArgs };
}

function executeTool(root, name, args, options = {}) {
  const operation = operationForTool(name);
  const interaction = operationInteraction(operation, args);
  const { targetName, projectorName, targetArgs } = routedInvocation(operation, args);
  const project = (data, projectionOptions = {}) => projectInvocation(root, projectorName, data, operation, { invocationArgs: args, ...projectionOptions });
  if (name === "manage_dove_workspace" && args.operation === "set-mainline") {
    const invoked = invokeMutation(root, name, () => manageDoveWorkspace(root, targetArgs));
    return project(resolveExecutionReceiptPostCommit(root, invoked.data, { committed: invoked.committed }));
  }
  if (name === "create_ambient_dove_mission" || targetName === "start_dove_skill_mission") {
    const invoked = invokeMutation(root, name, (context) => {
      const data = targetName === "start_dove_skill_mission" ? startDoveSkillMission(root, targetArgs) : createAmbientDoveMission(root, targetArgs);
      return {
        data,
        publicEnvelope: projectAmbientMissionBeforeCommit(root, projectorName, data, operation, context, options)
      };
    });
    resolveExecutionReceiptPostCommit(root, invoked.data.data, { committed: invoked.committed });
    return invoked.data.publicEnvelope;
  }
  if (operationRequiresCheckpoint(operation, args)) {
    let proposal;
    try {
      proposal = checkpointProposal(root, targetName, targetArgs);
    } catch (error) {
      throw publicCheckpointProposalError(name, args, error);
    }
    const approval = publicResult(projectorName, proposal, classifyInvocationOutcome(proposal, operation, args), { operation }).report.approval;
    if (!approval) throw new Error(`${name} did not return a public approval card.`);
    if (typeof options.requestCheckpointApproval !== "function") throw new Error("This Dove checkpoint requires an MCP client with elicitation support.");
    return Promise.resolve(options.requestCheckpointApproval(approval)).then((value) => {
      const action = normalizeApprovalAction(value);
      if (action !== "accept") {
        const data = { status: action === "decline" ? "declined" : "cancelled", zeroWrite: true, message: "No changes were made.", approval };
        return project(data);
      }
      let applied;
      try {
        applied = applyCheckpoint(root, targetName, targetArgs, proposal);
      } catch {
        throw checkpointApplyError();
      }
      const resolvePostCommit = (data) => resolveCheckpointPostCommit(root, applied, data);
      if (applied.data && typeof applied.data.then === "function") {
        return applied.data.then((data) => project(resolvePostCommit(data))).catch(() => { throw checkpointApplyError(); });
      }
      return project(resolvePostCommit(applied.data));
    });
  }
  if (interaction === "read") {
    const data = dispatchData(root, targetName, targetArgs);
    return data && typeof data.then === "function" ? data.then((value) => project(value)) : project(data);
  }
  const invoked = invokeMutation(root, name, () => dispatchData(root, targetName, targetName === "reevaluate_research_decision"
    ? prepareResearchDecisionReevaluation(root, targetArgs)
    : targetArgs));
  if (invoked.data && typeof invoked.data.then === "function") {
    return invoked.data.then((data) => project(resolveExecutionReceiptPostCommit(root, data, { committed: invoked.committed })));
  }
  return project(resolveExecutionReceiptPostCommit(root, invoked.data, { committed: invoked.committed }));
}

function hostFile(root, value, label) {
  return normalizeHostWorkspaceFilePath(root, value, label);
}

function hostFiles(root, values, label) {
  return Array.isArray(values) ? values.map((value, index) => hostFile(root, value, `${label}[${index}]`)) : values;
}

function hostArtifact(root, value, label) {
  return normalizeHostWorkspaceArtifactPath(root, value, label);
}

function hostArtifacts(root, values, label) {
  return Array.isArray(values) ? values.map((value, index) => hostArtifact(root, value, `${label}[${index}]`)) : values;
}

function hostPaths(root, values, label) {
  return Array.isArray(values) ? values.map((value, index) => normalizeHostWorkspacePath(root, value, `${label}[${index}]`)) : values;
}

function typedEvidence(root, reference, label) {
  if (typeof reference !== "string") return reference;
  for (const prefix of ["source:"]) if (reference.startsWith(prefix)) return reference;
  for (const prefix of ["artifact:", "validation:"]) {
    if (reference.startsWith(prefix)) return `${prefix}${hostFile(root, reference.slice(prefix.length), label)}`;
  }
  return hostFile(root, reference, label);
}

function typedEvidenceList(root, values, label) {
  return Array.isArray(values) ? values.map((value, index) => typedEvidence(root, value, `${label}[${index}]`)) : values;
}

function missionEvidence(root, reference, label) {
  if (typeof reference !== "string") return reference;
  for (const prefix of ["source:"]) if (reference.startsWith(prefix)) return reference;
  for (const prefix of ["artifact:", "validation:"]) {
    if (reference.startsWith(prefix)) return `${prefix}${hostArtifact(root, reference.slice(prefix.length), label)}`;
  }
  return reference;
}

function missionEvidenceList(root, values, label) {
  return Array.isArray(values) ? values.map((value, index) => missionEvidence(root, value, `${label}[${index}]`)) : values;
}

function findingReference(root, reference, label) {
  if (typeof reference !== "string") return reference;
  const separator = reference.lastIndexOf("#");
  if (separator <= 0 || separator === reference.length - 1) return reference;
  return `${hostFile(root, reference.slice(0, separator), label)}#${reference.slice(separator + 1)}`;
}

function normalizeHostPathInputs(root, name, args) {
  const result = structuredClone(args);
  switch (name) {
    case "register_source":
      if (result.capturePath !== undefined) result.capturePath = hostFile(root, result.capturePath, "capturePath");
      break;
    case "ingest_execution_receipt":
      if (Array.isArray(result.artifacts)) result.artifacts = result.artifacts.map((item, index) => ({ ...item, path: hostFile(root, item.path, `artifacts[${index}].path`) }));
      if (Array.isArray(result.validations)) result.validations = result.validations.map((item, index) => ({ ...item, reference: hostFile(root, item.reference, `validations[${index}].reference`) }));
      if (Array.isArray(result.criteriaSatisfied)) result.criteriaSatisfied = result.criteriaSatisfied.map((item, index) => ({ ...item, evidenceRefs: typedEvidenceList(root, item.evidenceRefs, `criteriaSatisfied[${index}].evidenceRefs`) }));
      break;
    case "close_host_outcome": {
      result.artifactPaths = hostFiles(root, result.artifactPaths, "artifactPaths");
      const artifactPaths = new Set(result.artifactPaths ?? []);
      result.validationPaths = hostFiles(root, result.validationPaths, "validationPaths")?.filter((validationPath) => !artifactPaths.has(validationPath));
      break;
    }
    case "record_research_outcome": {
      result.artifactPaths = hostFiles(root, result.artifactPaths, "artifactPaths");
      const artifactPaths = new Set(result.artifactPaths ?? []);
      result.validationPaths = hostFiles(root, result.validationPaths, "validationPaths")?.filter((validationPath) => !artifactPaths.has(validationPath));
      break;
    }
    case "upsert_claims":
      if (Array.isArray(result.claims)) result.claims = result.claims.map((item, index) => ({
        ...item,
        artifactRefs: hostFiles(root, item.artifactRefs, `claims[${index}].artifactRefs`),
        validationRefs: hostFiles(root, item.validationRefs, `claims[${index}].validationRefs`)
      }));
      break;
    case "run_experience_workflow":
      if (result.result) {
        result.result.artifactRefs = hostFiles(root, result.result.artifactRefs, "result.artifactRefs");
        result.result.validationRefs = hostFiles(root, result.result.validationRefs, "result.validationRefs");
        result.result.failures = result.result.failures?.map((item, index) => ({ ...item, evidenceRefs: typedEvidenceList(root, item.evidenceRefs, `result.failures[${index}].evidenceRefs`) }));
      }
      break;
    case "record_dove_draft":
    case "record_dove_figure":
    case "record_dove_rebuttal":
      result.artifactPath = hostFile(root, result.artifactPath, "artifactPath");
      result.referencePaths = hostFiles(root, result.referencePaths, "referencePaths");
      if (Array.isArray(result.findingRefs)) result.findingRefs = result.findingRefs.map((value, index) => findingReference(root, value, `findingRefs[${index}]`));
      break;
    case "scope_review_record":
      result.artifactPaths = hostFiles(root, result.artifactPaths, "artifactPaths");
      break;
    case "archive_review_record":
      if (Array.isArray(result.findings)) result.findings = result.findings.map((item, index) => ({
        ...item,
        linkedArtifactPaths: hostFiles(root, item.linkedArtifactPaths, `findings[${index}].linkedArtifactPaths`)
      }));
      break;
    case "reevaluate_research_decision":
      result.evidenceRefs = typedEvidenceList(root, result.evidenceRefs, "evidenceRefs");
      if (Array.isArray(result.hypotheses)) result.hypotheses = result.hypotheses.map((item, index) => ({
        ...item,
        supportingEvidence: typedEvidenceList(root, item.supportingEvidence, `hypotheses[${index}].supportingEvidence`),
        counterEvidence: typedEvidenceList(root, item.counterEvidence, `hypotheses[${index}].counterEvidence`)
      }));
      break;
    case "query_dove_mission":
    case "create_dove_mission":
    case "create_ambient_dove_mission":
    case "start_dove_skill_mission":
      if (Array.isArray(result.artifacts)) result.artifacts = result.artifacts.map((item, index) => ({ ...item, path: hostArtifact(root, item.path, `artifacts[${index}].path`) }));
      if (result.evidenceRequirements !== undefined) result.evidenceRequirements = missionEvidenceList(root, result.evidenceRequirements, "evidenceRequirements");
      if (Array.isArray(result.contextArtifactPaths)) result.contextArtifactPaths = hostFiles(root, result.contextArtifactPaths, "contextArtifactPaths");
      break;
    default:
      break;
  }
  return result;
}

export function dispatchTool(root, name, args = {}, options = {}) {
  let operation = null;
  let language = DEFAULT_DOVE_RESPONSE_LANGUAGE;
  try {
    const inputSchema = TOOL_INPUT_SCHEMAS.get(name);
    if (!inputSchema) throw new Error(`Unknown tool: ${name}`);
    operation = operationForTool(name);
    const schemaArgs = args;
    assertMcpInputSchema(name, schemaArgs, inputSchema);
    const operationSchemas = TOOL_OPERATION_SCHEMAS.get(name);
    if (operationSchemas) {
      assertMcpInputSchema(name, schemaArgs, { oneOf: operationSchemas });
    }
    language = resolveDoveResponseLanguage(root, schemaArgs, options);
    const targetName = operationTargetTool(operation, schemaArgs);
    let normalizedArgs = normalizeHostPathInputs(root, targetName, schemaArgs);
    if (["query_dove_mission", "start_dove_skill_mission"].includes(targetName)) normalizedArgs = missionRelationshipArgs(root, normalizedArgs);
    if (Object.hasOwn(normalizedArgs, "missionNumber") && !["create_dove_mission", "reevaluate_research_decision"].includes(targetName)) {
      normalizedArgs.missionId = resolveMissionNumber(root, normalizedArgs.missionNumber, { operation: `${name} public mission selection` }).missionId;
      delete normalizedArgs.missionNumber;
    }
    const result = executeTool(root, name, normalizedArgs, options);
    return result && typeof result.then === "function"
      ? result.then((value) => textResult(value, { language })).catch((error) => {
        const invocation = operation
          ? classifyInvocationError(error, operation)
          : createInvocationOutcome({ kind: "failed", category: "not-found", phase: "selection", blocking: true, userAction: "select-target", reason: "not-found" });
        return textResult(publicErrorResult(name, error, invocation), { isError: true, language });
      })
      : textResult(result, { language });
  } catch (error) {
    const invocation = operation
      ? classifyInvocationError(error, operation)
      : createInvocationOutcome({ kind: "failed", category: "not-found", phase: "selection", blocking: true, userAction: "select-target", reason: "not-found" });
    return textResult(publicErrorResult(name, error, invocation), { isError: true, language });
  }
}

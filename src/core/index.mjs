export { PACKAGE_NAME } from "./package-metadata.mjs";
export { ARTIFACT_PATHS, PACKAGE_VERSION } from "./schema.mjs";

export { userPromptSubmitOutput } from "./ambient-hook.mjs";
export {
  ambientContextForPrompt,
  classifyLessonsIntent,
  isHighConfidenceAmbientWorkPrompt,
  lessonsContextForPrompt,
  renderClaudeAmbientRule,
  renderClaudeAmbientSkill,
  renderClaudeLessonsIntakeSkill
} from "./ambient-policy.mjs";

export { RESEARCH_DOCUMENT_PATHS, inspectResearchDocuments } from "./research-documents.mjs";
export { exportResearch, previewResearchExport } from "./research-export.mjs";

export {
  DOVE_PRIMARY_ROLES,
  generatedRoleDefinitionEntries,
  renderClaudeReviewerAgent,
  renderOpenCodeReviewerAgent,
  renderOpenCodeRoleSkill,
  reviewerPrompt
} from "./role-definitions.mjs";
export {
  COMMAND_SURFACES,
  COMMAND_SURFACE_BY_ID,
  HOST_ADAPTERS,
  HOST_ADAPTER_POLICY,
  PROJECT_HOST_IDS,
  allGeneratedCommandAdapterPaths,
  commandAdapterPathsForHost
} from "./command-manifest.mjs";
export { USER_RESPONSE_POLICY } from "./user-response-policy.mjs";
export {
  completeReinstallProjectIntegration,
  initializeProjectIntegration,
  inspectProjectIntegration,
  previewProjectCompleteReinstall,
  previewProjectUpgrade,
  syncProjectIntegration,
  upgradeProjectIntegration
} from "./project-installation.mjs";
export { completeReinstallDoveLifecycle, upgradeDoveLifecycle } from "./dove-lifecycle.mjs";
export { doctorIssuesFromInspection } from "./doctor-issues.mjs";
export { readDoctorDocument, readDoctorState, reconcileDoctorIssues, reconcileDoctorIssuesBestEffort, recordDoctorIssue, recordDoctorIssueBestEffort, renderDoctorDocument, resolveDoctorIssues, setDoctorEnabled, validateDoctorState } from "./doctor-store.mjs";
export { inspectProjectDoctor } from "./project-doctor.mjs";

export { PACKAGE_NAME } from "./package-metadata.mjs";
export { ARTIFACT_PATHS, PACKAGE_VERSION } from "./schema.mjs";

export { parseUserPromptSubmitPayload, userPromptSubmitOutput } from "./ambient-hook.mjs";
export { parseSessionStartPayload, sessionStartOutput } from "./session-start-hook.mjs";
export {
  DOVE_CLAUDE_SESSION_START_HOOK_COMMAND,
  DOVE_CLAUDE_STATUS_LINE,
  DOVE_CLAUDE_STATUS_LINE_COMMAND,
  ambientContextForPrompt,
  isHighConfidenceAmbientWorkPrompt,
  renderClaudeAmbientRule,
  renderClaudeAmbientSkill
} from "./ambient-policy.mjs";

export {
  RESEARCH_DEFAULT_DIRECTORY_PATHS,
  RESEARCH_DEFAULT_DOCUMENTS,
  RESEARCH_DEFAULT_FILE_PATHS,
  RESEARCH_DEFAULT_PATHS,
  RESEARCH_LESSON_TOPICS,
  appendExactMarkdownBlocks,
  appendExactMarkdownLines,
  planResearchDefaults,
  prepareResearchDefaults,
  readResearchDefaultsSnapshot,
  researchDefaultTransactionEntries
} from "./research-defaults.mjs";
export { RESEARCH_DOCUMENT_PATHS, inspectResearchDocuments } from "./research-documents.mjs";
export {
  PAPER_SEARCH_MCP_FRAGMENT,
  PAPER_SEARCH_MCP_PATH,
  PAPER_SEARCH_MCP_SELECTOR,
  PAPER_SEARCH_MCP_SERVER_NAME,
  PAPER_SEARCH_PACKAGE_SPECIFIER,
  PAPER_SEARCH_SUPPORT_SKILL_PATH,
  renderPaperSearchSupportSkill
} from "./paper-search-integration.mjs";
export {
  EXA_MCP_FRAGMENT,
  EXA_MCP_PATH,
  EXA_MCP_SELECTOR,
  EXA_MCP_SERVER_NAME,
  EXA_MCP_URL,
  EXA_WEB_SUPPORT_SKILL_PATH,
  WEB_FETCH_DENY_PERMISSION,
  WEB_FETCH_DENY_SELECTOR,
  renderExaWebSupportSkill
} from "./web-access-integration.mjs";

export * from "./dove-research-contract.mjs";

export {
  DOVE_AGENT_DEFINITION,
  DOVE_AGENT_SURFACES,
  generatedDoveAgentEntries,
  renderClaudeDoveAgent
} from "./dove-agent-definition.mjs";
export {
  DOVE_AGENT_CAPSULE_BULLETS,
  DOVE_AGENT_CURIOSITY,
  DOVE_AGENT_DESCRIPTION,
  DOVE_AGENT_DIRECT_JUDGMENT,
  DOVE_AGENT_FRAME,
  DOVE_AGENT_HUNCH,
  DOVE_AGENT_LAYERING,
  DOVE_AGENT_NAME,
  DOVE_AGENT_PERSONA_BULLETS,
  DOVE_AGENT_PROPORTIONALITY,
  DOVE_AGENT_STOPPING,
  renderDoveAgentInstructions,
  renderDoveAgentPersonaSection
} from "./dove-agent-persona.mjs";
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
  initializeProjectIntegration,
  inspectProjectIntegration,
  previewProjectCompleteReinstall,
  previewProjectUninstall,
  synchronizeProjectIntegrationOnly,
  uninstallProjectIntegration,
  updateProjectIntegration
} from "./project-installation.mjs";
export { completeReinstallDoveLifecycle, previewUninstallDoveLifecycle, uninstallDoveLifecycle, updateDoveLifecycle } from "./dove-lifecycle.mjs";
export { inspectProjectDoctor } from "./project-doctor.mjs";
export { DOVE_REVIEW_BACKEND_ID, runClaudeReviewBackend } from "./review-claude-backend.mjs";
export { REVIEW_MATERIAL_DENY_PATTERNS, createReviewSnapshot, normalizeReviewMaterialList, snapshotDigest } from "./review-snapshot.mjs";
export { assertReviewWorkspaceMatchesSnapshot, createReviewId, normalizeReviewId, prepareReviewWorkspace, resolveReviewStateRoot } from "./review-workspace.mjs";
export { handoffReview, importReviewReturn, inspectReviewStatus, rerunReview, resumeReview, reviewStateLocation } from "./review-runtime.mjs";
export {
  RUNS_DIRECTORY_PATH,
  RUN_EVENT_SCHEMA_VERSION,
  compareRuns,
  createRunId,
  inspectRunStatus,
  normalizeRunId,
  readRunEvents,
  runRelativePaths,
  summarizeRun
} from "./run-record.mjs";
export { finalizeRunWithSupervisor, resumeRun, startDetachedRunSupervisor } from "./run-supervisor.mjs";

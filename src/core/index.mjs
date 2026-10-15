export { PACKAGE_NAME } from "./package-metadata.mjs";
export { ARTIFACT_PATHS, PACKAGE_VERSION } from "./schema.mjs";

export { parseUserPromptSubmitPayload, userPromptSubmitFailureOutput, userPromptSubmitOutput } from "./user-prompt-submit-hook.mjs";
export { parseSessionStartPayload, sessionStartFailureOutput, sessionStartOutput } from "./session-start-hook.mjs";
export { formatContextCapacity, formatSessionDuration, inspectGitBranch, parseDoveStatusLinePayload, renderDoveStatusLine } from "./statusline.mjs";
export {
  DOVE_CLAUDE_SESSION_START_HOOK_COMMAND,
  DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND,
  DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_ENTRY,
  mergeClaudeUserPromptSubmitSettings,
  DOVE_CLAUDE_STATUS_LINE,
  DOVE_CLAUDE_STATUS_LINE_COMMAND,
  renderClaudeAmbientRule
} from "./ambient-policy.mjs";

export {
  RESEARCH_DEFAULT_DIRECTORY_PATHS,
  RESEARCH_DEFAULT_DOCUMENTS,
  RESEARCH_DEFAULT_PATHS,
  prepareResearchDefaults
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
  DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS,
  DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS,
  renderDoveAuthorPreferencesReference,
  renderDoveAuthorPreferencesFullReference
} from "./dove-author-preferences.mjs";

export {
  DOVE_AGENT_SURFACES,
  generatedDoveAgentEntries,
  renderClaudeDoveAgent
} from "./dove-agent-definition.mjs";
export {
  renderDoveAgentInstructions,
  renderDoveAuthorStanceSection,
  renderDoveSharedResearchContractSection
} from "./dove-agent-persona.mjs";
export {
  COMMAND_SURFACES,
  COMMAND_SURFACE_BY_ID,
  HOST_ADAPTERS,
  PROJECT_HOST_IDS,
  allGeneratedCommandAdapterPaths,
  commandAdapterPathsForHost
} from "./command-manifest.mjs";
export { USER_RESPONSE_POLICY } from "./user-response-policy.mjs";
export { exportPaperBibtex, groupPaperLibrary, readPaperLibrary, renderPaperLibrary } from "./paper-library.mjs";
export { readHostSettings, writeHostSettings } from "./host-migration.mjs";
export { renderMentorBrief } from "./mentor-brief.mjs";
export {
  initializeProjectIntegration,
  inspectProjectIntegration,
  previewProjectCompleteReinstall,
  previewProjectUninstall,
  uninstallProjectIntegration,
  updateProjectIntegration
} from "./project-installation.mjs";
export { completeReinstallDoveLifecycle, previewUninstallDoveLifecycle, uninstallDoveLifecycle, updateDoveLifecycle } from "./dove-lifecycle.mjs";
export { inspectProjectDoctor } from "./project-doctor.mjs";
export {
  RUNS_DIRECTORY_PATH,
  RUN_EVENT_SCHEMA_VERSION,
  appendFinalizedRun,
  compareRuns,
  createRunId,
  inspectRunStatus,
  normalizeRunId,
  readRunEvents,
  runRelativePaths,
  summarizeRun
} from "./run-record.mjs";
export { resumeRun, startDetachedRunSupervisor } from "./run-supervisor.mjs";

export { PACKAGE_NAME } from "./package-metadata.mjs";
export { ARTIFACT_PATHS, PACKAGE_VERSION } from "./schema.mjs";

export { userPromptSubmitOutput } from "./ambient-hook.mjs";
export { stopHookOutput } from "./stop-hook.mjs";
export {
  DOVE_CLAUDE_STOP_HOOK_COMMAND,
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
export { exportResearch, previewResearchExport } from "./research-export.mjs";
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
  DOVE_PRIMARY_ROLES,
  generatedRoleDefinitionEntries,
  renderClaudeReviewerAgent,
  renderOpenCodeReviewerAgent,
  renderOpenCodeRoleSkill
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
  initializeProjectIntegration,
  inspectProjectIntegration,
  previewProjectCompleteReinstall,
  updateProjectIntegration
} from "./project-installation.mjs";
export { completeReinstallDoveLifecycle, updateDoveLifecycle } from "./dove-lifecycle.mjs";
export { inspectProjectDoctor } from "./project-doctor.mjs";

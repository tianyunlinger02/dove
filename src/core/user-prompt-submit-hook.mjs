import { DOVE_RESEARCH_QUALITY_REFERENCE_PATHS, renderDoveResearchReanchor } from "./dove-research-contract.mjs";
import { DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS } from "./dove-author-preferences.mjs";
import { DOVE_CLAUDE_AMBIENT_RULE_PATH } from "./ambient-policy.mjs";
import { identityCardContext } from "./identity-card.mjs";
import { hostMigrationContext } from "./host-migration.mjs";
import { PROJECT_HOST_IDS } from "./host-registry.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./package-metadata.mjs";
import { readProjectInstallationManifest } from "./project-installation-manifest.mjs";
import { inspectRegularProjectFile } from "./project-installation-plan.mjs";
import { resourcesForHosts, sameManaged, samePackage } from "./project-installation-resources.mjs";
import { userOriginalSourceContext } from "./session-start-hook.mjs";

export const PROMPT_GUIDANCE_PATHS = Object.freeze([
  DOVE_CLAUDE_AMBIENT_RULE_PATH,
  DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.claude,
  DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.claude
]);

export function currentPromptGuidance(manifest) {
  if (!manifest?.hosts?.includes("claude")) throw new Error("Dove prompt guidance requires Claude integration.");
  const fingerprints = PROMPT_GUIDANCE_PATHS.map((resourcePath) => {
    const entries = manifest.managed.filter((entry) => entry.path === resourcePath && entry.kind === "exclusive-file" && entry.selector === null);
    if (entries.length !== 1) throw new Error(`Dove prompt guidance is missing a managed reference: ${resourcePath}.`);
    return `${resourcePath} ${entries[0].digest.slice(0, 12)}`;
  });
  return { version: manifest.package.version, fingerprints };
}

export function inspectCurrentPromptGuidance(project, options = {}) {
  const manifest = readProjectInstallationManifest(project, { fsOps: options.fsOps, hostIds: PROJECT_HOST_IDS });
  const expectedPackage = { name: options.packageName ?? PACKAGE_NAME, version: options.packageVersion ?? PACKAGE_VERSION };
  if (!manifest.hosts.includes("claude") || !samePackage(manifest.package, expectedPackage)) {
    throw new Error("Dove prompt guidance requires current Claude integration.");
  }
  // Shared host configuration is not guidance; doctor still reports its drift.
  const resources = resourcesForHosts(manifest.hosts).filter((entry) => entry.kind === "exclusive-file");
  const managed = manifest.managed.filter((entry) => entry.kind === "exclusive-file");
  if (!sameManaged(managed, resources)) throw new Error("Dove prompt guidance inventory does not match the current package.");
  for (const resource of resources) {
    const observed = inspectRegularProjectFile(project, resource.path, options.fsOps);
    if (observed.digest !== resource.digest) throw new Error(`Dove prompt guidance is changed or missing: ${resource.path}.`);
  }
  return currentPromptGuidance(manifest);
}

export function parseUserPromptSubmitPayload(input) {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Dove UserPromptSubmit hook received malformed JSON.");
  }
  if (payload?.hook_event_name !== "UserPromptSubmit" || typeof payload.prompt !== "string") {
    throw new Error("Dove UserPromptSubmit hook received an unsupported or invalid prompt event.");
  }
  return payload;
}

export function userPromptSubmitOutput(payload, guidance, options = {}) {
  if (payload?.hook_event_name !== "UserPromptSubmit" || typeof payload.prompt !== "string") {
    throw new Error("Dove UserPromptSubmit hook requires a valid prompt event.");
  }
  if (!guidance) throw new Error("Dove UserPromptSubmit hook requires verified project guidance.");
  const context = `Dove ${guidance.version} (disk guidance, not rule reload):\n${guidance.fingerprints.join("\n")}\n${identityCardContext(options.project, options)}\n${renderDoveResearchReanchor()}\nOn first use at these fingerprints, the current main agent must personally read the current rule and the two short summaries (author preferences and research quality); otherwise reuse them. Consult full references only for decision-relevant details. The card is context, not a substitute for the user's latest words.${userOriginalSourceContext(payload)}${hostMigrationContext(options.project, options)}`;
  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: context
    }
  };
}

export function userPromptSubmitAttentionOutput() {
  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: "Dove could not verify current project guidance. Do not treat the new CLI guidance as installed policy; inspect dove doctor --json and resolve project integration deliberately (dove update only if replacing owned edits is intended). This does not block or expand the user's request."
    }
  };
}

export function userPromptSubmitFailureOutput(error) {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
  return {
    systemMessage: `Dove UserPromptSubmit could not deliver its read-only guidance: ${message}`
  };
}

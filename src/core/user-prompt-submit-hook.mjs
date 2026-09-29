import { DOVE_RESEARCH_QUALITY_REFERENCE_PATHS, renderDoveResearchReanchor } from "./dove-research-contract.mjs";
import { DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS } from "./dove-author-preferences.mjs";
import { DOVE_CLAUDE_AMBIENT_RULE_PATH } from "./ambient-policy.mjs";
import { identityCardContext } from "./identity-card.mjs";

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
  const context = `Dove ${guidance.version} (disk guidance, not rule reload):\n${guidance.fingerprints.join("\n")}\n${identityCardContext(options.project, options)}\n${renderDoveResearchReanchor()}\nOn first use at these fingerprints, personally read the full rule and author preferences; otherwise reuse them. The card is context, not a substitute for the user's latest words.`;
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

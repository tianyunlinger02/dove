import {
  DOVE_RESEARCH_DEFAULT_AUTONOMY,
  DOVE_RESEARCH_QUALITY_REFERENCE_PATHS,
  renderDoveResearchReanchor
} from "./dove-research-contract.mjs";
import { DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS } from "./dove-author-preferences.mjs";
import { DOVE_CLAUDE_AMBIENT_RULE_PATH } from "./ambient-policy.mjs";

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

export function userPromptSubmitOutput(payload, guidance) {
  if (payload?.hook_event_name !== "UserPromptSubmit" || typeof payload.prompt !== "string") {
    throw new Error("Dove UserPromptSubmit hook requires a valid prompt event.");
  }
  if (!guidance) throw new Error("Dove UserPromptSubmit hook requires verified project guidance.");
  const context = `Dove ${guidance.version} current project guidance (verified on disk; not a Claude rule reload):\n${guidance.fingerprints.join("\n")}\n${renderDoveResearchReanchor()} ${DOVE_RESEARCH_DEFAULT_AUTONOMY}\nThis is a current short core, not the full rule. In this main context, if the full project rule and author preferences have not actually been read at these fingerprints, personally read .claude/rules/dove.md and .dove/install/AUTHOR_PREFERENCES.md through EOF before substantive Dove work; read .dove/install/RESEARCH_QUALITY.md when its existing decision triggers apply. If already read at these fingerprints, do not reread just because this hook ran. Use current Dove guidance for Dove-specific judgments while retaining the user's live goal, evidence, scope and permissions. Do not expand bounded or read-only requests. This hook does not refresh Claude's loaded rules, tools, permissions or Skills, or prove a read occurred.`;
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

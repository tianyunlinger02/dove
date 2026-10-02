import path from "node:path";

import {
  DOVE_AUTHOR_PREFERENCES_CONTINUITY,
  DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS,
  renderDoveAuthorPreferencesBootstrap
} from "./dove-author-preferences.mjs";
import { DOVE_RESEARCH_QUALITY_REFERENCE_PATHS, DOVE_RESEARCH_REFLECTION_CONTINUITY } from "./dove-research-contract.mjs";
import { identityCardContext } from "./identity-card.mjs";

export function parseSessionStartPayload(input) {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Dove SessionStart hook received malformed JSON.");
  }
  if (payload?.hook_event_name !== "SessionStart") {
    throw new Error("Dove SessionStart hook received an unsupported or missing hook event.");
  }
  return payload;
}

function systemMessage(message) {
  return { systemMessage: message };
}

export function sessionStartOutput(payload, result = null, options = {}) {
  const output = {};
  if (result && result.status !== "current") {
    output.systemMessage = "Dove project integration needs attention. SessionStart is read-only; run dove update explicitly to update supported manifest-owned integration. If blocked, inspect dove doctor --json before changing files.";
  }
  if (payload.source === "startup" || payload.source === "clear") {
    if (typeof options.project !== "string" || !path.isAbsolute(options.project)) {
      throw new Error("Dove SessionStart bootstrap requires an explicit absolute project root.");
    }
    output.hookSpecificOutput = {
      hookEventName: "SessionStart",
      additionalContext: renderDoveAuthorPreferencesBootstrap(
        path.join(options.project, DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.claude),
        path.join(options.project, DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.claude)
      )
    };
  } else if (payload.source === "compact" || payload.source === "resume") {
    output.hookSpecificOutput = {
      hookEventName: "SessionStart",
      additionalContext: `${identityCardContext(options.project, options)}\n${DOVE_AUTHOR_PREFERENCES_CONTINUITY}\n${DOVE_RESEARCH_REFLECTION_CONTINUITY}`
    };
  }
  return Object.keys(output).length > 0 ? output : null;
}

export function sessionStartFailureOutput(error) {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
  return systemMessage(`Dove SessionStart could not inspect project integration (read-only): ${message} Run dove update explicitly for supported integration, or dove doctor --json to inspect blocked state.`);
}

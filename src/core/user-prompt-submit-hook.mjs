import { renderDoveResearchReanchor } from "./dove-research-contract.mjs";
import { DOVE_AUTHOR_PREFERENCES_REFERENCE_PATH } from "./dove-author-preferences.mjs";
import { DOVE_CLAUDE_AMBIENT_RULE_PATH } from "./ambient-policy.mjs";
import { identityCardContext } from "./identity-card.mjs";
import { hostMigrationContext } from "./host-migration.mjs";
import { takeGuidanceUpdateNotice } from "./hook-state.mjs";
import { PROJECT_HOST_IDS } from "./host-registry.mjs";
import { PACKAGE_VERSION } from "./package-metadata.mjs";
import { readProjectInstallationManifest } from "./project-installation-manifest.mjs";
import { inspectRoundState, renderRoundSituation } from "./round-state.mjs";
import { userOriginalSourceContext } from "./session-start-hook.mjs";

// The installed guidance version comes from the project manifest. An older
// installation still gets the project context, with one line naming the gap.
export function inspectCurrentPromptGuidance(project, options = {}) {
  const manifest = readProjectInstallationManifest(project, { fsOps: options.fsOps, hostIds: PROJECT_HOST_IDS });
  if (!manifest?.hosts?.includes("claude")) throw new Error("Dove prompt guidance requires Claude integration.");
  const guidance = { version: manifest.package.version };
  const cliVersion = options.packageVersion ?? PACKAGE_VERSION;
  if (guidance.version !== cliVersion) guidance.note = `项目指导为 ${guidance.version}，命令行为 ${cliVersion}；方便时用 dove update 同步，不影响当前请求。`;
  return guidance;
}

export function guidanceUpdateNotice(version) {
  return `Dove 指导已更新到 ${version}：请先重读操作说明 ${DOVE_CLAUDE_AMBIENT_RULE_PATH} 和用户最常说的话 ${DOVE_AUTHOR_PREFERENCES_REFERENCE_PATH}，再按新版做事。本会话只提示这一次。`;
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

function automaticPrompt(prompt) {
  return /^<(?:task-notification|scheduled-wakeup|background-task)(?:\s|>)/u.test(prompt)
    || /^<system-reminder>\s*\[SYSTEM NOTIFICATION - NOT USER INPUT\]/u.test(prompt)
    || prompt === "[Your previous response had no visible output. Please continue and produce a user-visible response.]";
}

function roundSituationContext(project, options) {
  try {
    return renderRoundSituation(inspectRoundState(project, options), options);
  } catch {
    return "未能读取本轮记录；按身份卡和用户原话接着做。";
  }
}

/**
 * Options: project (absolute root), fsOps, now. Writes only Dove's own hook
 * state (which sessions have seen this guidance version).
 */
export function userPromptSubmitOutput(payload, guidance, options = {}) {
  if (payload?.hook_event_name !== "UserPromptSubmit" || typeof payload.prompt !== "string") {
    throw new Error("Dove UserPromptSubmit hook requires a valid prompt event.");
  }
  if (!guidance) throw new Error("Dove UserPromptSubmit hook requires verified project guidance.");
  if (automaticPrompt(payload.prompt.trim())) {
    return {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: `Dove ${guidance.version} · 自动通知，不是用户的新要求。`
      }
    };
  }
  const notice = options.project && takeGuidanceUpdateNotice(options.project, payload.session_id, guidance.version, options)
    ? `${guidanceUpdateNotice(guidance.version)}\n`
    : "";
  const context = `Dove ${guidance.version}\n${notice}${guidance.note ? `${guidance.note}\n` : ""}${identityCardContext(options.project, options)}\n\n${roundSituationContext(options.project, options)}\n\n${renderDoveResearchReanchor()} 身份卡不能替代用户最新原话。${userOriginalSourceContext(payload)}${hostMigrationContext(options.project, options)}`;
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
      additionalContext: "Dove 未读到本项目安装信息，本轮未附身份卡；dove doctor 可查看原因。仍按用户请求做事。"
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

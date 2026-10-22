import { createHash } from "node:crypto";

import { DOVE_RESEARCH_QUALITY_REFERENCE_PATHS, renderDoveResearchReanchor } from "./dove-research-contract.mjs";
import { DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS } from "./dove-author-preferences.mjs";
import { DOVE_CLAUDE_AMBIENT_RULE_PATH } from "./ambient-policy.mjs";
import { identityCardContext } from "./identity-card.mjs";
import { hostMigrationContext } from "./host-migration.mjs";
import { PROJECT_HOST_IDS } from "./host-registry.mjs";
import { PACKAGE_VERSION } from "./package-metadata.mjs";
import { readProjectInstallationManifest } from "./project-installation-manifest.mjs";
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

// Fingerprints come from the installed manifest. An older or locally edited
// installation still gets the project context, with one line naming the version gap.
export function inspectCurrentPromptGuidance(project, options = {}) {
  const manifest = readProjectInstallationManifest(project, { fsOps: options.fsOps, hostIds: PROJECT_HOST_IDS });
  const guidance = currentPromptGuidance(manifest);
  const cliVersion = options.packageVersion ?? PACKAGE_VERSION;
  if (guidance.version !== cliVersion) guidance.note = `项目指导为 ${guidance.version}，命令行为 ${cliVersion}；方便时用 dove update 同步，不影响当前请求。`;
  return guidance;
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
  const prompt = payload.prompt.trim();
  const automatic = /^<(?:task-notification|scheduled-wakeup|background-task)(?:\s|>)/u.test(prompt)
    || /^<system-reminder>\s*\[SYSTEM NOTIFICATION - NOT USER INPUT\]/u.test(prompt)
    || prompt === "[Your previous response had no visible output. Please continue and produce a user-visible response.]";
  if (automatic) {
    const fingerprint = createHash("sha256").update(guidance.fingerprints.join("\n")).digest("hex").slice(0, 12);
    return {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: `Dove ${guidance.version} · guidance ${fingerprint} · 自动通知，不是用户的新要求。`
      }
    };
  }
  const context = `Dove ${guidance.version}（磁盘指导，不代表已重新加载）：\n${guidance.fingerprints.join("\n")}\n${guidance.note ? `${guidance.note}\n` : ""}${identityCardContext(options.project, options)}\n${renderDoveResearchReanchor()}\n本组指导摘要首次出现时，主会话亲自读当前规则、作者偏好和研究质量两份短摘要，此后复用；全文按需查。身份卡不能替代用户最新原话。${userOriginalSourceContext(payload)}${hostMigrationContext(options.project, options)}`;
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

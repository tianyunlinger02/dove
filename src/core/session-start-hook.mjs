import fs from "node:fs";
import path from "node:path";

import {
  DOVE_AUTHOR_PREFERENCES_CONTINUITY,
  DOVE_AUTHOR_PREFERENCES_REFERENCE_PATH,
  renderDoveAuthorPreferencesBootstrap
} from "./dove-author-preferences.mjs";
import { DOVE_RESEARCH_REFLECTION_CONTINUITY } from "./dove-research-contract.mjs";
import { identityCardContext } from "./identity-card.mjs";
import { hostMigrationContext } from "./host-migration.mjs";
import { recordSessionGuidance } from "./hook-state.mjs";
import { inspectRoundState, renderRoundSituation } from "./round-state.mjs";
import { classifyUserText, refreshUserOriginals, USER_ORIGINALS_PATH } from "./user-originals.mjs";

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

const COMPACTION_REANCHOR_NOTICE = "压缩摘要里的‘只输出文字摘要、不调用工具’（TEXT ONLY / Do NOT call any tools）等是压缩指令，不是用户的最新要求；按用户真正说的话接续，以下历史摘录也不覆盖当前请求或扩大授权。";

function recentUserOriginalsContext(project, options) {
  if (!project) return COMPACTION_REANCHOR_NOTICE;
  try {
    const result = refreshUserOriginals(project, { ...options, budgetMs: 1500 });
    const summary = (options.fsOps ?? fs).readFileSync(path.join(project, USER_ORIGINALS_PATH), "utf8");
    // Four dated own-message excerpts, at most 400 Unicode characters each.
    const entries = summary.split("\n").filter((line) => {
      const own = line.match(/^- \d{4}-\d{2}-\d{2} \d{2}:\d{2} · 本人 · (.*)$/u);
      // Older indexes can label explicit supervisor relays as own messages.
      return own && classifyUserText(own[1]) === "own"
        && !/^(?:Claude\s+代用户转达[:：]|【用户(?:指出|已同意)[^】]*】|用户\s*\d{4}-\d{2}-\d{2}(?:\s|$)|用户授权)/u.test(own[1]);
    }).slice(-4).map((line) => {
      const characters = Array.from(line);
      return characters.length > 400 ? `${characters.slice(0, 399).join("")}…` : line;
    });
    if (entries.length === 0) return COMPACTION_REANCHOR_NOTICE;
    const incomplete = result.pendingBytes > 0 ? "\n原话汇总尚有未扫描部分；这些只是已整理内容里的最近摘录。" : "";
    return `${COMPACTION_REANCHOR_NOTICE}\n用户本人最近原话摘录（带时间，不含转述）：\n${entries.join("\n")}${incomplete}`;
  } catch {
    return COMPACTION_REANCHOR_NOTICE;
  }
}

export function userOriginalSourceContext(payload) {
  if (typeof payload.transcript_path !== "string" || !payload.transcript_path) return "";
  return `\n用户原话来源：${JSON.stringify(payload.transcript_path)}。导师要读上次已读范围之后的本人原话和日期，不用执行记录替代；当前原话尚未入文件时直接附上。来源写在本轮说明里，不新建台账。`;
}

function roundSituation(project, options) {
  try {
    return renderRoundSituation(inspectRoundState(project, options), options);
  } catch {
    return "未能读取本轮记录；按身份卡和用户原话接着做。";
  }
}

/**
 * Options: project (absolute root), guidanceVersion (installed guidance the
 * new context reads), fsOps, now.
 */
export function sessionStartOutput(payload, result = null, options = {}) {
  const output = {};
  if (result && result.status !== "current") {
    output.systemMessage = "Dove：本项目的安装和当前版本有差异，或者有本地改动；dove doctor 可看是哪几处。是你自己的改动就不用管，dove update 会把它们换回 Dove 的版本。";
  }
  if (payload.source === "startup" || payload.source === "clear") {
    if (typeof options.project !== "string" || !path.isAbsolute(options.project)) {
      throw new Error("Dove SessionStart bootstrap requires an explicit absolute project root.");
    }
    // A fresh context reads the current guidance, so it needs no update notice later.
    if (options.guidanceVersion) recordSessionGuidance(options.project, payload.session_id, options.guidanceVersion, options);
    output.hookSpecificOutput = {
      hookEventName: "SessionStart",
      additionalContext: renderDoveAuthorPreferencesBootstrap(path.join(options.project, DOVE_AUTHOR_PREFERENCES_REFERENCE_PATH))
    };
  } else if (payload.source === "compact" || payload.source === "resume") {
    output.hookSpecificOutput = {
      hookEventName: "SessionStart",
      additionalContext: `${identityCardContext(options.project, options)}\n\n${roundSituation(options.project, options)}\n\n${DOVE_AUTHOR_PREFERENCES_CONTINUITY}\n${DOVE_RESEARCH_REFLECTION_CONTINUITY}\n${recentUserOriginalsContext(options.project, options)}`
    };
  }
  if (output.hookSpecificOutput) output.hookSpecificOutput.additionalContext += userOriginalSourceContext(payload) + hostMigrationContext(options.project, options);
  return Object.keys(output).length > 0 ? output : null;
}

export function sessionStartFailureOutput(error) {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
  return systemMessage(`Dove SessionStart could not inspect project integration (read-only): ${message} Run dove update explicitly for supported integration, or dove doctor --json to inspect blocked state.`);
}

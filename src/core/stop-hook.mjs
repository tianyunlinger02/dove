import fs from "node:fs";

import { parseDoveCurrentRound, readDoveIdentityCard } from "./identity-card.mjs";

export function parseStopPayload(input) {
  try {
    const payload = JSON.parse(input);
    return payload?.hook_event_name === "Stop" && payload.stop_hook_active === false ? payload : null;
  } catch {
    return null;
  }
}

function userTurn(record) {
  const content = record.message?.content;
  return record.type === "user" && !record.isMeta
    && (typeof content === "string" || Array.isArray(content)
      && content.length > 0 && !content.some((block) => block.type === "tool_result"));
}

export function mentorCallInRecord(record, called = false) {
  if (userTurn(record)) return false;
  const content = record.message?.content;
  return called || (record.type === "assistant" && Array.isArray(content)
    && content.some((block) => block.type === "tool_use" && block.name === "Agent"
      && block.input?.subagent_type === "dove-mentor"));
}

async function mentorCalled(transcriptPath) {
  const file = await fs.promises.open(transcriptPath, "r");
  const buffer = Buffer.alloc(64 * 1024);
  let pending = Buffer.alloc(0);
  let called = false;
  function inspectLine(bytes) {
    const line = bytes.toString("utf8").trim();
    if (!line) return null;
    const record = JSON.parse(line);
    // Inspect event/tool metadata only, stopping at the latest user turn.
    if (userTurn(record)) return called;
    called = mentorCallInRecord(record, called);
    return null;
  }
  try {
    let position = (await file.stat()).size;
    while (position > 0) {
      const length = Math.min(buffer.length, position);
      position -= length;
      const { bytesRead } = await file.read(buffer, 0, length, position);
      const chunk = Buffer.concat([buffer.subarray(0, bytesRead), pending]);
      let end = chunk.length;
      while (end > 0) {
        const start = chunk.lastIndexOf(10, end - 1);
        if (start < 0) break;
        const result = inspectLine(chunk.subarray(start + 1, end));
        if (result !== null) return result;
        end = start;
      }
      pending = chunk.subarray(0, end);
    }
    return inspectLine(pending);
  } finally {
    await file.close();
  }
}

export async function stopHookOutput(payload, options = {}) {
  if (!payload || payload.stop_hook_active !== false) return null;
  const round = parseDoveCurrentRound(readDoveIdentityCard(options.project, options) ?? "");
  if (!round?.ongoing || typeof payload.transcript_path !== "string") return null;
  try {
    if (await (options.mentorCalled ?? mentorCalled)(payload.transcript_path) !== false) return null;
  } catch {
    return null;
  }
  return {
    decision: "block",
    reason: "本轮还在进行中。写本轮结果并调用导师。若用户明确要求只讨论或停下，把身份卡的 Round status 标为 paused，然后结束；这条提醒只阻止一次。"
  };
}

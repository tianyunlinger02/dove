import fs from "node:fs";
import path from "node:path";

// Small per-project memory of what the hooks already said: which guidance
// version each session has seen, and which Stop prompts were asked. Losing it
// only repeats a notice once; it never holds research content.
export const HOOK_STATE_PATH = ".dove/install/hook-state.json";
const MAX_SESSIONS = 200;
const MAX_ASKED = 200;

export function readHookState(project, options = {}) {
  const fsOps = options.fsOps ?? fs;
  try {
    const value = JSON.parse(fsOps.readFileSync(path.join(project, HOOK_STATE_PATH), "utf8"));
    return {
      sessions: value?.sessions && typeof value.sessions === "object" && !Array.isArray(value.sessions) ? value.sessions : {},
      asked: value?.asked && typeof value.asked === "object" && !Array.isArray(value.asked) ? value.asked : {}
    };
  } catch {
    return { sessions: {}, asked: {} };
  }
}

function newest(entries, limit, time) {
  return Object.fromEntries(Object.entries(entries).sort((left, right) => String(time(right[1])).localeCompare(String(time(left[1])))).slice(0, limit));
}

// Read, change and write back in one step; a failed write is ignored.
export function updateHookState(project, change, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const state = readHookState(project, options);
  change(state);
  const next = {
    sessions: newest(state.sessions, MAX_SESSIONS, (entry) => entry?.at ?? ""),
    asked: newest(state.asked, MAX_ASKED, (entry) => entry ?? "")
  };
  const file = path.join(project, HOOK_STATE_PATH);
  try {
    fsOps.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    fsOps.writeFileSync(temporary, `${JSON.stringify(next)}\n`);
    fsOps.renameSync(temporary, file);
  } catch {
    // The hooks still answer; at worst a notice repeats once.
  }
  return next;
}

/** Remember that this session read the guidance of this version (at startup or /clear). */
export function recordSessionGuidance(project, sessionId, version, options = {}) {
  if (typeof sessionId !== "string" || !sessionId) return;
  updateHookState(project, (state) => {
    state.sessions[sessionId] = { version, at: new Date(options.now ?? Date.now()).toISOString() };
  }, options);
}

/**
 * True once per session after the installed guidance changed since the session
 * read it; sessions Dove has no record of (started before this release) count as changed.
 */
export function takeGuidanceUpdateNotice(project, sessionId, version, options = {}) {
  if (typeof sessionId !== "string" || !sessionId) return false;
  const seen = readHookState(project, options).sessions[sessionId]?.version;
  if (seen === version) return false;
  recordSessionGuidance(project, sessionId, version, options);
  return true;
}

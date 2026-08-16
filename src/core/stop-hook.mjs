function parseStopPayload(input) {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Dove Stop hook received malformed JSON.");
  }
  if (payload?.hook_event_name !== "Stop") {
    throw new Error("Dove Stop hook received an unsupported or missing hook event.");
  }
  return payload;
}

export function stopHookOutput(input) {
  const payload = parseStopPayload(input);
  if (payload.stop_hook_active === true) return null;
  if (typeof payload.last_assistant_message !== "string" || payload.last_assistant_message.trim() === "") return null;
  return {
    decision: "block",
    reason: "说人话"
  };
}

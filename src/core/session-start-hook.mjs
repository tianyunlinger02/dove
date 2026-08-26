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

export function sessionStartOutput(input) {
  parseSessionStartPayload(input);
  return null;
}

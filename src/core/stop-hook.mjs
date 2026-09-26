// Stop has the final assistant message, not the user's current request. The
// same message may be an early sign-off or a correct bounded report; neither
// the transcript path nor a wording match establishes authorization to resume.
export function parseStopPayload(input) {
  if (typeof input !== "string" || input.length > 64_000) return null;
  try {
    const payload = JSON.parse(input);
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)
      || payload.hook_event_name !== "Stop" || payload.stop_hook_active !== false
      || typeof payload.last_assistant_message !== "string"
      || payload.last_assistant_message.length > 12_000
      || (payload.session_id !== undefined && typeof payload.session_id !== "string")) return null;
    return payload;
  } catch {
    return null;
  }
}

export function stopHookOutput(_payload) {
  // No supported Stop payload contains the active user's scope. In particular,
  // additionalContext would also prolong a bounded request, so fail open.
  return null;
}

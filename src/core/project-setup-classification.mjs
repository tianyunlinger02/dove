const ACTIONS = Object.freeze({
  uninitialized: Object.freeze(["init", "details", "exit"]),
  "needs-update": Object.freeze(["update", "change-hosts", "reinstall", "uninstall", "details", "exit"]),
  current: Object.freeze(["change-hosts", "reinstall", "uninstall", "details", "exit"]),
  blocked: Object.freeze(["details", "exit"])
});

export function classifyProjectSetup(result) {
  const state = result?.projectIntegration?.state;
  const mode = Object.hasOwn(ACTIONS, state) ? state : "blocked";
  return Object.freeze({ mode, reason: mode, allowedActions: ACTIONS[mode] });
}

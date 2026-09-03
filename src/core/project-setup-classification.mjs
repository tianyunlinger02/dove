const ACTIONS = Object.freeze({
  init: Object.freeze(["init", "details", "exit"]),
  adopt: Object.freeze(["adopt", "details", "exit"]),
  update: Object.freeze(["update", "change-hosts", "reinstall", "uninstall", "details", "exit"]),
  current: Object.freeze(["change-hosts", "reinstall", "uninstall", "details", "exit"]),
  drifted: Object.freeze(["reinstall", "details", "exit"]),
  blocked: Object.freeze(["details", "exit"])
});

function setup(mode, reason, actions = mode) {
  return Object.freeze({ mode, reason, allowedActions: ACTIONS[actions] });
}

export function classifyProjectSetup(result) {
  const integration = result?.projectIntegration ?? {};
  const migration = result?.migrationInstallation ?? { state: "absent" };
  const workspace = result?.workspaceState ?? { mode: "unavailable", healthy: false };
  const adoption = result?.adoption ?? { state: "absent" };

  if (migration.state === "conflicting-manifests") return setup("blocked", "conflicting-manifests");
  if (migration.state === "valid-legacy") return setup("blocked", "unsupported-legacy-installation");
  if (migration.state === "invalid-legacy") return setup("blocked", "invalid-legacy");
  if (adoption.state === "adoptable") return setup("adopt", "adoptable");
  if (integration.state === "drifted" && integration.manifest !== null) return setup("blocked", "drifted", "drifted");
  if (integration.state === "invalid") return setup("blocked", "invalid");
  if (integration.state === "needs-sync") return setup("update", "needs-sync");
  if (integration.state === "current") return setup("current", "current");
  if (workspace.mode === "current" && workspace.healthy === true) return setup("init", "preserved-research");
  if (workspace.mode !== "absent") return setup("blocked", "unsupported-workspace");
  return setup("init", "clean-uninitialized");
}

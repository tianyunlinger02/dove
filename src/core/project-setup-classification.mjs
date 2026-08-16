const ACTIONS = Object.freeze({
  init: Object.freeze(["init", "exit"]),
  update: Object.freeze(["update", "exit"]),
  updateOrReinstall: Object.freeze(["update", "reinstall", "exit"]),
  reinstall: Object.freeze(["reinstall", "exit"]),
  blocked: Object.freeze(["exit"])
});

function setup(mode, reason, actions = mode) {
  return Object.freeze({ mode, reason, allowedActions: ACTIONS[actions] });
}

export function classifyProjectSetup(result) {
  const integration = result?.projectIntegration ?? {};
  const migration = result?.migrationInstallation ?? { state: "absent" };
  const workspace = result?.workspaceState ?? { mode: "unavailable", healthy: false };

  if (migration.state === "conflicting-manifests") return setup("reinstall", "conflicting-manifests");
  if (migration.state === "valid-legacy") return setup("update", "valid-legacy", "updateOrReinstall");
  if (migration.state === "invalid-legacy") return setup("reinstall", "invalid-legacy");
  if (["invalid", "drifted"].includes(integration.state)) return setup("blocked", integration.state);
  if (integration.state === "needs-sync") return setup("update", "needs-sync", "updateOrReinstall");
  if (integration.state === "current") return setup("reinstall", "current");
  if (workspace.mode !== "absent") return setup("reinstall", "unsupported-workspace");
  return setup("init", "clean-uninitialized");
}

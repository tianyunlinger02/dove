const ACTIONS = Object.freeze({
  init: Object.freeze(["init", "exit"]),
  upgrade: Object.freeze(["upgrade", "reinstall", "exit"]),
  reinstall: Object.freeze(["reinstall", "exit"]),
  blocked: Object.freeze(["exit"])
});

function setup(mode, reason) {
  return Object.freeze({ mode, reason, allowedActions: ACTIONS[mode] });
}

export function classifyProjectSetup(result) {
  const integration = result?.projectIntegration ?? {};
  const migration = result?.migrationInstallation ?? { state: "absent", upgrade: { ready: false }, reinstall: { ready: false } };
  const workspace = result?.workspaceState ?? { mode: "unavailable", healthy: false };
  const copiedRuntime = result?.legacyCopiedRuntime?.detected === true;
  const reinstallReady = migration.reinstall?.ready === true;

  if (migration.state === "conflicting-manifests") {
    return reinstallReady ? setup("reinstall", "conflicting-manifests") : setup("blocked", "conflicting-manifests");
  }
  if (migration.state === "valid-legacy") return setup("upgrade", "valid-legacy");
  if (migration.state === "invalid-legacy") {
    return reinstallReady ? setup("reinstall", "invalid-legacy") : setup("blocked", "invalid-legacy");
  }
  if (["invalid", "drifted"].includes(integration.state)) return setup("blocked", integration.state);
  if (copiedRuntime) return setup("blocked", "legacy-copied-runtime");
  if (["current", "needs-sync"].includes(integration.state)) return setup("upgrade", integration.state);
  if (workspace.mode !== "absent") {
    return reinstallReady ? setup("reinstall", "unsupported-workspace") : setup("blocked", "unsupported-workspace");
  }
  return setup("init", "clean-uninitialized");
}

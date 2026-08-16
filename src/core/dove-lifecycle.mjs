import {
  completeReinstallProjectIntegration,
  updateProjectIntegration,
  upgradeProjectIntegration
} from "./project-installation.mjs";

function publicUpdateResult(result) {
  return {
    ...result,
    status: result.status === "unchanged" ? "unchanged" : "updated"
  };
}

export function upgradeDoveLifecycle(start, options = {}) {
  return upgradeProjectIntegration(start, options);
}

export function updateDoveLifecycle(start, options = {}) {
  try {
    return publicUpdateResult(updateProjectIntegration(start, options));
  } catch (currentError) {
    try {
      return publicUpdateResult(upgradeDoveLifecycle(start, options));
    } catch (migrationError) {
      throw new Error(
        `Dove update requires a current installation manifest or an explicit 1.0 manifest: ${migrationError instanceof Error ? migrationError.message : String(migrationError)}`,
        { cause: currentError }
      );
    }
  }
}

export function completeReinstallDoveLifecycle(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Complete Reinstall requires confirmed: true.");
  return completeReinstallProjectIntegration(start, options);
}

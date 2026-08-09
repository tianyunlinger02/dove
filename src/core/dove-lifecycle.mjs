import {
  completeReinstallProjectIntegration,
  previewProjectCompleteReinstall,
  previewProjectUpgrade,
  upgradeProjectIntegration
} from "./project-installation.mjs";

export function upgradeDoveLifecycle(start, options = {}) {
  const preview = previewProjectUpgrade(start, options);
  return upgradeProjectIntegration(start, { ...options, preview });
}

export function completeReinstallDoveLifecycle(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Complete Reinstall requires confirmed: true.");
  const preview = previewProjectCompleteReinstall(start, options);
  return completeReinstallProjectIntegration(start, { ...options, preview });
}

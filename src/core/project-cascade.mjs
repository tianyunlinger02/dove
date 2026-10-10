import { PROJECT_HOST_IDS } from "./host-registry.mjs";
import { classifyPackageCompatibility } from "./package-metadata.mjs";
import { readProjectInstallationManifest } from "./project-installation-manifest.mjs";
import { assertManagedOwnership } from "./project-installation-plan.mjs";
import { inspectProjectIntegration, syncProjectIntegration } from "./project-installation.mjs";
import { resolveExactInstalledProjectRoot } from "./project-root.mjs";
import { changeRegisteredProjects, readLastProjectSync, readRegisteredProjects, writeLastProjectSync } from "./project-registry.mjs";

export function importProjectRoots(roots, options = {}) {
  if (!Array.isArray(roots) || roots.length === 0) throw new Error("Dove project import requires at least one exact project root.");
  const verified = roots.map((start) => {
    const root = resolveExactInstalledProjectRoot(start, { hostIds: PROJECT_HOST_IDS });
    const manifest = readProjectInstallationManifest(root, { hostIds: PROJECT_HOST_IDS });
    assertManagedOwnership(manifest);
    const compatibility = classifyPackageCompatibility(manifest.package, { name: options.packageName, version: options.packageVersion });
    if (["identity-mismatch", "invalid-version", "newer"].includes(compatibility)) throw new Error(`Dove cannot register incompatible project integration: ${root}.`);
    return root;
  });
  return changeRegisteredProjects(verified, [], options);
}

export function syncRegisteredProjects(options = {}) {
  const roots = readRegisteredProjects(options);
  const projects = [];
  for (const root of roots) {
    try {
      const inspection = inspectProjectIntegration(root, { packageName: options.packageName, packageVersion: options.packageVersion, autoSync: true });
      if (inspection.target !== root) throw new Error("Dove registered project root changed.");
      const result = syncProjectIntegration(root, { packageName: options.packageName, packageVersion: options.packageVersion });
      projects.push({ target: root, status: result.status, changedPaths: result.changedPaths, ...(result.skippedLocalEdits.length ? { preservedLocalEdits: result.skippedLocalEdits } : {}) });
    } catch {
      projects.push({ target: root, status: "blocked", reason: "Integration could not be safely updated; inspect this project's Dove doctor output." });
    }
  }
  const report = { packageVersion: options.packageVersion, projects, status: projects.some((item) => item.status === "blocked") ? "partial" : "current" };
  try {
    writeLastProjectSync(report, options);
  } catch (error) {
    report.reportError = error instanceof Error ? error.message : String(error);
    report.status = "partial";
  }
  return report;
}

export function inspectRegisteredProjects(options = {}) {
  return { projects: readRegisteredProjects(options), lastSync: readLastProjectSync(options) };
}

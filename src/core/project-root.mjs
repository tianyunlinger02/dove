import fs from "node:fs";
import path from "node:path";

import { PROJECT_HOST_IDS } from "./host-registry.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  LEGACY_INSTALLATION_MANIFEST_PATH,
  readProjectInstallationManifest
} from "./project-installation-manifest.mjs";

const INSTALLATION_DIRECTORY = path.posix.dirname(INSTALLATION_MANIFEST_PATH);

function realpathNative(fsOps, targetPath) {
  return typeof fsOps.realpathSync?.native === "function" ? fsOps.realpathSync.native(targetPath) : fsOps.realpathSync(targetPath);
}

function canonicalExistingDirectory(value, label, fsOps) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error(`${label} must name an existing directory.`);
  const resolved = path.resolve(value);
  let stat;
  try {
    stat = fsOps.statSync(resolved);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`${label} must name an existing directory: ${resolved}.`);
    throw error;
  }
  if (!stat.isDirectory()) throw new Error(`${label} must name an existing directory: ${resolved}.`);
  return realpathNative(fsOps, resolved);
}

function parentDirectories(start) {
  const directories = [];
  let current = start;
  while (true) {
    directories.push(current);
    const parent = path.dirname(current);
    if (parent === current) return directories;
    current = parent;
  }
}

function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function installationStateAt(root, options) {
  const fsOps = options.fsOps ?? fs;
  const directoryPath = path.join(root, INSTALLATION_DIRECTORY);
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_PATH);
  const manifestStat = lstatOrNull(fsOps, manifestPath);
  if (manifestStat === null) {
    const directoryStat = lstatOrNull(fsOps, directoryPath);
    if (directoryStat === null) return { state: "absent", root, manifestPath };
    return { state: "residue", root, manifestPath, directoryPath, directoryStat };
  }
  if (manifestStat.isSymbolicLink()) throw new Error(`Dove project installation manifest must not be a symbolic link: ${manifestPath}.`);
  if (!manifestStat.isFile()) throw new Error(`Dove project installation manifest must be a regular file: ${manifestPath}.`);
  const directoryStat = lstatOrNull(fsOps, directoryPath);
  if (directoryStat === null || directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) throw new Error(`Dove installation path must be a real directory: ${directoryPath}.`);
  const manifest = readProjectInstallationManifest(root, { ...options, hostIds: options.hostIds ?? PROJECT_HOST_IDS });
  return { state: "initialized", root, manifestPath, manifest };
}

function assertSafeInitCandidate(candidate, installation) {
  if (installation.state !== "residue") return;
  const stat = installation.directoryStat;
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove installation path must be a real directory: ${installation.directoryPath}.`);
  throw new Error(`Dove installation directory is incomplete because ${INSTALLATION_MANIFEST_PATH} is missing at ${candidate}.`);
}

function setupEvidenceAt(root, fsOps, options = {}) {
  const paths = [
    INSTALLATION_MANIFEST_PATH,
    LEGACY_INSTALLATION_MANIFEST_PATH,
    ...(options.includeResearch === true ? [".dove/manifest.json"] : [])
  ];
  for (const relativePath of paths) {
    const target = path.join(root, relativePath);
    const stat = lstatOrNull(fsOps, target);
    if (stat === null) continue;
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(`Dove setup marker must be a regular non-symbolic-link file: ${target}.`);
    }
    return { state: "marker", relativePath };
  }
  for (const relativePath of [INSTALLATION_DIRECTORY, ".dove-install"]) {
    const target = path.join(root, relativePath);
    const stat = lstatOrNull(fsOps, target);
    if (stat === null) continue;
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Dove setup path must be a real directory: ${target}.`);
    }
    return { state: "residue", relativePath };
  }
  return { state: "absent", relativePath: null };
}

function legacyInitError(candidate, root, evidence) {
  if (evidence.relativePath === LEGACY_INSTALLATION_MANIFEST_PATH) {
    return new Error(`Dove found a legacy project installation at ${root}. Run 'dove upgrade' to preserve its research state, or 'dove reinstall' to delete and recreate Dove state.`);
  }
  if (evidence.relativePath === ".dove/manifest.json") {
    return new Error(`Dove found an unsupported legacy research workspace at ${root}. Run 'dove reinstall' to delete and recreate Dove state, or 'dove doctor --json' for diagnosis.`);
  }
  return new Error(`Dove found incomplete legacy Dove state at ${root}. Run 'dove doctor --json' before initializing another project.`);
}

function gitRootFrom(start, fsOps) {
  for (const directory of parentDirectories(start)) {
    const dotGit = path.join(directory, ".git");
    const stat = lstatOrNull(fsOps, dotGit);
    if (stat === null) continue;
    if (stat.isSymbolicLink()) throw new Error(`Git project marker must not be a symbolic link: ${dotGit}.`);
    if (!stat.isDirectory() && !stat.isFile()) throw new Error(`Git project marker must be a file or directory: ${dotGit}.`);
    return directory;
  }
  return null;
}

function initRequiredError(start) {
  return new Error(`Dove project integration is not initialized from ${start}. Run 'dove init' from the project root, or use 'dove init --project <dir>'.`);
}

export function resolveProjectRootForInit(project, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const explicitProject = project !== undefined && project !== null;
  const candidateInput = explicitProject ? project : options.cwd ?? process.cwd();
  const candidate = canonicalExistingDirectory(candidateInput, explicitProject ? "Dove project" : "Current working directory", fsOps);

  const gitRoot = gitRootFrom(candidate, fsOps);
  const allDirectories = parentDirectories(candidate);
  const directories = gitRoot === null
    ? allDirectories
    : allDirectories.slice(0, allDirectories.indexOf(gitRoot) + 1);
  for (let index = 0; index < directories.length; index += 1) {
    const directory = directories[index];
    const installation = installationStateAt(directory, options);
    if (index === 0) assertSafeInitCandidate(candidate, installation);
    if (installation.state === "initialized") {
      if (index === 0) throw new Error(`Dove project integration is already initialized at ${directory}. Use dove sync instead.`);
      throw new Error(`Refusing nested Dove project initialization at ${candidate}; an initialized project already exists at ${directory}.`);
    }
    const evidence = setupEvidenceAt(directory, fsOps, { includeResearch: index === 0 });
    if (evidence.state !== "absent") throw legacyInitError(candidate, directory, evidence);
  }

  if (!explicitProject) {
    const gitRoot = gitRootFrom(candidate, fsOps);
    if (gitRoot !== null && gitRoot !== candidate) {
      throw new Error(`Refusing to initialize Dove from Git project subdirectory ${candidate}. Run dove init from the Git root ${gitRoot}, or pass an explicit --project directory.`);
    }
  }
  return candidate;
}

function packageProjectBoundary(directory, fsOps) {
  const packageJson = lstatOrNull(fsOps, path.join(directory, "package.json"));
  const nodeModules = lstatOrNull(fsOps, path.join(directory, "node_modules"));
  return packageJson?.isFile() && !packageJson.isSymbolicLink()
    && nodeModules?.isDirectory() && !nodeModules.isSymbolicLink();
}

export function resolveProjectRootForSetup(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const candidate = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project setup start", fsOps);
  for (const directory of parentDirectories(candidate)) {
    if (setupEvidenceAt(directory, fsOps).state !== "absent") return directory;
    const dotGit = lstatOrNull(fsOps, path.join(directory, ".git"));
    if (dotGit !== null) {
      if (dotGit.isSymbolicLink() || (!dotGit.isDirectory() && !dotGit.isFile())) {
        throw new Error(`Git project marker must be a file or directory: ${path.join(directory, ".git")}.`);
      }
      return directory;
    }
    if (packageProjectBoundary(directory, fsOps)) return directory;
  }
  return candidate;
}

export function resolveInstalledProjectRoot(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const startingDirectory = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project search start", fsOps);
  for (const directory of parentDirectories(startingDirectory)) {
    const installation = installationStateAt(directory, options);
    if (installation.state === "initialized") return directory;
  }
  throw initRequiredError(startingDirectory);
}

export function inspectProjectRoot(start, options = {}) {
  let canonicalStart = null;
  try {
    canonicalStart = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project search start", options.fsOps ?? fs);
    const root = resolveInstalledProjectRoot(canonicalStart, options);
    return Object.freeze({ state: "initialized", initialized: true, start: canonicalStart, root, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const uninitialized = message.includes("Dove project integration is not initialized");
    return Object.freeze({
      state: uninitialized ? "uninitialized" : "invalid",
      initialized: false,
      start: canonicalStart,
      root: null,
      error: message
    });
  }
}

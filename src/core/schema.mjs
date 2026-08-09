export const PACKAGE_VERSION = "0.7.0";
export const DOVE_RESEARCH_FORMAT = "dove-research-v1";
export const LEGACY_DOVE_SCHEMA_VERSION = 20;
export const DEFAULT_DOVE_RESPONSE_LANGUAGE = "zh";

export function normalizeDoveResponseLanguage(value, fallback = DEFAULT_DOVE_RESPONSE_LANGUAGE, options = {}) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "zh" || normalized === "en") return normalized;
  if (options.strict && normalized) throw new Error(`Unsupported Dove response language: ${String(value)}.`);
  return fallback;
}

export const ARTIFACT_PATHS = Object.freeze({
  doveRoot: ".dove",
  installDir: ".dove/install",
  installationManifest: ".dove/install/manifest.json",
  transactionsDir: ".dove/install/transactions",
  format: ".dove/format.json",
  workspace: ".dove/workspace.json",
  missionsDir: ".dove/missions",
  sourcesDir: ".dove/sources",
  experimentsDir: ".dove/experiments",
  claimsDir: ".dove/claims",
  reviewsDir: ".dove/reviews",
  lessons: ".dove/LESSONS.md"
});

export const RESEARCH_DIRECTORIES = Object.freeze([
  ARTIFACT_PATHS.missionsDir,
  ARTIFACT_PATHS.sourcesDir,
  ARTIFACT_PATHS.experimentsDir,
  ARTIFACT_PATHS.claimsDir,
  ARTIFACT_PATHS.reviewsDir
]);

export const RESEARCH_REQUIRED_FILES = Object.freeze([
  ARTIFACT_PATHS.format,
  ARTIFACT_PATHS.workspace,
  ARTIFACT_PATHS.lessons
]);

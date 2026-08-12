export { PACKAGE_VERSION } from "./package-metadata.mjs";
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
  doctor: ".dove/install/doctor.json",
  doctorDocument: ".dove/install/DOCTOR.md",
  transactionsDir: ".dove/install/transactions",
  archiveDir: ".dove/archive",
  researchDocumentsDir: ".dove/research",
  researchOverview: ".dove/research/RESEARCH.md",
  researchLessons: ".dove/research/LESSONS.md"
});

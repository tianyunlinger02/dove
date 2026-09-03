export { PACKAGE_VERSION } from "./package-metadata.mjs";

export const ARTIFACT_PATHS = Object.freeze({
  doveRoot: ".dove",
  installDir: ".dove/install",
  installationManifest: ".dove/install/manifest.json",
  doctorDocument: ".dove/install/DOCTOR.md",
  transactionsDir: ".dove/install/transactions",
  archiveDir: ".dove/archive",
  reviewsDir: ".dove/reviews",
  runsDir: ".dove/runs",
  researchDocumentsDir: ".dove/research",
  researchOverview: ".dove/research/RESEARCH.md",
  researchLessons: ".dove/research/lessons/LESSONS.md"
});

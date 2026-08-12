import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const injectedName = typeof __DOVE_PACKAGE_NAME__ === "string" ? __DOVE_PACKAGE_NAME__ : null;
const injectedVersion = typeof __DOVE_PACKAGE_VERSION__ === "string" ? __DOVE_PACKAGE_VERSION__ : null;

function parseSemver(value) {
  const match = typeof value === "string"
    ? value.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u)
    : null;
  if (!match) return null;
  const prerelease = match[4]?.split(".") ?? [];
  if (prerelease.some((identifier) => /^\d+$/u.test(identifier) && identifier.length > 1 && identifier.startsWith("0"))) return null;
  return { core: match.slice(1, 4), prerelease };
}

function compareNumericIdentifier(left, right) {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}

function comparePrereleaseIdentifier(left, right) {
  const leftNumeric = /^\d+$/u.test(left);
  const rightNumeric = /^\d+$/u.test(right);
  if (leftNumeric && rightNumeric) return compareNumericIdentifier(left, right);
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}

export function comparePackageVersions(left, right) {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < leftParts.core.length; index += 1) {
    const order = compareNumericIdentifier(leftParts.core[index], rightParts.core[index]);
    if (order !== 0) return order;
  }
  if (leftParts.prerelease.length === 0 || rightParts.prerelease.length === 0) {
    if (leftParts.prerelease.length === rightParts.prerelease.length) return 0;
    return leftParts.prerelease.length === 0 ? 1 : -1;
  }
  const count = Math.max(leftParts.prerelease.length, rightParts.prerelease.length);
  for (let index = 0; index < count; index += 1) {
    if (leftParts.prerelease[index] === undefined) return -1;
    if (rightParts.prerelease[index] === undefined) return 1;
    const order = comparePrereleaseIdentifier(leftParts.prerelease[index], rightParts.prerelease[index]);
    if (order !== 0) return order;
  }
  return 0;
}

export function classifyPackageCompatibility(candidate, expected) {
  if (!candidate || !expected || candidate.name !== expected.name) return "identity-mismatch";
  const order = comparePackageVersions(candidate.version, expected.version);
  if (order === null) return "invalid-version";
  if (order > 0) return "newer";
  if (order < 0) return "older";
  return "current";
}

function sourcePackage() {
  const packagePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..", "package.json");
  return JSON.parse(fs.readFileSync(packagePath, "utf8"));
}

const packageMetadata = injectedName && injectedVersion
  ? { name: injectedName, version: injectedVersion }
  : sourcePackage();

if (typeof packageMetadata.name !== "string" || !packageMetadata.name) throw new Error("Dove package name is invalid.");
if (!parseSemver(packageMetadata.version)) throw new Error("Dove package version is invalid.");

export const PACKAGE_NAME = packageMetadata.name;
export const PACKAGE_VERSION = packageMetadata.version;

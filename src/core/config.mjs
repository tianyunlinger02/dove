import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DEFAULT_DOVE_RESPONSE_LANGUAGE, normalizeDoveResponseLanguage } from "./schema.mjs";

const DEFAULT_PROVIDER_IDS = Object.freeze(["openalex", "crossref", "arxiv", "europe-pmc"]);
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_MAX_RESULTS = 8;
const CREDENTIAL_FIELD = /(?:api[-_]?key|token|secret|password|authorization|bearer|credential|headers?)/iu;

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanValue(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (["1", "true", "yes", "on"].includes(value.trim().toLowerCase())) return true;
    if (["0", "false", "no", "off"].includes(value.trim().toLowerCase())) return false;
  }
  return fallback;
}

function boundedInteger(value, fallback, min, max) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, Math.trunc(numeric))) : fallback;
}

function stringArray(value) {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(items.map(normalizedString).filter(Boolean).map((item) => item.toLowerCase()))];
}

function assertNoCredentials(value, label = "networkSearch") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoCredentials(item, `${label}[${index}]`));
    return;
  }
  if (!plainObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (CREDENTIAL_FIELD.test(key)) throw new Error(`Dove networkSearch supports only public no-key providers and must not contain credential field ${label}.${key}.`);
    assertNoCredentials(item, `${label}.${key}`);
  }
}

function providerIds(value, fallback) {
  const values = stringArray(value);
  return values.length > 0 ? values : [...fallback];
}

export function normalizeNetworkSearchConfig(rawConfig = {}) {
  const source = plainObject(rawConfig) ? rawConfig : {};
  assertNoCredentials(source);
  const rawSettings = plainObject(source.providerSettings) ? source.providerSettings : {};
  const providerSettings = {};
  for (const [rawId, rawValue] of Object.entries(rawSettings)) {
    const id = normalizedString(rawId)?.toLowerCase();
    if (!id) continue;
    const item = plainObject(rawValue) ? rawValue : {};
    providerSettings[id] = {
      ...(item.enabled === undefined ? {} : { enabled: booleanValue(item.enabled, true) }),
      ...(item.timeoutMs === undefined ? {} : { timeoutMs: boundedInteger(item.timeoutMs, DEFAULT_TIMEOUT_MS, 1000, 60000) })
    };
  }
  return {
    enabled: booleanValue(source.enabled, true),
    defaultProviderIds: providerIds(source.defaultProviderIds, DEFAULT_PROVIDER_IDS),
    disabledProviderIds: providerIds(source.disabledProviderIds, []),
    providerSettings,
    timeoutMs: boundedInteger(source.timeoutMs, DEFAULT_TIMEOUT_MS, 1000, 60000),
    maxResults: boundedInteger(source.maxResults, DEFAULT_MAX_RESULTS, 1, 50)
  };
}

function configPaths(root, env) {
  const paths = [];
  const xdg = normalizedString(env.XDG_CONFIG_HOME) ?? path.join(os.homedir(), ".config");
  paths.push(path.join(xdg, "dove", "config.json"));
  if (root) {
    paths.push(path.resolve(root, ".dove", "config.json"));
    paths.push(path.resolve(root, ".dove", "config.local.json"));
  }
  return paths;
}

function readConfig(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!plainObject(value)) throw new Error("top level must be an object");
    return value;
  } catch (error) {
    throw new Error(`Failed to read Dove config ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function merge(left, right) {
  const output = { ...left };
  for (const [key, value] of Object.entries(right ?? {})) {
    output[key] = plainObject(output[key]) && plainObject(value) ? merge(output[key], value) : structuredClone(value);
  }
  return output;
}

export function loadDoveConfig(root, env = process.env) {
  let source = {};
  for (const filePath of configPaths(root, env)) {
    const value = readConfig(filePath);
    if (value) source = merge(source, value);
  }
  const environmentLanguage = normalizedString(env.DOVE_LANGUAGE ?? env.DOVE_RESPONSE_LANGUAGE);
  return {
    version: 1,
    language: normalizeDoveResponseLanguage(environmentLanguage ?? source.language ?? source.responseLanguage, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true }),
    networkSearch: normalizeNetworkSearchConfig(source.networkSearch)
  };
}

export function loadNetworkSearchConfig(root, env = process.env) {
  return loadDoveConfig(root, env).networkSearch;
}

export function loadExplicitDoveLanguageConfig(root, env = process.env) {
  let language = null;
  for (const filePath of configPaths(root, env)) {
    const value = readConfig(filePath);
    if (value && (value.language !== undefined || value.responseLanguage !== undefined)) language = value.language ?? value.responseLanguage;
  }
  language = normalizedString(env.DOVE_LANGUAGE ?? env.DOVE_RESPONSE_LANGUAGE) ?? language;
  return language ? normalizeDoveResponseLanguage(language, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true }) : null;
}

export function loadDoveLanguageConfig(root, env = process.env) {
  return loadDoveConfig(root, env).language;
}

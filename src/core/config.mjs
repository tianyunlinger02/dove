import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DEFAULT_DOVE_RESPONSE_LANGUAGE, normalizeDoveResponseLanguage } from "./schema.mjs";

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
  const environmentLanguage = normalizedString(env.DOVE_LANGUAGE);
  return {
    version: 1,
    language: normalizeDoveResponseLanguage(environmentLanguage ?? source.language, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true })
  };
}

export function loadExplicitDoveLanguageConfig(root, env = process.env) {
  let language = null;
  for (const filePath of configPaths(root, env)) {
    const value = readConfig(filePath);
    if (value && value.language !== undefined) language = value.language;
  }
  language = normalizedString(env.DOVE_LANGUAGE) ?? language;
  return language ? normalizeDoveResponseLanguage(language, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true }) : null;
}

export function loadDoveLanguageConfig(root, env = process.env) {
  return loadDoveConfig(root, env).language;
}

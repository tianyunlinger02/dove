import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DEFAULT_DOVE_RESPONSE_LANGUAGE, normalizeDoveResponseLanguage } from "./schema.mjs";

const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_MAX_PROMPT_CHARS = 20000;
const DEFAULT_MAX_SVG_BYTES = 1000000;
const SECRET_KEY_PATTERN = /(?:api[-_]?key|token|secret|password|authorization|bearer)/i;
const INLINE_BEARER_VALUE_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/i;
const ENV_REF_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

const DEFAULT_DOVE_CONFIG = {
  version: 1,
  language: DEFAULT_DOVE_RESPONSE_LANGUAGE,
  figureGeneration: {
    defaultProviderId: null,
    providers: [],
    maxPromptChars: DEFAULT_MAX_PROMPT_CHARS,
    maxSvgBytes: DEFAULT_MAX_SVG_BYTES
  }
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return structuredClone(value);
}

function normalizePositiveInteger(value, fallback, min, max) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

function normalizeString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeEnvRef(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }
  if (!ENV_REF_PATTERN.test(normalized)) {
    throw new Error(`Dove config env secret reference must be an environment variable name: ${normalized}`);
  }
  return normalized;
}

function isAllowedSecretReference(key) {
  return /Env$/.test(key) || /EnvVar$/.test(key);
}

export function assertNoInlineSecrets(value, configPath = "config") {
  if (typeof value === "string") {
    if (INLINE_BEARER_VALUE_PATTERN.test(value)) {
      throw new Error(`Dove config must not contain inline bearer credentials at ${configPath}; use an env-var reference instead.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoInlineSecrets(item, `${configPath}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    const nextPath = `${configPath}.${key}`;
    if (SECRET_KEY_PATTERN.test(key) && !isAllowedSecretReference(key)) {
      throw new Error(`Dove config must not contain inline secret field ${nextPath}; use an env-var reference such as apiKeyEnv instead.`);
    }
    assertNoInlineSecrets(item, nextPath);
  }
}

function readOptionalJsonFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read Dove config ${filePath}: ${message}`);
  }
}

function mergeConfig(base, override) {
  if (!isPlainObject(override)) {
    return clone(base);
  }
  const next = clone(base);
  for (const [key, value] of Object.entries(override)) {
    if (Array.isArray(value)) {
      next[key] = clone(value);
      continue;
    }
    if (isPlainObject(value) && isPlainObject(next[key])) {
      next[key] = mergeConfig(next[key], value);
      continue;
    }
    next[key] = clone(value);
  }
  return next;
}

function configPaths(root, env) {
  const paths = [];
  if (normalizeString(env.DOVE_CONFIG_PATH)) {
    paths.push(path.resolve(env.DOVE_CONFIG_PATH));
  }
  if (normalizeString(env.XDG_CONFIG_HOME)) {
    paths.push(path.join(env.XDG_CONFIG_HOME, "dove", "config.json"));
  }
  paths.push(path.join(os.homedir(), ".config", "dove", "config.json"));
  paths.push(path.join(root, ".dove", "config.json"));
  paths.push(path.join(root, ".dove", "config.local.json"));
  return Array.from(new Set(paths));
}

function envConfig(env) {
  const language = normalizeString(env.DOVE_LANGUAGE ?? env.DOVE_RESPONSE_LANGUAGE);
  const providerId = normalizeString(env.DOVE_FIGURE_PROVIDER_ID ?? env.DOVE_FIGURE_PROVIDER);
  const providerType = normalizeString(env.DOVE_FIGURE_PROVIDER_TYPE);
  const endpoint = normalizeString(env.DOVE_FIGURE_ENDPOINT);
  const command = normalizeString(env.DOVE_FIGURE_COMMAND);
  const model = normalizeString(env.DOVE_FIGURE_MODEL);
  const apiKeyEnv = normalizeString(env.DOVE_FIGURE_API_KEY_ENV);
  const hasProviderOverride = Boolean(providerId || providerType || endpoint || command || model || apiKeyEnv);
  const figureGeneration = {};
  const next = {};

  if (language) {
    next.language = language;
  }
  if (providerId) {
    figureGeneration.defaultProviderId = providerId;
  }
  if (env.DOVE_FIGURE_MAX_PROMPT_CHARS) {
    figureGeneration.maxPromptChars = env.DOVE_FIGURE_MAX_PROMPT_CHARS;
  }
  if (env.DOVE_FIGURE_MAX_SVG_BYTES) {
    figureGeneration.maxSvgBytes = env.DOVE_FIGURE_MAX_SVG_BYTES;
  }
  if (hasProviderOverride) {
    const id = providerId ?? "env-figure-provider";
    figureGeneration.defaultProviderId = id;
    figureGeneration.providers = [{
      id,
      type: providerType ?? (endpoint ? "http-json" : "external-command"),
      endpoint,
      command,
      model,
      apiKeyEnv,
      timeoutMs: env.DOVE_FIGURE_TIMEOUT_MS,
      maxPromptChars: env.DOVE_FIGURE_MAX_PROMPT_CHARS,
      maxSvgBytes: env.DOVE_FIGURE_MAX_SVG_BYTES
    }];
  }
  if (Object.keys(figureGeneration).length > 0) {
    next.figureGeneration = figureGeneration;
  }

  return Object.keys(next).length > 0 ? next : null;
}

function normalizeProvider(rawProvider) {
  if (!isPlainObject(rawProvider)) {
    throw new Error("Dove figure provider config entries must be objects.");
  }
  assertNoInlineSecrets(rawProvider, "figureGeneration.providers[]");
  const id = normalizeString(rawProvider.id);
  if (!id) {
    throw new Error("Dove figure provider config requires a non-empty id.");
  }
  const type = normalizeString(rawProvider.type) ?? (rawProvider.endpoint ? "http-json" : "external-command");
  if (!["http-json", "external-command"].includes(type)) {
    throw new Error(`Unsupported Dove figure provider type: ${type}`);
  }
  const provider = {
    id,
    type,
    timeoutMs: normalizePositiveInteger(rawProvider.timeoutMs, DEFAULT_TIMEOUT_MS, 1000, 600000),
    maxPromptChars: normalizePositiveInteger(rawProvider.maxPromptChars, DEFAULT_MAX_PROMPT_CHARS, 1000, 200000),
    maxSvgBytes: normalizePositiveInteger(rawProvider.maxSvgBytes, DEFAULT_MAX_SVG_BYTES, 1000, 10000000)
  };
  const model = normalizeString(rawProvider.model);
  if (model) {
    provider.model = model;
  }
  const endpoint = normalizeString(rawProvider.endpoint);
  if (endpoint) {
    provider.endpoint = endpoint;
  }
  const command = normalizeString(rawProvider.command);
  if (command) {
    provider.command = command;
  }
  const apiKeyEnv = normalizeEnvRef(rawProvider.apiKeyEnv);
  if (apiKeyEnv) {
    provider.apiKeyEnv = apiKeyEnv;
  }
  if (type === "http-json" && !provider.endpoint) {
    throw new Error(`Dove figure provider ${id} uses http-json but has no endpoint.`);
  }
  if (type === "external-command" && !provider.command) {
    throw new Error(`Dove figure provider ${id} uses external-command but has no command.`);
  }
  return provider;
}

function normalizeFigureGenerationConfig(rawConfig = {}) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  assertNoInlineSecrets(source, "figureGeneration");
  const providers = Array.isArray(source.providers) ? source.providers.map(normalizeProvider) : [];
  const defaultProviderId = normalizeString(source.defaultProviderId) ?? providers[0]?.id ?? null;
  if (defaultProviderId && !providers.some((provider) => provider.id === defaultProviderId)) {
    throw new Error(`Dove figureGeneration.defaultProviderId references unknown provider: ${defaultProviderId}`);
  }
  return {
    defaultProviderId,
    providers,
    maxPromptChars: normalizePositiveInteger(source.maxPromptChars, DEFAULT_MAX_PROMPT_CHARS, 1000, 200000),
    maxSvgBytes: normalizePositiveInteger(source.maxSvgBytes, DEFAULT_MAX_SVG_BYTES, 1000, 10000000)
  };
}

function normalizeDoveConfig(rawConfig) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  assertNoInlineSecrets(source, "doveConfig");
  return {
    version: 1,
    language: normalizeDoveResponseLanguage(source.language ?? source.responseLanguage, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true }),
    figureGeneration: normalizeFigureGenerationConfig(source.figureGeneration)
  };
}

export function loadDoveConfig(root, env = process.env) {
  let config = clone(DEFAULT_DOVE_CONFIG);
  for (const configPath of configPaths(root, env)) {
    const fileConfig = readOptionalJsonFile(configPath);
    if (fileConfig) {
      assertNoInlineSecrets(fileConfig, configPath);
      config = mergeConfig(config, fileConfig);
    }
  }
  const environmentConfig = envConfig(env);
  if (environmentConfig) {
    config = mergeConfig(config, environmentConfig);
  }
  return normalizeDoveConfig(config);
}

export function loadFigureGenerationConfig(root, env = process.env) {
  return loadDoveConfig(root, env).figureGeneration;
}

export function loadExplicitDoveLanguageConfig(root, env = process.env) {
  let language = null;
  for (const configPath of configPaths(root, env)) {
    const fileConfig = readOptionalJsonFile(configPath);
    if (isPlainObject(fileConfig) && (fileConfig.language !== undefined || fileConfig.responseLanguage !== undefined)) {
      language = fileConfig.language ?? fileConfig.responseLanguage;
    }
  }
  const environmentLanguage = normalizeString(env.DOVE_LANGUAGE ?? env.DOVE_RESPONSE_LANGUAGE);
  if (environmentLanguage) {
    language = environmentLanguage;
  }
  return language ? normalizeDoveResponseLanguage(language, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true }) : null;
}

export function loadDoveLanguageConfig(root, env = process.env) {
  return loadDoveConfig(root, env).language;
}

export function redactDoveConfig(config) {
  if (typeof config === "string") {
    return config.replace(INLINE_BEARER_VALUE_PATTERN, "Bearer <redacted>");
  }
  if (Array.isArray(config)) {
    return config.map((item) => redactDoveConfig(item));
  }
  if (!isPlainObject(config)) {
    return config;
  }
  const redacted = {};
  for (const [key, value] of Object.entries(config)) {
    if (SECRET_KEY_PATTERN.test(key) && !isAllowedSecretReference(key)) {
      redacted[key] = "<redacted>";
      continue;
    }
    redacted[key] = redactDoveConfig(value);
  }
  return redacted;
}

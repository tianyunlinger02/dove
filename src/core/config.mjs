import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DEFAULT_DOVE_RESPONSE_LANGUAGE, normalizeDoveResponseLanguage } from "./schema.mjs";

const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_MAX_PROMPT_CHARS = 20000;
const DEFAULT_MAX_SVG_BYTES = 1000000;
const DEFAULT_GLOBAL_STATUS_ORIGIN_PORT = 8787;
const GPT_IMAGE2_PROVIDER_ID = "gpt-image2";
const GPT_IMAGE2_MODEL = "gpt-image-2";
const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";
const SECRET_KEY_PATTERN = /(?:api[-_]?key|token|secret|password|authorization|bearer)/i;
const INLINE_BEARER_VALUE_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/i;
const ENV_REF_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const HOSTNAME_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const TUNNEL_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

const DEFAULT_DOVE_CONFIG = {
  version: 1,
  language: DEFAULT_DOVE_RESPONSE_LANGUAGE,
  figureGeneration: {
    defaultProviderId: null,
    providers: [],
    maxPromptChars: DEFAULT_MAX_PROMPT_CHARS,
    maxSvgBytes: DEFAULT_MAX_SVG_BYTES
  },
  globalStatus: {
    outputDir: null,
    projects: [],
    auth: {
      enabled: false,
      username: "dove",
      password: null,
      passwordEnv: null
    },
    cloudflare: {
      enabled: false,
      domain: null,
      tunnelName: null,
      cloudflaredPath: "cloudflared",
      originHost: "127.0.0.1",
      originPort: DEFAULT_GLOBAL_STATUS_ORIGIN_PORT,
      configPath: null,
      credentialsFile: null,
      tokenEnv: null,
      dnsResolverAddrs: []
    }
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

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function normalizeString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isGptImage2Identifier(value) {
  const normalized = normalizeString(value)?.toLowerCase().replace(/[-_]/g, "") ?? null;
  return normalized === "gptimage2";
}

function inferFigureProviderType(providerType, providerId, endpoint, command, model) {
  const explicitType = normalizeString(providerType);
  if (explicitType) {
    return explicitType;
  }
  if (isGptImage2Identifier(providerId) || isGptImage2Identifier(model)) {
    return "openai-image";
  }
  return endpoint ? "http-json" : command ? "external-command" : "external-command";
}

function expandHomePath(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }
  if (normalized === "~") {
    return os.homedir();
  }
  if (normalized.startsWith("~/")) {
    return path.join(os.homedir(), normalized.slice(2));
  }
  return normalized;
}

function resolveAbsolutePath(value) {
  const expanded = expandHomePath(value);
  return expanded ? path.resolve(expanded) : null;
}

export function resolveDoveGlobalStatusOutputDir(value = null, env = process.env) {
  const explicit = resolveAbsolutePath(value);
  if (explicit) {
    return explicit;
  }
  const xdgDataHome = resolveAbsolutePath(env.XDG_DATA_HOME);
  return path.join(xdgDataHome ?? path.join(os.homedir(), ".local", "share"), "dove", "public");
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

function isAllowedInlineSecretPath(configPath) {
  return configPath === "globalStatus.auth.password" || configPath.endsWith(".globalStatus.auth.password");
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
    if (SECRET_KEY_PATTERN.test(key) && !isAllowedSecretReference(key) && !isAllowedInlineSecretPath(nextPath)) {
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
  if (normalizeString(env.DOVE_CONFIG_PATH)) {
    return [path.resolve(env.DOVE_CONFIG_PATH)];
  }
  const paths = [];
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
    const id = providerId ?? (isGptImage2Identifier(model) ? GPT_IMAGE2_PROVIDER_ID : "env-figure-provider");
    const type = inferFigureProviderType(providerType, id, endpoint, command, model);
    figureGeneration.defaultProviderId = id;
    figureGeneration.providers = [{
      id,
      type,
      endpoint,
      command,
      model: model ?? (type === "openai-image" ? GPT_IMAGE2_MODEL : null),
      apiKeyEnv: apiKeyEnv ?? (type === "openai-image" ? "OPENAI_API_KEY" : null),
      imageSize: env.DOVE_FIGURE_IMAGE_SIZE,
      imageQuality: env.DOVE_FIGURE_IMAGE_QUALITY,
      imageBackground: env.DOVE_FIGURE_IMAGE_BACKGROUND,
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
  const type = inferFigureProviderType(rawProvider.type, id, rawProvider.endpoint, rawProvider.command, rawProvider.model);
  if (!["http-json", "external-command", "openai-image"].includes(type)) {
    throw new Error(`Unsupported Dove figure provider type: ${type}`);
  }
  const provider = {
    id,
    type,
    timeoutMs: normalizePositiveInteger(rawProvider.timeoutMs, DEFAULT_TIMEOUT_MS, 1000, 600000),
    maxPromptChars: normalizePositiveInteger(rawProvider.maxPromptChars, DEFAULT_MAX_PROMPT_CHARS, 1000, 200000),
    maxSvgBytes: normalizePositiveInteger(rawProvider.maxSvgBytes, DEFAULT_MAX_SVG_BYTES, 1000, 10000000)
  };
  const model = normalizeString(rawProvider.model) ?? (type === "openai-image" ? GPT_IMAGE2_MODEL : null);
  if (model) {
    provider.model = model;
  }
  const endpoint = normalizeString(rawProvider.endpoint) ?? (type === "openai-image" ? OPENAI_IMAGE_ENDPOINT : null);
  if (endpoint) {
    provider.endpoint = endpoint;
  }
  const command = normalizeString(rawProvider.command);
  if (command) {
    provider.command = command;
  }
  const apiKeyEnv = normalizeEnvRef(rawProvider.apiKeyEnv ?? (type === "openai-image" ? "OPENAI_API_KEY" : null));
  if (apiKeyEnv) {
    provider.apiKeyEnv = apiKeyEnv;
  }
  const imageSize = normalizeString(rawProvider.imageSize ?? rawProvider.size);
  if (imageSize) {
    provider.imageSize = imageSize;
  }
  const imageQuality = normalizeString(rawProvider.imageQuality ?? rawProvider.quality);
  if (imageQuality) {
    provider.imageQuality = imageQuality;
  }
  const imageBackground = normalizeString(rawProvider.imageBackground ?? rawProvider.background);
  if (imageBackground) {
    provider.imageBackground = imageBackground;
  }
  if ((type === "http-json" || type === "openai-image") && !provider.endpoint) {
    throw new Error(`Dove figure provider ${id} uses ${type} but has no endpoint.`);
  }
  if (type === "external-command" && !provider.command) {
    throw new Error(`Dove figure provider ${id} uses external-command but has no command.`);
  }
  return provider;
}

export function createGptImage2FigureProvider(overrides = {}) {
  const source = isPlainObject(overrides) ? overrides : {};
  return normalizeProvider({
    id: GPT_IMAGE2_PROVIDER_ID,
    type: "openai-image",
    endpoint: OPENAI_IMAGE_ENDPOINT,
    model: GPT_IMAGE2_MODEL,
    apiKeyEnv: "OPENAI_API_KEY",
    imageSize: "1024x1024",
    ...source
  });
}

function normalizeFigureGenerationConfig(rawConfig = {}) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  assertNoInlineSecrets(source, "figureGeneration");
  const hasExplicitProviders = Array.isArray(source.providers);
  const providers = hasExplicitProviders ? source.providers.map(normalizeProvider) : [];
  const defaultProviderId = normalizeString(source.defaultProviderId) ?? (hasExplicitProviders ? providers[0]?.id : null) ?? null;
  if (defaultProviderId && !providers.some((provider) => provider.id === defaultProviderId) && !isGptImage2Identifier(defaultProviderId)) {
    throw new Error(`Dove figureGeneration.defaultProviderId references unknown provider: ${defaultProviderId}`);
  }
  return {
    defaultProviderId,
    providers,
    maxPromptChars: normalizePositiveInteger(source.maxPromptChars, DEFAULT_MAX_PROMPT_CHARS, 1000, 200000),
    maxSvgBytes: normalizePositiveInteger(source.maxSvgBytes, DEFAULT_MAX_SVG_BYTES, 1000, 10000000)
  };
}

function normalizeGlobalStatusProject(rawProject) {
  const source = typeof rawProject === "string" ? { root: rawProject } : rawProject;
  if (!isPlainObject(source)) {
    return null;
  }
  if (source.enabled === false) {
    return null;
  }
  const root = resolveAbsolutePath(source.root ?? source.path ?? source.workspace ?? source.workspaceRoot);
  if (!root) {
    return null;
  }
  return {
    root,
    id: normalizeString(source.id),
    slug: normalizeString(source.slug),
    title: normalizeString(source.title ?? source.name),
    enabled: true
  };
}

export function normalizeGlobalStatusProjects(rawProjects = []) {
  const projects = Array.isArray(rawProjects) ? rawProjects : [];
  const byRoot = new Map();
  for (const rawProject of projects) {
    const project = normalizeGlobalStatusProject(rawProject);
    if (!project) {
      continue;
    }
    byRoot.set(project.root, project);
  }
  return Array.from(byRoot.values());
}

function normalizeHostname(value, label) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized) || normalized.includes("/") || normalized.includes(":")) {
    throw new Error(`Dove global status Cloudflare ${label} must be a bare hostname: ${normalized}`);
  }
  const hostname = normalized.toLowerCase();
  if (hostname.length > 253 || hostname.startsWith(".") || hostname.endsWith(".")) {
    throw new Error(`Dove global status Cloudflare ${label} must be a valid hostname: ${normalized}`);
  }
  const labels = hostname.split(".");
  if (labels.length < 2 || !labels.every((item) => HOSTNAME_LABEL_PATTERN.test(item))) {
    throw new Error(`Dove global status Cloudflare ${label} must be a valid hostname: ${normalized}`);
  }
  return hostname;
}

function normalizeLoopbackHost(value) {
  const normalized = normalizeString(value) ?? "127.0.0.1";
  if (!LOOPBACK_HOSTS.has(normalized)) {
    throw new Error(`Dove global status serving host must be loopback-only: ${normalized}`);
  }
  return normalized;
}

function normalizeTunnelName(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }
  if (!TUNNEL_NAME_PATTERN.test(normalized)) {
    throw new Error(`Dove global status Cloudflare tunnelName must contain only letters, digits, dots, dashes, or underscores: ${normalized}`);
  }
  return normalized;
}

function normalizeDnsResolverAddrs(value) {
  const rawItems = Array.isArray(value) ? value : (value === undefined || value === null ? [] : [value]);
  const items = rawItems.map(normalizeString).filter(Boolean);
  for (const item of items) {
    if (!item.includes(":") || item.includes("://") || item.includes("/") || /\s/.test(item)) {
      throw new Error(`Dove global status Cloudflare dnsResolverAddrs entries must be address:port values: ${item}`);
    }
  }
  return Array.from(new Set(items));
}

function isPathInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertOutsidePublicDir(filePath, outputDir, label) {
  if (!filePath || !outputDir) {
    return;
  }
  if (isPathInside(filePath, outputDir)) {
    throw new Error(`Dove global status Cloudflare ${label} must not be inside the public output directory.`);
  }
}

export function normalizeGlobalStatusCloudflareConfig(rawConfig = {}, rawGlobalStatus = {}, outputDir = null) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  assertNoInlineSecrets(source, "globalStatus.cloudflare");
  const enabled = normalizeBoolean(source.enabled ?? rawGlobalStatus.cloudflareEnabled, false);
  const domain = normalizeHostname(source.domain ?? source.hostname ?? rawGlobalStatus.cloudflareDomain ?? rawGlobalStatus.cloudflareHostname, "domain");
  const tunnelName = normalizeTunnelName(source.tunnelName ?? rawGlobalStatus.cloudflareTunnelName);
  const cloudflaredPath = normalizeString(source.cloudflaredPath ?? source.command ?? rawGlobalStatus.cloudflaredPath) ?? "cloudflared";
  const originHost = normalizeLoopbackHost(source.originHost ?? source.host ?? rawGlobalStatus.cloudflareOriginHost);
  const originPort = normalizePositiveInteger(source.originPort ?? source.port ?? rawGlobalStatus.cloudflareOriginPort, DEFAULT_GLOBAL_STATUS_ORIGIN_PORT, 1, 65535);
  const configPath = resolveAbsolutePath(source.configPath ?? source.configFile ?? rawGlobalStatus.cloudflareConfigPath);
  const credentialsFile = resolveAbsolutePath(source.credentialsFile ?? rawGlobalStatus.cloudflareCredentialsFile);
  const tokenEnv = normalizeEnvRef(source.tokenEnv ?? rawGlobalStatus.cloudflareTokenEnv);
  const dnsResolverAddrs = normalizeDnsResolverAddrs(source.dnsResolverAddrs ?? rawGlobalStatus.cloudflareDnsResolverAddrs);

  assertOutsidePublicDir(configPath, outputDir, "configPath");
  assertOutsidePublicDir(credentialsFile, outputDir, "credentialsFile");

  return {
    enabled,
    domain,
    tunnelName,
    cloudflaredPath,
    originHost,
    originPort,
    configPath,
    credentialsFile,
    tokenEnv,
    dnsResolverAddrs
  };
}

export function normalizeGlobalStatusAuthConfig(rawConfig = {}, rawGlobalStatus = {}) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  assertNoInlineSecrets(source, "globalStatus.auth");
  return {
    enabled: normalizeBoolean(source.enabled ?? rawGlobalStatus.authEnabled, false),
    username: normalizeString(source.username ?? source.user ?? rawGlobalStatus.authUsername ?? rawGlobalStatus.authUser) ?? "dove",
    password: normalizeString(source.password ?? rawGlobalStatus.authPassword),
    passwordEnv: normalizeEnvRef(source.passwordEnv ?? source.passwordEnvVar ?? rawGlobalStatus.authPasswordEnv ?? rawGlobalStatus.authPasswordEnvVar)
  };
}

function normalizeGlobalStatusConfig(rawConfig = {}) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  assertNoInlineSecrets(source, "globalStatus");
  const outputDir = resolveAbsolutePath(source.outputDir ?? source.publicDir ?? source.directory);
  return {
    outputDir,
    projects: normalizeGlobalStatusProjects(source.projects),
    auth: normalizeGlobalStatusAuthConfig(source.auth, source),
    cloudflare: normalizeGlobalStatusCloudflareConfig(source.cloudflare, source, outputDir)
  };
}

function normalizeDoveConfig(rawConfig) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  assertNoInlineSecrets(source, "doveConfig");
  const publicStatusSource = isPlainObject(source.publicStatus) ? source.publicStatus : {};
  const globalStatusSource = isPlainObject(source.globalStatus) ? source.globalStatus : {};
  const globalStatusOutputDir = globalStatusSource.outputDir ?? globalStatusSource.publicDir ?? globalStatusSource.directory
    ?? publicStatusSource.outputDir ?? publicStatusSource.publicDir ?? publicStatusSource.directory;
  const globalStatusProjects = Array.isArray(globalStatusSource.projects) && globalStatusSource.projects.length > 0
    ? globalStatusSource.projects
    : publicStatusSource.projects;
  return {
    version: 1,
    language: normalizeDoveResponseLanguage(source.language ?? source.responseLanguage, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true }),
    figureGeneration: normalizeFigureGenerationConfig(source.figureGeneration),
    globalStatus: normalizeGlobalStatusConfig({
      ...globalStatusSource,
      outputDir: globalStatusOutputDir,
      projects: globalStatusProjects
    })
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

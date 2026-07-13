import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { resolveCanonicalContainedWrite } from "./contained-write.mjs";

export const CLAUDE_CODE_GATEWAY_ENV_DEFAULTS = Object.freeze({
  CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
  CLAUDE_CODE_MAX_CONTEXT_TOKENS: "220000",
  CLAUDE_CODE_AUTO_COMPACT_WINDOW: "220000",
  CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "70",
  CLAUDE_CODE_MAX_OUTPUT_TOKENS: "64000",
  CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS: "1",
  CLAUDE_CODE_ENABLE_OPUS_4_7_FAST_MODE: "1"
});

export const CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START = "# >>> dove claude-code gateway defaults >>>";
export const CLAUDE_CODE_GATEWAY_SHELL_BLOCK_END = "# <<< dove claude-code gateway defaults <<<";

const EARLY_RETURN_PATTERN = /^\s*\[\s*-z\s+"\$PS1"\s*\]\s*&&\s*return\s*$/mu;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readJsonObject(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!isPlainObject(parsed)) {
    throw new Error(`${path.basename(filePath)} must contain a JSON object.`);
  }
  return parsed;
}

function renderSettings(settings) {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

export function resolveClaudeConfigRoot(env = process.env) {
  return path.resolve(env.DOVE_CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"));
}

export function resolveClaudeShellStartupFile(env = process.env) {
  return path.resolve(env.DOVE_CLAUDE_SHELL_RC || path.join(os.homedir(), ".bashrc"));
}

export function renderClaudeCodeGatewayShellBlock(envDefaults = CLAUDE_CODE_GATEWAY_ENV_DEFAULTS) {
  return [
    CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START,
    "# Managed by Dove. Non-secret Claude Code compatibility settings only.",
    ...Object.entries(envDefaults).map(([key, value]) => `export ${key}=${JSON.stringify(value)}`),
    CLAUDE_CODE_GATEWAY_SHELL_BLOCK_END
  ].join("\n");
}

function removeManagedShellBlock(content) {
  const blockPattern = new RegExp(`${escapeRegExp(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START)}[\\s\\S]*?${escapeRegExp(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_END)}\\n?`, "u");
  return String(content ?? "").replace(blockPattern, "").replace(/\n{3,}/gu, "\n\n");
}

function insertShellBlock(content, block) {
  const stripped = removeManagedShellBlock(content);
  const earlyReturn = EARLY_RETURN_PATTERN.exec(stripped);
  if (earlyReturn) {
    const prefix = stripped.slice(0, earlyReturn.index).replace(/\n*$/u, "\n");
    const suffix = stripped.slice(earlyReturn.index).replace(/^\n*/u, "");
    return `${prefix}${block}\n\n${suffix}`;
  }
  const prefix = stripped.replace(/\n*$/u, "");
  return `${prefix}${prefix ? "\n\n" : ""}${block}\n`;
}

function extractManagedShellBlock(content) {
  const start = String(content ?? "").indexOf(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START);
  const end = String(content ?? "").indexOf(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_END);
  if (start === -1 || end === -1 || end < start) {
    return "";
  }
  return String(content).slice(start, end + CLAUDE_CODE_GATEWAY_SHELL_BLOCK_END.length);
}

function inspectSettings(settingsPath, envDefaults = CLAUDE_CODE_GATEWAY_ENV_DEFAULTS) {
  if (!fs.existsSync(settingsPath)) {
    return {
      ok: false,
      exists: false,
      fastMode: false,
      ensuredEnvKeys: Object.keys(envDefaults),
      missingEnvKeys: Object.keys(envDefaults),
      mismatchedEnvKeys: [],
      message: "Claude Code settings are missing; run dove sync . --host claude."
    };
  }
  try {
    const settings = readJsonObject(settingsPath);
    const env = isPlainObject(settings.env) ? settings.env : {};
    const missingEnvKeys = Object.keys(envDefaults).filter((key) => !(key in env));
    const mismatchedEnvKeys = Object.entries(envDefaults).filter(([key, value]) => key in env && String(env[key]) !== value).map(([key]) => key);
    const fastMode = settings.fastMode === true;
    const ok = fastMode && missingEnvKeys.length === 0 && mismatchedEnvKeys.length === 0;
    return {
      ok,
      exists: true,
      fastMode,
      ensuredEnvKeys: Object.keys(envDefaults),
      missingEnvKeys,
      mismatchedEnvKeys,
      message: ok ? "Claude Code settings are configured." : "Claude Code settings need Dove gateway defaults; run dove sync . --host claude."
    };
  } catch (error) {
    return {
      ok: false,
      exists: true,
      fastMode: false,
      ensuredEnvKeys: Object.keys(envDefaults),
      missingEnvKeys: Object.keys(envDefaults),
      mismatchedEnvKeys: [],
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function inspectShellStartup(shellStartupFile, envDefaults = CLAUDE_CODE_GATEWAY_ENV_DEFAULTS) {
  if (!fs.existsSync(shellStartupFile)) {
    return {
      ok: false,
      exists: false,
      hasManagedBlock: false,
      beforeEarlyReturn: false,
      ensuredEnvKeys: Object.keys(envDefaults),
      missingEnvKeys: Object.keys(envDefaults),
      message: "Claude Code shell startup defaults are missing; run dove sync . --host claude."
    };
  }
  const content = fs.readFileSync(shellStartupFile, "utf8");
  const block = extractManagedShellBlock(content);
  const earlyReturn = EARLY_RETURN_PATTERN.exec(content);
  const blockIndex = content.indexOf(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START);
  const beforeEarlyReturn = Boolean(block) && (earlyReturn === null || blockIndex < earlyReturn.index);
  const missingEnvKeys = Object.entries(envDefaults)
    .filter(([key, value]) => !block.includes(`export ${key}=${JSON.stringify(value)}`))
    .map(([key]) => key);
  const ok = Boolean(block) && beforeEarlyReturn && missingEnvKeys.length === 0;
  return {
    ok,
    exists: true,
    hasManagedBlock: Boolean(block),
    beforeEarlyReturn,
    ensuredEnvKeys: Object.keys(envDefaults),
    missingEnvKeys,
    message: ok ? "Claude Code shell startup defaults are configured." : "Claude Code shell startup defaults need refresh; run dove sync . --host claude."
  };
}

export function configureClaudeCodeGatewayDefaults(options = {}) {
  const claudeConfigRoot = path.resolve(options.claudeConfigRoot ?? resolveClaudeConfigRoot());
  const shellStartupFile = path.resolve(options.shellStartupFile ?? resolveClaudeShellStartupFile());
  const envDefaults = options.envDefaults ?? CLAUDE_CODE_GATEWAY_ENV_DEFAULTS;
  fs.mkdirSync(claudeConfigRoot, { recursive: true });
  const { fullPath: settingsPath } = resolveCanonicalContainedWrite(claudeConfigRoot, "settings.json", { label: "Claude Code settings path" });
  const shellRoot = path.dirname(shellStartupFile);
  fs.mkdirSync(shellRoot, { recursive: true });
  const { fullPath: safeShellStartupFile } = resolveCanonicalContainedWrite(shellRoot, path.basename(shellStartupFile), { label: "Claude shell startup path" });

  const settings = readJsonObject(settingsPath);
  const env = isPlainObject(settings.env) ? { ...settings.env } : {};
  for (const [key, value] of Object.entries(envDefaults)) {
    env[key] = value;
  }
  const nextSettings = { ...settings, env, fastMode: true };
  const nextSettingsContent = renderSettings(nextSettings);
  const previousSettingsContent = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, "utf8") : "";
  const settingsWritten = previousSettingsContent !== nextSettingsContent;
  if (settingsWritten) {
    fs.writeFileSync(settingsPath, nextSettingsContent, "utf8");
  }

  const previousShellContent = fs.existsSync(safeShellStartupFile) ? fs.readFileSync(safeShellStartupFile, "utf8") : "";
  const nextShellContent = insertShellBlock(previousShellContent, renderClaudeCodeGatewayShellBlock(envDefaults));
  const shellWritten = previousShellContent !== nextShellContent;
  if (shellWritten) {
    fs.writeFileSync(safeShellStartupFile, nextShellContent, "utf8");
  }

  return {
    ok: true,
    settings: {
      ok: true,
      written: settingsWritten,
      fastMode: true,
      ensuredEnvKeys: Object.keys(envDefaults)
    },
    shell: {
      ok: true,
      written: shellWritten,
      beforeEarlyReturn: inspectShellStartup(safeShellStartupFile, envDefaults).beforeEarlyReturn,
      ensuredEnvKeys: Object.keys(envDefaults)
    },
    restartRequired: true,
    message: "Claude Code Fast mode and gateway context defaults are configured; restart Claude Code or source the shell startup file before launching from an existing shell."
  };
}

export function inspectClaudeCodeGatewayDefaults(options = {}) {
  const claudeConfigRoot = path.resolve(options.claudeConfigRoot ?? resolveClaudeConfigRoot());
  const shellStartupFile = path.resolve(options.shellStartupFile ?? resolveClaudeShellStartupFile());
  const envDefaults = options.envDefaults ?? CLAUDE_CODE_GATEWAY_ENV_DEFAULTS;
  const settings = inspectSettings(path.join(claudeConfigRoot, "settings.json"), envDefaults);
  const shell = inspectShellStartup(shellStartupFile, envDefaults);
  const issues = [settings, shell].filter((item) => !item.ok).map((item) => item.message);
  return {
    ok: settings.ok && shell.ok,
    settings,
    shell,
    issues
  };
}

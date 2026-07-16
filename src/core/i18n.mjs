import { loadDoveLanguageConfig, loadExplicitDoveLanguageConfig } from "./config.mjs";
import { DEFAULT_DOVE_RESPONSE_LANGUAGE, normalizeDoveResponseLanguage } from "./schema.mjs";

function explicitLanguage(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    const value = source.responseLanguage ?? source.language;
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export function resolveDoveResponseLanguage(root, args = {}, options = {}) {
  const requested = explicitLanguage(args, args.settings);
  if (requested) return normalizeDoveResponseLanguage(requested, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true });
  const env = options.env ?? process.env;
  const configured = options.configLanguage ?? loadExplicitDoveLanguageConfig(root, env);
  return configured ?? loadDoveLanguageConfig(root, env);
}

export function isDoveChinese(language) {
  return normalizeDoveResponseLanguage(language) === "zh";
}

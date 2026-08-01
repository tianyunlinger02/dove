import crypto from "node:crypto";

function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
}

function normalizeIdentityText(value) {
  return normalizeText(value).normalize("NFKC").toLowerCase();
}

function normalizeDoi(value) {
  const normalized = normalizeIdentityText(value).replace(/^https?:\/\/(?:dx\.)?doi\.org\//u, "");
  return normalized.startsWith("10.") ? normalized : "";
}

function normalizeUrl(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) parsed.port = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function canonicalSourceIdentity(source = {}) {
  return {
    doi: normalizeDoi(source.doi) || normalizeDoi(source.locator),
    url: normalizeUrl(source.url) || normalizeUrl(source.locator),
    locator: normalizeIdentityText(source.locator),
    title: normalizeIdentityText(source.title),
    authors: (Array.isArray(source.authors) ? source.authors : []).map(normalizeIdentityText).filter(Boolean).sort()
  };
}

export function sourceIdentityFingerprint(source = {}) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalSourceIdentity(source))).digest("hex");
}

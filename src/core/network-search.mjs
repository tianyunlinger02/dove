import { loadNetworkSearchConfig } from "./config.mjs";

const DEFAULT_KIND = "scholarly";
const SEARCH_KINDS = new Set(["scholarly", "web", "all"]);
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 50;
const DEFAULT_TIMEOUT_MS = 12000;
const MAX_QUERY_CHARS = 500;
const POST_FILTER_OVERFETCH_FACTOR = 3;
const SECRET_VALUE_PATTERN = /\b(?:Bearer\s+[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]{12,}|(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,}]+)\b/giu;

export const NETWORK_SEARCH_PROVIDER_REGISTRY = Object.freeze([
  Object.freeze({ id: "openalex", kind: "scholarly", access: "public", defaultLimit: 5, maxLimit: 25, capabilities: ["works", "doi", "open-access", "authors", "year"], filters: Object.freeze({ year: "native", domains: "post", fieldsOfStudy: "post", openAccessOnly: "post", locale: "post" }) }),
  Object.freeze({ id: "crossref", kind: "scholarly", access: "public", defaultLimit: 5, maxLimit: 20, capabilities: ["works", "doi", "open-access", "authors", "year"], filters: Object.freeze({ year: "native", domains: "post", openAccessOnly: "post", locale: "post" }) }),
  Object.freeze({ id: "arxiv", kind: "scholarly", access: "public", defaultLimit: 5, maxLimit: 20, capabilities: ["preprints", "arxiv-id", "authors", "year"], filters: Object.freeze({ year: "post", domains: "post", openAccessOnly: "post" }) }),
  Object.freeze({ id: "europe-pmc", kind: "scholarly", access: "public", defaultLimit: 5, maxLimit: 25, capabilities: ["papers", "doi", "pubmed-id", "open-access", "authors", "year"], filters: Object.freeze({ year: "post", domains: "post", openAccessOnly: "post", locale: "post" }) }),
  Object.freeze({ id: "public-web", kind: "web", access: "public", defaultLimit: 0, maxLimit: 0, unavailable: true, capabilities: ["status"], filters: Object.freeze({}) })
]);

export const DEFAULT_NETWORK_SEARCH_PROVIDER_IDS = Object.freeze(["openalex", "crossref", "arxiv", "europe-pmc"]);

const PROVIDER_BY_ID = new Map(NETWORK_SEARCH_PROVIDER_REGISTRY.map((provider) => [provider.id, provider]));

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value, fallback = null) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
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

function normalizePositiveInteger(value, fallback, min, max) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

function normalizeStringArray(value) {
  const rawItems = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return Array.from(new Set(rawItems.map((item) => normalizeString(item)).filter(Boolean)));
}

function normalizeProviderId(value) {
  return normalizeString(value)?.toLowerCase() ?? null;
}

function normalizeProviderIds(value) {
  const ids = normalizeStringArray(value).map(normalizeProviderId).filter(Boolean);
  for (const id of ids) {
    if (!PROVIDER_BY_ID.has(id)) {
      throw new Error(`Unsupported Dove network search provider: ${id}`);
    }
  }
  return ids;
}

function normalizeDomains(value) {
  const domains = normalizeStringArray(value).map((domain) => domain.toLowerCase());
  for (const domain of domains) {
    if (domain.includes("://") || domain.includes("/") || domain.length > 253 || !/^[a-z0-9.-]+$/iu.test(domain)) {
      throw new Error(`Dove network search domain filters must be bare hostnames: ${domain}`);
    }
  }
  return domains;
}

function normalizeYear(value) {
  const text = typeof value === "number" ? String(Math.trunc(value)) : normalizeString(value);
  if (!text) {
    return null;
  }
  if (!/^\d{4}(?:-\d{4})?$/u.test(text)) {
    throw new Error("Dove network search year must be YYYY or YYYY-YYYY.");
  }
  return text;
}

function normalizeLocale(value) {
  const locale = normalizeString(value);
  if (!locale) {
    return null;
  }
  if (!/^[a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?$/iu.test(locale)) {
    throw new Error(`Dove network search locale must be a compact locale code: ${locale}`);
  }
  return locale.replace("_", "-").toLowerCase();
}

function normalizeNetworkSearchConfigForCore(config = {}) {
  const source = isPlainObject(config) ? config : {};
  return {
    enabled: normalizeBoolean(source.enabled, true),
    defaultProviderIds: normalizeProviderIds(source.defaultProviderIds ?? source.defaultProviders ?? DEFAULT_NETWORK_SEARCH_PROVIDER_IDS),
    disabledProviderIds: normalizeProviderIds(source.disabledProviderIds ?? source.disabledProviders ?? []),
    providerSettings: isPlainObject(source.providerSettings) ? source.providerSettings : {},
    timeoutMs: normalizePositiveInteger(source.timeoutMs, DEFAULT_TIMEOUT_MS, 1000, 60000),
    maxResults: normalizePositiveInteger(source.maxResults ?? source.limit, DEFAULT_LIMIT, 1, MAX_LIMIT)
  };
}

export function normalizeNetworkSearchQuery(rawArgs = {}, config = {}) {
  const args = isPlainObject(rawArgs) ? rawArgs : {};
  const normalizedConfig = normalizeNetworkSearchConfigForCore(config);
  const query = normalizeString(args.query);
  if (!query) {
    throw new Error("Dove network search requires a non-empty query.");
  }
  if (query.length > MAX_QUERY_CHARS) {
    throw new Error(`Dove network search query must be ${MAX_QUERY_CHARS} characters or fewer.`);
  }
  const kind = normalizeString(args.kind, DEFAULT_KIND).toLowerCase();
  if (!SEARCH_KINDS.has(kind)) {
    throw new Error(`Dove network search kind must be one of: ${Array.from(SEARCH_KINDS).join(", ")}.`);
  }
  return {
    query,
    kind,
    limit: normalizePositiveInteger(args.limit ?? args.maxResults, normalizedConfig.maxResults, 1, Math.min(MAX_LIMIT, normalizedConfig.maxResults || MAX_LIMIT)),
    year: normalizeYear(args.year),
    domains: normalizeDomains(args.domains),
    fieldsOfStudy: normalizeStringArray(args.fieldsOfStudy),
    openAccessOnly: normalizeBoolean(args.openAccessOnly, false),
    providerIds: normalizeProviderIds(args.providerIds ?? args.providers),
    locale: normalizeLocale(args.locale)
  };
}

function redactSensitiveText(value) {
  const text = String(value ?? "");
  return text.replace(SECRET_VALUE_PATTERN, "[REDACTED]");
}

function sanitizeError(error) {
  return redactSensitiveText(error instanceof Error ? error.message : String(error)).slice(0, 500);
}

function safeUrl(value) {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function hostnameFromUrl(value) {
  const url = safeUrl(value);
  return url ? new URL(url).hostname.toLowerCase() : null;
}

function doiUrl(doi) {
  const normalized = normalizeDoi(doi);
  return normalized ? `https://doi.org/${normalized}` : null;
}

function normalizeDoi(value) {
  const text = normalizeString(value)?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "") ?? null;
  if (!text) {
    return null;
  }
  const cleaned = text.trim().toLowerCase();
  return cleaned.startsWith("10.") ? cleaned : null;
}

function normalizeTitle(value) {
  return normalizeString(Array.isArray(value) ? value[0] : value);
}

function normalizeAuthors(value) {
  if (isPlainObject(value)) {
    return normalizeAuthors(value.author ?? value.authors ?? value.fullName ?? value.name);
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") {
        return normalizeString(item);
      }
      if (isPlainObject(item)) {
        return normalizeString(item.fullName ?? item.name ?? item.display_name ?? [item.given, item.family].filter(Boolean).join(" "));
      }
      return null;
    }).filter(Boolean).slice(0, 12);
  }
  const text = normalizeString(value);
  return text ? text.split(/\s*[,;]\s*/u).map((item) => normalizeString(item)).filter(Boolean).slice(0, 12) : [];
}

function normalizePublishedAt(year, dateParts) {
  const textYear = typeof year === "number" ? String(year) : normalizeString(year);
  if (textYear && /^\d{4}/u.test(textYear)) {
    return textYear.slice(0, 10);
  }
  const parts = Array.isArray(dateParts?.[0]) ? dateParts[0] : Array.isArray(dateParts) ? dateParts : null;
  if (!parts?.[0]) {
    return null;
  }
  return parts.slice(0, 3).map((part) => String(part).padStart(2, "0")).join("-");
}

function cleanSnippet(value) {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }
  return text.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 600);
}

function decodeXml(value) {
  return String(value ?? "")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, "\"")
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function extractXmlText(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "iu"));
  return match ? decodeXml(match[1]) : null;
}

function extractAllXmlText(xml, tag) {
  return Array.from(xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "giu"))).map((match) => decodeXml(match[1])).filter(Boolean);
}

function abstractFromInvertedIndex(index) {
  if (!isPlainObject(index)) {
    return null;
  }
  const pairs = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) {
      continue;
    }
    for (const position of positions) {
      if (Number.isInteger(position)) {
        pairs[position] = word;
      }
    }
  }
  return pairs.filter(Boolean).join(" ") || null;
}

function buildParams(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    params.set(key, String(value));
  }
  return params;
}

async function fetchText(url, { timeoutMs, fetchFn, headers = {} }) {
  if (typeof fetchFn !== "function") {
    throw new Error("No fetch implementation is available for Dove network search.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "DoveNetworkSearch/1.0",
        ...headers
      }
    });
    if (!response?.ok) {
      throw new Error(`HTTP ${response?.status ?? "error"} from ${new URL(url).hostname}`);
    }
    return await response.text();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options) {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON response: ${sanitizeError(error)}`);
  }
}

const FILTER_NAMES = Object.freeze(["year", "domains", "fieldsOfStudy", "openAccessOnly", "locale"]);

const PROVIDER_FILTER_SUPPORT = Object.freeze(Object.fromEntries(NETWORK_SEARCH_PROVIDER_REGISTRY.map((provider) => [
  provider.id,
  Object.freeze(Object.fromEntries(FILTER_NAMES
    .filter((name) => provider.filters?.[name])
    .map((name) => [name, provider.filters[name]])))
])));

function requestedFilterNames(query) {
  return FILTER_NAMES.filter((name) => name === "openAccessOnly" ? query.openAccessOnly : Array.isArray(query[name]) ? query[name].length > 0 : Boolean(query[name]));
}

function providerFilterPlan(provider, query) {
  const support = PROVIDER_FILTER_SUPPORT[provider.id] ?? {};
  const requested = requestedFilterNames(query);
  return {
    appliedFilters: requested.filter((name) => Boolean(support[name])),
    unsupportedFilters: requested.filter((name) => !support[name]),
    filterModes: Object.fromEntries(requested.filter((name) => Boolean(support[name])).map((name) => [name, support[name]]))
  };
}

function normalizeComparableText(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizedLocaleBase(value) {
  return normalizeString(value)?.toLowerCase().replace("_", "-").split("-")[0] ?? null;
}

function candidateMatchesDomain(candidate, domains) {
  const candidateDomains = normalizeStringArray(candidate.domains).map((domain) => domain.toLowerCase());
  return domains.some((requested) => candidateDomains.some((candidateDomain) => candidateDomain === requested || candidateDomain.endsWith(`.${requested}`)));
}

function candidateMatchesFields(candidate, fieldsOfStudy) {
  const candidateFields = normalizeStringArray(candidate.fieldsOfStudy).map(normalizeComparableText).filter(Boolean);
  return fieldsOfStudy.some((requested) => {
    const normalized = normalizeComparableText(requested);
    return candidateFields.some((candidateField) => candidateField === normalized || candidateField.includes(normalized) || normalized.includes(candidateField));
  });
}

function postFilterCandidates(candidates, query, filterPlan) {
  const postFilters = new Set(Object.entries(filterPlan.filterModes).filter(([, mode]) => mode === "post").map(([name]) => name));
  return candidates.filter((candidate) => {
    if (postFilters.has("openAccessOnly") && candidate.openAccess !== true) {
      return false;
    }
    if (postFilters.has("year")) {
      const candidateYear = normalizeString(candidate.publishedAt)?.slice(0, 4);
      if (!candidateYear) {
        return false;
      }
      const [start, end] = query.year.split("-").map((item) => Number(item));
      const year = Number(candidateYear);
      if (year < start || year > (end || start)) {
        return false;
      }
    }
    if (postFilters.has("domains") && !candidateMatchesDomain(candidate, query.domains)) {
      return false;
    }
    if (postFilters.has("fieldsOfStudy") && !candidateMatchesFields(candidate, query.fieldsOfStudy)) {
      return false;
    }
    if (postFilters.has("locale") && normalizedLocaleBase(candidate.locale) !== normalizedLocaleBase(query.locale)) {
      return false;
    }
    return true;
  });
}

function registrationDraftFor(candidate, provider) {
  const identity = candidate.doi ?? candidate.arxivId ?? candidate.pubmedId ?? candidate.semanticScholarId ?? candidate.title;
  const sourceId = `source-${String(identity ?? "candidate")}`
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 127);
  return {
    authoritative: false,
    missionId: null,
    sourceId: sourceId || "source-candidate",
    title: candidate.title,
    authors: candidate.authors,
    year: normalizeString(candidate.publishedAt)?.slice(0, 4) ?? null,
    locator: candidate.url ?? doiUrl(candidate.doi),
    sourceType: provider.kind === "scholarly" ? "scholarly" : "web",
    origin: `network-search:${provider.id}`,
    abstract: candidate.snippet,
    capturePath: null
  };
}

function normalizeCandidate(candidate, provider) {
  const title = normalizeTitle(candidate.title);
  if (!title) {
    return null;
  }
  const doi = normalizeDoi(candidate.doi);
  const url = safeUrl(candidate.url) ?? doiUrl(doi);
  const candidateDomains = normalizeStringArray(candidate.domains).map((domain) => domain.toLowerCase());
  const urlHostname = hostnameFromUrl(url);
  if (urlHostname) {
    candidateDomains.push(urlHostname);
  }
  if (!url && !doi && !candidate.arxivId && !candidate.pubmedId && !candidate.semanticScholarId) {
    return null;
  }
  const normalized = {
    lifecycle: "candidate",
    title,
    url,
    snippet: cleanSnippet(candidate.snippet),
    sourceName: normalizeString(candidate.sourceName, provider.id),
    publishedAt: normalizeString(candidate.publishedAt),
    authors: normalizeAuthors(candidate.authors),
    domains: Array.from(new Set(candidateDomains)),
    fieldsOfStudy: normalizeStringArray(candidate.fieldsOfStudy),
    locale: normalizedLocaleBase(candidate.locale),
    doi,
    arxivId: normalizeString(candidate.arxivId),
    pubmedId: normalizeString(candidate.pubmedId),
    semanticScholarId: normalizeString(candidate.semanticScholarId),
    openAccess: candidate.openAccess === true ? true : candidate.openAccess === false ? false : null,
    providerId: provider.id,
    provenance: {
      providerId: provider.id,
      providerName: provider.id,
      access: provider.access,
      retrievedAt: new Date().toISOString()
    },
    score: Number.isFinite(candidate.score) ? candidate.score : 0,
    warnings: normalizeStringArray(candidate.warnings),
    captureRequiredForEvidence: true
  };
  return { ...normalized, registrationDraft: registrationDraftFor(normalized, provider) };
}

function canonicalUrlKey(value) {
  const url = safeUrl(value);
  if (!url) {
    return null;
  }
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  return parsed.toString().replace(/\/$/u, "").toLowerCase();
}

function titleKey(value) {
  return normalizeString(value)?.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() ?? null;
}

function dedupeKey(candidate) {
  if (candidate.doi) {
    return `doi:${candidate.doi}`;
  }
  if (candidate.arxivId) {
    return `arxiv:${candidate.arxivId.toLowerCase()}`;
  }
  if (candidate.pubmedId) {
    return `pmid:${candidate.pubmedId}`;
  }
  const url = canonicalUrlKey(candidate.url);
  if (url) {
    return `url:${url}`;
  }
  const title = titleKey(candidate.title);
  return title ? `title:${title}` : null;
}

function textTokens(value) {
  return Array.from(new Set(normalizeComparableText(value).split(/\s+/u).filter(Boolean)));
}

function tokenOverlapScore(value, queryTokens) {
  if (queryTokens.length === 0) {
    return 0;
  }
  const tokens = new Set(textTokens(value));
  return queryTokens.filter((token) => tokens.has(token)).length / queryTokens.length;
}

function publicationRecencyScore(publishedAt) {
  const year = Number(normalizeString(publishedAt)?.slice(0, 4));
  if (!Number.isInteger(year)) {
    return 0;
  }
  const age = Math.max(0, new Date().getUTCFullYear() - year);
  return Math.max(0, 10 - age * 0.75);
}

function scoreCandidate(candidate, query) {
  const normalizedQuery = normalizeComparableText(query.query);
  const normalizedTitle = normalizeComparableText(candidate.title);
  const queryTokens = textTokens(query.query);
  const titleOverlap = tokenOverlapScore(candidate.title, queryTokens);
  const snippetOverlap = tokenOverlapScore(candidate.snippet, queryTokens);
  const fieldOverlap = Math.max(0, ...candidate.fieldsOfStudy.map((field) => tokenOverlapScore(field, queryTokens)));
  const authority = Math.min(8, Math.max(0, Number.isFinite(candidate.score) ? candidate.score : 0));
  let score = authority;
  if (normalizedTitle === normalizedQuery) {
    score += 70;
  } else if (normalizedQuery && normalizedTitle.includes(normalizedQuery)) {
    score += 52;
  }
  score += titleOverlap * 42;
  score += snippetOverlap * 20;
  score += fieldOverlap * 16;
  score += publicationRecencyScore(candidate.publishedAt);
  if (candidate.doi || candidate.arxivId || candidate.pubmedId || candidate.semanticScholarId) {
    score += 2;
  }
  if (candidate.url) {
    score += 1;
  }
  if (candidate.openAccess === true) {
    score += 0.5;
  }
  return score;
}

function dedupeAndRank(candidates, query) {
  const byKey = new Map();
  for (const candidate of candidates) {
    const key = dedupeKey(candidate);
    if (!key) {
      continue;
    }
    const scored = { ...candidate, score: scoreCandidate(candidate, query) };
    const existing = byKey.get(key);
    if (!existing || scored.score > existing.score) {
      byKey.set(key, {
        ...scored,
        provenance: {
          ...scored.provenance,
          mergedProviderIds: Array.from(new Set([...(existing?.provenance?.mergedProviderIds ?? []), existing?.providerId, scored.providerId].filter(Boolean)))
        }
      });
    } else if (existing) {
      existing.provenance.mergedProviderIds = Array.from(new Set([...(existing.provenance?.mergedProviderIds ?? []), scored.providerId].filter(Boolean)));
    }
  }
  return Array.from(byKey.values())
    .sort((left, right) => right.score - left.score || (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""))
    .slice(0, query.limit);
}

function selectedProviderIds(query, config) {
  if (query.providerIds.length > 0) {
    const conflicts = query.providerIds.filter((id) => !providerVisibleForKind(PROVIDER_BY_ID.get(id), query.kind));
    if (conflicts.length > 0) {
      throw new Error(`Dove network search provider-kind conflict: ${conflicts.join(", ")} cannot be used for kind ${query.kind}.`);
    }
    return query.providerIds;
  }
  if (query.kind === "web") {
    return ["public-web"];
  }
  if (query.kind === "all") {
    return Array.from(new Set([...config.defaultProviderIds, "public-web"]));
  }
  return config.defaultProviderIds.filter((id) => PROVIDER_BY_ID.get(id)?.kind === "scholarly");
}

function providerVisibleForKind(provider, kind) {
  return Boolean(provider) && (kind === "all" || provider.kind === kind);
}

function providerReport(provider, fields = {}) {
  return {
    providerId: provider.id,
    kind: provider.kind,
    access: provider.access,
    status: fields.status ?? "available",
    resultCount: fields.resultCount ?? 0,
    fetchedCount: fields.fetchedCount ?? 0,
    message: fields.message ?? null,
    error: fields.error ?? null,
    appliedFilters: fields.appliedFilters ?? [],
    unsupportedFilters: fields.unsupportedFilters ?? [],
    filterModes: fields.filterModes ?? {},
    capabilities: provider.capabilities
  };
}

function publicWebUnavailableReport() {
  const provider = PROVIDER_BY_ID.get("public-web");
  return providerReport(provider, {
    status: "unavailable",
    message: "Dove 还没有内置稳定的免 key 通用网页搜索 provider；请先用宿主公开搜索核实网页，再把验证过的来源登记为 source 或 note。"
  });
}

async function withTimeout(operation, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function runProvider(provider, query, config, fetchFn) {
  if (provider.unavailable) {
    return {
      candidates: [],
      report: { ...publicWebUnavailableReport(), unsupportedFilters: requestedFilterNames(query) }
    };
  }
  const limit = Math.min(query.limit, provider.maxLimit || query.limit);
  const timeoutMs = normalizePositiveInteger(config.providerSettings?.[provider.id]?.timeoutMs, config.timeoutMs, 1000, 60000);
  const filterPlan = providerFilterPlan(provider, query);
  const needsPostFilter = Object.values(filterPlan.filterModes).includes("post");
  const fetchLimit = needsPostFilter
    ? Math.min(provider.maxLimit || limit, Math.max(limit, limit * POST_FILTER_OVERFETCH_FACTOR))
    : limit;
  const providerQuery = { ...query, limit: fetchLimit };
  try {
    const rawCandidates = await withTimeout(Promise.resolve().then(() => PROVIDER_ADAPTERS[provider.id](providerQuery, { timeoutMs, fetchFn })), timeoutMs);
    const candidates = postFilterCandidates(rawCandidates.map((candidate) => normalizeCandidate(candidate, provider)).filter(Boolean), query, filterPlan).slice(0, limit);
    return {
      candidates,
      report: providerReport(provider, { status: "ok", resultCount: candidates.length, fetchedCount: rawCandidates.length, ...filterPlan })
    };
  } catch (error) {
    return {
      candidates: [],
      report: providerReport(provider, { status: "error", error: sanitizeError(error), message: "Provider search failed.", ...filterPlan })
    };
  }
}

async function searchOpenAlex(query, options) {
  const params = buildParams({
    search: query.query,
    "per-page": query.limit,
    select: "id,doi,title,display_name,publication_year,authorships,open_access,primary_location,locations,primary_topic,topics,language,cited_by_count,abstract_inverted_index"
  });
  if (query.year && !query.year.includes("-")) {
    params.set("filter", `from_publication_date:${query.year}-01-01,to_publication_date:${query.year}-12-31`);
  } else if (query.year) {
    const [start, end] = query.year.split("-");
    params.set("filter", `from_publication_date:${start}-01-01,to_publication_date:${end}-12-31`);
  }
  const json = await fetchJson(`https://api.openalex.org/works?${params.toString()}`, options);
  return Array.isArray(json.results) ? json.results.map((item) => ({
    title: item.title ?? item.display_name,
    url: item.doi ?? item.primary_location?.landing_page_url ?? item.id,
    snippet: abstractFromInvertedIndex(item.abstract_inverted_index) ?? item.primary_location?.source?.display_name,
    sourceName: item.primary_location?.source?.display_name ?? "OpenAlex",
    publishedAt: normalizePublishedAt(item.publication_year),
    authors: Array.isArray(item.authorships) ? item.authorships.map((authorship) => authorship.author?.display_name).filter(Boolean) : [],
    domains: Array.from(new Set([item.primary_location, ...(Array.isArray(item.locations) ? item.locations : [])].flatMap((location) => [hostnameFromUrl(location?.landing_page_url), hostnameFromUrl(location?.pdf_url)]).filter(Boolean))),
    fieldsOfStudy: Array.from(new Set([item.primary_topic?.display_name, ...(Array.isArray(item.topics) ? item.topics.map((topic) => topic?.display_name) : [])].filter(Boolean))),
    locale: item.language,
    doi: item.doi,
    openAccess: item.open_access?.is_oa === true,
    score: Number(item.cited_by_count ?? 0) > 0 ? Math.log10(Number(item.cited_by_count) + 1) : 0
  })) : [];
}

function crossrefOpenAccess(item) {
  const links = Array.isArray(item.link) ? item.link : [];
  if (links.some((link) => /^https?:/iu.test(link?.URL ?? "") && /(?:application\/pdf|text\/html)/iu.test(link?.["content-type"] ?? ""))) {
    return true;
  }
  return item.license ? (Array.isArray(item.license) ? item.license.length > 0 : true) : null;
}

async function searchCrossref(query, options) {
  const params = buildParams({ query: query.query, rows: query.limit, select: "DOI,title,URL,link,license,author,published,published-print,published-online,container-title,abstract,language,is-referenced-by-count" });
  if (query.year && !query.year.includes("-")) {
    params.set("filter", `from-pub-date:${query.year}-01-01,until-pub-date:${query.year}-12-31`);
  } else if (query.year) {
    const [start, end] = query.year.split("-");
    params.set("filter", `from-pub-date:${start}-01-01,until-pub-date:${end}-12-31`);
  }
  const json = await fetchJson(`https://api.crossref.org/works?${params.toString()}`, options);
  const items = json.message?.items;
  return Array.isArray(items) ? items.map((item) => ({
    title: item.title,
    url: item.URL ?? doiUrl(item.DOI),
    snippet: item.abstract ?? item["container-title"]?.[0],
    sourceName: item["container-title"]?.[0] ?? "Crossref",
    publishedAt: normalizePublishedAt(null, item.published?.["date-parts"] ?? item["published-online"]?.["date-parts"] ?? item["published-print"]?.["date-parts"]),
    authors: normalizeAuthors(item.author),
    domains: Array.from(new Set([hostnameFromUrl(item.URL), ...(Array.isArray(item.link) ? item.link.map((link) => hostnameFromUrl(link?.URL)) : [])].filter(Boolean))),
    locale: item.language,
    doi: item.DOI,
    openAccess: crossrefOpenAccess(item),
    score: Number(item["is-referenced-by-count"] ?? 0) > 0 ? Math.log10(Number(item["is-referenced-by-count"]) + 1) : 0
  })) : [];
}

async function searchArxiv(query, options) {
  const params = buildParams({
    search_query: `all:${query.query}`,
    start: 0,
    max_results: query.limit,
    sortBy: "relevance",
    sortOrder: "descending"
  });
  const xml = await fetchText(`https://export.arxiv.org/api/query?${params.toString()}`, { ...options, headers: { Accept: "application/atom+xml, text/xml;q=0.9" } });
  return Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/giu)).map((match) => {
    const entry = match[1];
    const idUrl = extractXmlText(entry, "id");
    const arxivId = idUrl?.split("/abs/")[1]?.replace(/v\d+$/u, "") ?? null;
    return {
      title: extractXmlText(entry, "title"),
      url: idUrl,
      snippet: extractXmlText(entry, "summary"),
      sourceName: "arXiv",
      publishedAt: extractXmlText(entry, "published")?.slice(0, 10),
      authors: Array.from(entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/giu)).map((author) => decodeXml(author[1])),
      domains: [hostnameFromUrl(idUrl)].filter(Boolean),
      arxivId,
      openAccess: true,
      score: 2
    };
  });
}

async function searchEuropePmc(query, options) {
  const params = buildParams({ query: query.query, format: "json", pageSize: query.limit, resultType: "core" });
  const json = await fetchJson(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params.toString()}`, options);
  const results = json.resultList?.result;
  return Array.isArray(results) ? results.map((item) => {
    const url = item.doi ? doiUrl(item.doi) : item.pmid ? `https://europepmc.org/article/MED/${item.pmid}` : item.pmcid ? `https://europepmc.org/article/PMC/${item.pmcid}` : null;
    return {
      title: item.title,
      url,
      snippet: item.abstractText,
      sourceName: item.journalTitle ?? "Europe PMC",
      publishedAt: normalizePublishedAt(item.firstPublicationDate ?? item.pubYear),
      authors: item.authorList?.author ? normalizeAuthors(item.authorList.author) : normalizeAuthors(item.authorString),
      domains: [hostnameFromUrl(url)].filter(Boolean),
      locale: item.language ?? item.lang,
      doi: item.doi,
      pubmedId: item.pmid,
      openAccess: item.isOpenAccess === "Y" || item.inEPMC === "Y",
      score: Number(item.citedByCount ?? 0) > 0 ? Math.log10(Number(item.citedByCount) + 1) : 0
    };
  }) : [];
}

const PROVIDER_ADAPTERS = {
  openalex: searchOpenAlex,
  crossref: searchCrossref,
  arxiv: searchArxiv,
  "europe-pmc": searchEuropePmc
};

function buildSearchSummary(status, candidates, reports, query) {
  if (!candidates.length) {
    const failedCount = reports.filter((report) => report.status === "error").length;
    const unavailableCount = reports.filter((report) => report.status === "unavailable").length;
    if (query.kind === "web" || unavailableCount === reports.length) {
      return "没有可用的免 key 通用网页搜索 provider；这次没有登记任何来源。";
    }
    if (failedCount > 0) {
      return "这次联网搜索没有得到可验证候选，并且有 provider 失败；不要把它当成已完成检索。";
    }
    return "这次联网搜索没有得到可验证候选；不要登记来源或生成 claim。";
  }
  const warningCount = reports.filter((report) => report.status !== "ok").length;
  return warningCount > 0
    ? `找到 ${candidates.length} 个候选来源，但有 ${warningCount} 个 provider 不可用或失败。`
    : `找到 ${candidates.length} 个候选来源。`;
}

function buildNeedsAttention(status, reports, candidates) {
  const failed = reports.filter((report) => report.status === "error");
  const unavailable = reports.filter((report) => report.status === "unavailable" || report.status === "disabled");
  if (status === "blocked") {
    return {
      status: "blocked",
      summary: "没有可验证候选来源。",
      why: unavailable.length > 0 ? unavailable[0].message : failed[0]?.error ?? "搜索返回零结果。",
      needs: ["换一个查询词，或用宿主公开搜索核实网页后再登记来源。"]
    };
  }
  if (failed.length > 0 || unavailable.length > 0) {
    return {
      status: "partial",
      summary: "部分 provider 没有产出。",
      why: unavailable[0]?.message ?? failed[0]?.error,
      needs: candidates.length > 0 ? ["先人工打开候选结果核实，再登记为 source。"] : []
    };
  }
  return null;
}

export async function executeNetworkSearch(rawArgs = {}, config = {}, options = {}) {
  const normalizedConfig = normalizeNetworkSearchConfigForCore(config);
  const query = normalizeNetworkSearchQuery(rawArgs, normalizedConfig);
  if (!normalizedConfig.enabled) {
    return {
      status: "blocked",
      summary: "Dove 联网搜索已在配置中关闭；这次没有执行搜索。",
      scope: { kind: "search", status: "blocked" },
      query,
      candidates: [],
      providerReports: [],
      nextStep: { label: "开启 networkSearch 后再搜索。", why: "搜索关闭时不能生成候选来源。" },
      needsAttention: { status: "blocked", summary: "联网搜索关闭。", needs: ["启用公开 provider 后重试。"] },
      showMore: { text: "展开结果可查看查询参数和 provider 状态。" }
    };
  }
  const disabled = new Set(normalizedConfig.disabledProviderIds);
  const providerIds = selectedProviderIds(query, normalizedConfig);
  const selectedProviders = providerIds.map((id) => PROVIDER_BY_ID.get(id)).filter((provider) => provider && providerVisibleForKind(provider, query.kind));
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const providerResults = await Promise.all(selectedProviders.map((provider) => {
    if (disabled.has(provider.id) || normalizedConfig.providerSettings?.[provider.id]?.enabled === false) {
      return { candidates: [], report: providerReport(provider, { status: "disabled", message: "Provider disabled in Dove networkSearch config.", ...providerFilterPlan(provider, query) }) };
    }
    return runProvider(provider, query, normalizedConfig, fetchFn);
  }));
  const providerReports = providerResults.map((result) => result.report);
  const allCandidates = providerResults.flatMap((result) => result.candidates);
  const candidates = dedupeAndRank(allCandidates, query);
  const status = candidates.length > 0 ? "ok" : "blocked";
  return {
    status,
    summary: buildSearchSummary(status, candidates, providerReports, query),
    scope: { kind: "search", status, currentFocus: query.query },
    query,
    candidates,
    providerReports,
    nextStep: {
      label: candidates.length > 0 ? "在宿主中打开候选并可见地捕获原文，然后用 capturePath 登记并查询 source。" : "换查询词或改用宿主公开搜索核实。",
      why: "联网搜索只产出非权威 registrationDraft；没有可见捕获文件时不能进入证据链。",
      requiredActions: candidates.length > 0 ? ["宿主可见捕获候选材料", "用 --capture-path 调用 register_source", "调用 query_sources 检查候选状态"] : ["重新检索或提供可验证 URL"]
    },
    captureRequiredForEvidence: candidates.length > 0,
    needsAttention: buildNeedsAttention(status, providerReports, candidates),
    showMore: { text: "展开结果可查看候选列表和 provider 状态；默认 compact 不展示原始返回。" },
    diagnostics: {
      providerCount: providerReports.length,
      candidateCountBeforeDedupe: allCandidates.length,
      fetchedCount: providerReports.reduce((sum, report) => sum + report.fetchedCount, 0),
      appliedFilters: Array.from(new Set(providerReports.flatMap((report) => report.appliedFilters))),
      unsupportedFilters: Array.from(new Set(providerReports.flatMap((report) => report.unsupportedFilters)))
    }
  };
}

export async function searchNetwork(root, args = {}, env = process.env, options = {}) {
  return executeNetworkSearch(args, loadNetworkSearchConfig(root, env), options);
}

function providerStatus(provider, config) {
  const disabled = new Set(config.disabledProviderIds);
  if (provider.unavailable) {
    return publicWebUnavailableReport();
  }
  if (!config.enabled || disabled.has(provider.id) || config.providerSettings?.[provider.id]?.enabled === false) {
    return providerReport(provider, { status: "disabled", message: "Provider disabled by Dove networkSearch config." });
  }
  return providerReport(provider, { status: "available" });
}

export function queryNetworkSearchProviders(root, args = {}, env = process.env) {
  const config = normalizeNetworkSearchConfigForCore(loadNetworkSearchConfig(root, env));
  const kind = normalizeString(args.kind, "all").toLowerCase();
  if (!SEARCH_KINDS.has(kind)) {
    throw new Error(`Dove network search kind must be one of: ${Array.from(SEARCH_KINDS).join(", ")}.`);
  }
  const requestedIds = normalizeProviderIds(args.providerIds ?? args.providers);
  const conflicts = requestedIds.filter((id) => !providerVisibleForKind(PROVIDER_BY_ID.get(id), kind));
  if (conflicts.length > 0) {
    throw new Error(`Dove network search provider-kind conflict: ${conflicts.join(", ")} cannot be used for kind ${kind}.`);
  }
  const providers = NETWORK_SEARCH_PROVIDER_REGISTRY
    .filter((provider) => requestedIds.length === 0 || requestedIds.includes(provider.id))
    .filter((provider) => providerVisibleForKind(provider, kind));
  const providerReports = providers.map((provider) => providerStatus(provider, config));
  const availableCount = providerReports.filter((report) => report.status === "available").length;
  const unavailableCount = providerReports.filter((report) => report.status !== "available").length;
  return {
    status: availableCount > 0 ? "ok" : "blocked",
    summary: availableCount > 0 ? `当前有 ${availableCount} 个公开免 key 搜索 provider 可用。` : "当前没有可用的公开免 key 搜索 provider。",
    scope: { kind: "search", status: availableCount > 0 ? "ok" : "blocked" },
    providers: providerReports,
    defaultProviderIds: config.defaultProviderIds,
    nextStep: {
      label: availableCount > 0 ? "直接用搜索工具发现候选来源。" : "启用公开 provider 或用宿主公开搜索核实。",
      why: "Dove 只内置免 key provider；搜索结果仍需人工核实后再进入证据链。"
    },
    needsAttention: unavailableCount > 0 ? {
      status: availableCount > 0 ? "partial" : "blocked",
      summary: `${unavailableCount} 个 provider 不可用或关闭。`,
      needs: ["不要把不可用 provider 当成已检索完成。"]
    } : null,
    showMore: { text: "展开结果可查看 provider 能力；默认 compact 不展示内部字段。" }
  };
}

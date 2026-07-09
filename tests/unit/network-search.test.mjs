import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_NETWORK_SEARCH_PROVIDER_IDS,
  NETWORK_SEARCH_PROVIDER_REGISTRY,
  executeNetworkSearch,
  normalizeNetworkSearchConfig,
  normalizeNetworkSearchQuery
} from "../../src/core/index.mjs";

function jsonResponse(value) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(value)
  };
}

function textResponse(value) {
  return {
    ok: true,
    status: 200,
    text: async () => value
  };
}

test("network search registry exposes public no-key providers", () => {
  const providers = new Map(NETWORK_SEARCH_PROVIDER_REGISTRY.map((provider) => [provider.id, provider]));
  for (const id of DEFAULT_NETWORK_SEARCH_PROVIDER_IDS) {
    assert.equal(providers.get(id)?.access, "public");
    assert.equal(providers.get(id)?.unavailable, undefined);
  }
  assert.equal(providers.get("public-web")?.kind, "web");
  assert.equal(providers.get("public-web")?.unavailable, true);
});

test("network search query normalization rejects unsafe or unsupported inputs", () => {
  assert.throws(() => normalizeNetworkSearchQuery({ query: "" }), /non-empty query/);
  assert.throws(() => normalizeNetworkSearchQuery({ query: "x", kind: "private" }), /kind must be/);
  assert.throws(() => normalizeNetworkSearchQuery({ query: "x", domains: ["https://example.com/path"] }), /bare hostnames/);
  assert.throws(() => normalizeNetworkSearchQuery({ query: "x", providerIds: ["serpapi"] }), /Unsupported Dove network search provider/);
  assert.deepEqual(normalizeNetworkSearchQuery({ query: "  graph foundation fields  ", limit: 999, year: "2024-2026", providerIds: "openalex,crossref" }).providerIds, ["openalex", "crossref"]);
});

test("network search config rejects credential fields", () => {
  assert.throws(() => normalizeNetworkSearchConfig({ apiKey: "secret" }), /public no-key providers/);
  assert.throws(() => normalizeNetworkSearchConfig({ providerSettings: { openalex: { headers: { Authorization: "Bearer secret" } } } }), /credential field/);
  const config = normalizeNetworkSearchConfig({ defaultProviderIds: ["openalex"], providerSettings: { openalex: { enabled: true, timeoutMs: 3000 } } });
  assert.deepEqual(config.defaultProviderIds, ["openalex"]);
  assert.equal(config.providerSettings.openalex.timeoutMs, 3000);
});

test("network search deduplicates scholarly candidates and reports partial provider failure", async () => {
  const fetchFn = async (url) => {
    const parsed = new URL(url);
    if (parsed.hostname === "api.openalex.org") {
      return jsonResponse({
        results: [{
          title: "Graph Foundation Fields for Structured Reasoning",
          doi: "https://doi.org/10.1234/gff",
          publication_year: 2026,
          authorships: [{ author: { display_name: "Ada Lovelace" } }],
          open_access: { is_oa: true },
          primary_location: { landing_page_url: "https://example.org/gff", source: { display_name: "Example Journal" } },
          cited_by_count: 9,
          abstract_inverted_index: { Graph: [0], fields: [1], help: [2], reasoning: [3] }
        }]
      });
    }
    if (parsed.hostname === "api.crossref.org") {
      return jsonResponse({
        message: {
          items: [{
            title: ["Graph Foundation Fields for Structured Reasoning"],
            DOI: "10.1234/GFF",
            URL: "https://doi.org/10.1234/GFF",
            author: [{ given: "Ada", family: "Lovelace" }],
            published: { "date-parts": [[2026, 5, 1]] },
            "container-title": ["Example Journal"],
            abstract: "<jats:p>Crossref abstract</jats:p>",
            "is-referenced-by-count": 99
          }]
        }
      });
    }
    return { ok: false, status: 503, text: async () => "down" };
  };

  const result = await executeNetworkSearch({
    query: "graph foundation fields",
    providerIds: ["openalex", "crossref", "arxiv"],
    limit: 5
  }, {}, { fetchFn });

  assert.equal(result.status, "ok");
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].doi, "10.1234/gff");
  assert.deepEqual(result.candidates[0].provenance.mergedProviderIds.sort(), ["crossref", "openalex"]);
  assert.equal(result.providerReports.find((report) => report.providerId === "arxiv")?.status, "error");
  assert.equal(result.needsAttention.status, "partial");
});

test("network search blocks public web search instead of pretending a provider exists", async () => {
  let calls = 0;
  const result = await executeNetworkSearch({ query: "current Claude Code settings", kind: "web" }, {}, { fetchFn: async () => { calls += 1; return textResponse(""); } });
  assert.equal(calls, 0);
  assert.equal(result.status, "blocked");
  assert.equal(result.candidates.length, 0);
  assert.equal(result.providerReports[0].providerId, "public-web");
  assert.equal(result.providerReports[0].status, "unavailable");
  assert.match(result.summary, /免 key/);
});

test("network search redacts provider error details", async () => {
  const result = await executeNetworkSearch({ query: "secret redaction", providerIds: ["openalex"] }, {}, {
    fetchFn: async () => {
      throw new Error("apiKey=super-secret Bearer abcdefghijklmnop");
    }
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.providerReports[0].status, "error");
  assert.doesNotMatch(result.providerReports[0].error, /super-secret|abcdefghijklmnop/);
  assert.match(result.providerReports[0].error, /\[REDACTED\]/);
});

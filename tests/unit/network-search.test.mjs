import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_NETWORK_SEARCH_PROVIDER_IDS,
  NETWORK_SEARCH_PROVIDER_REGISTRY,
  executeNetworkSearch,
  normalizeNetworkSearchConfig,
  normalizeNetworkSearchQuery
} from "../../src/core/internal-api.mjs";

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
  assert.ok(providers.get("crossref")?.capabilities.includes("open-access"));
  assert.equal(providers.get("crossref")?.filters.openAccessOnly, "post");
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
  assert.equal(result.candidates[0].lifecycle, "candidate");
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

test("network search rejects explicit provider-kind conflicts", async () => {
  await assert.rejects(
    executeNetworkSearch({ query: "graph", kind: "web", providerIds: ["openalex"] }),
    /provider-kind conflict/
  );
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

test("network search applies reliable filters and reports unsupported filters explicitly", async () => {
  const fetchFn = async (url) => {
    const parsed = new URL(url);
    if (parsed.hostname === "api.openalex.org") {
      return jsonResponse({
        results: [
          {
            title: "Graph Reasoning in Biology",
            doi: "10.1000/match",
            publication_year: 2025,
            open_access: { is_oa: true },
            primary_location: { landing_page_url: "https://papers.example.org/match" },
            locations: [],
            primary_topic: { display_name: "Computational Biology" },
            topics: [],
            language: "en",
            abstract_inverted_index: { graph: [0], biology: [1] }
          },
          {
            title: "Graph Reasoning Elsewhere",
            doi: "10.1000/miss",
            publication_year: 2025,
            open_access: { is_oa: true },
            primary_location: { landing_page_url: "https://other.example.net/miss" },
            locations: [],
            primary_topic: { display_name: "Computer Science" },
            topics: [],
            language: "fr"
          }
        ]
      });
    }
    return jsonResponse({ message: { items: [] } });
  };

  const result = await executeNetworkSearch({
    query: "graph reasoning biology",
    providerIds: ["openalex", "crossref"],
    year: "2025",
    domains: ["example.org"],
    fieldsOfStudy: ["biology"],
    openAccessOnly: true,
    locale: "en-US"
  }, {}, { fetchFn });

  assert.deepEqual(result.candidates.map((candidate) => candidate.doi), ["10.1000/match"]);
  const openAlex = result.providerReports[0];
  assert.deepEqual(openAlex.appliedFilters, ["year", "domains", "fieldsOfStudy", "openAccessOnly", "locale"]);
  assert.deepEqual(openAlex.unsupportedFilters, []);
  const crossref = result.providerReports[1];
  assert.deepEqual(crossref.appliedFilters, ["year", "domains", "openAccessOnly", "locale"]);
  assert.deepEqual(crossref.unsupportedFilters, ["fieldsOfStudy"]);
});

test("network search uses bounded over-fetch before post filtering", async () => {
  let requestedRows = null;
  const result = await executeNetworkSearch({
    query: "open access graph",
    providerIds: ["crossref"],
    limit: 2,
    openAccessOnly: true
  }, {}, { fetchFn: async (url) => {
    requestedRows = Number(new URL(url).searchParams.get("rows"));
    return jsonResponse({ message: { items: [
      { title: ["Closed one"], DOI: "10.1000/closed-1" },
      { title: ["Closed two"], DOI: "10.1000/closed-2" },
      { title: ["Open graph one"], DOI: "10.1000/open-1", license: [{ URL: "https://creativecommons.org/licenses/by/4.0/" }] },
      { title: ["Open graph two"], DOI: "10.1000/open-2", link: [{ URL: "https://example.org/open-2.pdf", "content-type": "application/pdf" }] }
    ] } });
  } });

  assert.equal(requestedRows, 6);
  assert.deepEqual(result.candidates.map((candidate) => candidate.doi).sort(), ["10.1000/open-1", "10.1000/open-2"]);
  assert.equal(result.providerReports[0].fetchedCount, 4);
  assert.equal(result.providerReports[0].filterModes.openAccessOnly, "post");
});

test("Europe PMC normalizes three-letter language and canonical result domains", async () => {
  const result = await executeNetworkSearch({
    query: "immune graph",
    providerIds: ["europe-pmc"],
    locale: "eng",
    domains: ["doi.org"]
  }, {}, { fetchFn: async () => jsonResponse({ resultList: { result: [{
    title: "Immune Graph",
    doi: "10.1000/immune",
    language: "ENG",
    authorList: { author: [{ fullName: "Ada Researcher" }] },
    isOpenAccess: "Y"
  }] } }) });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].locale, "eng");
  assert.deepEqual(result.candidates[0].domains, ["doi.org"]);
  assert.deepEqual(result.candidates[0].authors, ["Ada Researcher"]);
});

test("network search reports provider-specific unsupported locale and field filters", async () => {
  const result = await executeNetworkSearch({
    query: "graph learning",
    providerIds: ["arxiv"],
    fieldsOfStudy: ["computer science"],
    locale: "en"
  }, {}, { fetchFn: async () => textResponse("<feed></feed>") });

  assert.deepEqual(result.providerReports[0].appliedFilters, []);
  assert.deepEqual(result.providerReports[0].unsupportedFilters, ["fieldsOfStudy", "locale"]);
});

test("network search ranks direct title and abstract relevance above citation authority", async () => {
  const result = await executeNetworkSearch({ query: "graph foundation fields", providerIds: ["openalex"], limit: 2 }, {}, {
    fetchFn: async () => jsonResponse({
      results: [
        {
          title: "Graph Foundation Fields",
          doi: "10.1000/direct",
          publication_year: 2025,
          cited_by_count: 0,
          open_access: { is_oa: true },
          primary_location: { landing_page_url: "https://example.org/direct" },
          abstract_inverted_index: { graph: [0], foundation: [1], fields: [2] }
        },
        {
          title: "A Highly Cited Survey of Unrelated Chemistry",
          doi: "10.1000/authority",
          publication_year: 2026,
          cited_by_count: 1000000000,
          open_access: { is_oa: true },
          primary_location: { landing_page_url: "https://example.org/authority" },
          abstract_inverted_index: { chemistry: [0], reactions: [1] }
        }
      ]
    })
  });

  assert.equal(result.candidates[0].doi, "10.1000/direct");
  assert.ok(result.candidates[0].score > result.candidates[1].score);
});

test("network search runs providers concurrently, isolates timeout, and preserves report order", async () => {
  const started = [];
  const fetchFn = async (url, options = {}) => {
    const hostname = new URL(url).hostname;
    started.push(hostname);
    if (hostname === "api.openalex.org") {
      await new Promise((resolve) => setTimeout(resolve, 120));
      return jsonResponse({ results: [{
        title: "Parallel Provider Search",
        doi: "10.1000/parallel",
        publication_year: 2026,
        open_access: { is_oa: true },
        primary_location: { landing_page_url: "https://example.org/parallel" }
      }] });
    }
    if (hostname === "export.arxiv.org") {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return textResponse("<feed></feed>");
    }
    return new Promise((resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
    });
  };

  const startedAt = Date.now();
  const result = await executeNetworkSearch({
    query: "parallel provider search",
    providerIds: ["openalex", "crossref", "arxiv"]
  }, {
    timeoutMs: 1000,
    providerSettings: { crossref: { timeoutMs: 1000 } }
  }, { fetchFn });
  const elapsedMs = Date.now() - startedAt;

  assert.deepEqual(started.sort(), ["api.crossref.org", "api.openalex.org", "export.arxiv.org"]);
  assert.equal(result.status, "ok");
  assert.deepEqual(result.candidates.map((candidate) => candidate.doi), ["10.1000/parallel"]);
  assert.deepEqual(result.providerReports.map((report) => report.providerId), ["openalex", "crossref", "arxiv"]);
  assert.deepEqual(result.providerReports.map((report) => report.status), ["ok", "error", "ok"]);
  assert.match(result.providerReports[1].error, /Timed out/);
  assert.equal(result.needsAttention.status, "partial");
  assert.ok(elapsedMs < 1150, `expected concurrent execution near one timeout, got ${elapsedMs}ms`);
});

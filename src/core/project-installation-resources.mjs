import crypto from "node:crypto";

import {
  DOVE_CLAUDE_SESSION_START_HOOK_ENTRY,
  DOVE_CLAUDE_SETTINGS_PATH,
  DOVE_CLAUDE_STATUS_LINE
} from "./ambient-policy.mjs";
import {
  PAPER_SEARCH_MCP_FRAGMENT,
  PAPER_SEARCH_MCP_PATH,
  PAPER_SEARCH_MCP_SELECTOR
} from "./paper-search-integration.mjs";
import {
  EXA_MCP_FRAGMENT,
  EXA_MCP_SELECTOR,
  WEB_FETCH_DENY_PERMISSION,
  WEB_FETCH_DENY_SELECTOR
} from "./web-access-integration.mjs";
import { generatedAdapterEntries, generatedClaudeAmbientProjectEntries, generatedResearchQualityReferenceEntries } from "../../scripts/generate-command-adapters.mjs";
import { generatedDoveAgentEntries } from "./dove-agent-definition.mjs";

export const RETIRED_USER_PROMPT_SUBMIT_SELECTOR = "/hooks/UserPromptSubmit[dove-user-prompt-submit]";
export const SESSION_START_SELECTOR = "/hooks/SessionStart[dove-session-start]";
export const STATUS_LINE_SELECTOR = "/statusLine[dove-project-directory]";
export const CLAUDE_HOST = "claude";

const FORBIDDEN_RESOURCE_PREFIXES = [".dove/", "bin/", "dist/", "mcp/", "scripts/"];

export function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

export function semanticDigest(value) {
  return sha256(canonicalJson(value));
}

function normalizedGeneratedContent(content) {
  return `${String(content).trimEnd()}\n`;
}

export function managedKey(entry) {
  return `${entry.path}\0${entry.kind}\0${entry.selector ?? ""}`;
}

export function compareManaged(left, right) {
  return left.path.localeCompare(right.path)
    || left.kind.localeCompare(right.kind)
    || String(left.selector ?? "").localeCompare(String(right.selector ?? ""));
}

export function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function samePackage(left, right) {
  return left.name === right.name && left.version === right.version;
}

export function sameManaged(left, right) {
  const sortedLeft = [...left].sort(compareManaged);
  const sortedRight = [...right].sort(compareManaged);
  return sortedLeft.length === sortedRight.length
    && sortedLeft.every((entry, index) => managedKey(entry) === managedKey(sortedRight[index]) && entry.digest === sortedRight[index].digest);
}

function assertManagedResourcePath(relativePath) {
  if (relativePath === ".dove/install/RESEARCH_QUALITY.md") return;
  if (relativePath === ".dove" || relativePath.startsWith(".dove/")) throw new Error(`Project integration resources must not manage Dove workspace state: ${relativePath}.`);
  if (FORBIDDEN_RESOURCE_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) throw new Error(`Project integration resources must not install runtime bundles: ${relativePath}.`);
}

export function claudeResources() {
  const agentEntries = generatedDoveAgentEntries().filter((entry) => entry.relativePath.startsWith(".claude/agents/"));
  const files = [
    ...generatedAdapterEntries().filter((entry) => entry.hostId === CLAUDE_HOST),
    ...generatedClaudeAmbientProjectEntries(),
    ...generatedResearchQualityReferenceEntries().filter((entry) => entry.hostId === CLAUDE_HOST),
    ...agentEntries
  ].map((entry) => {
    const destinationPath = entry.destinationPath ?? entry.relativePath;
    assertManagedResourcePath(destinationPath);
    const content = normalizedGeneratedContent(entry.content);
    return {
      hostId: CLAUDE_HOST,
      path: destinationPath,
      kind: "exclusive-file",
      selector: null,
      content,
      digest: sha256(content)
    };
  });
  const sessionStartHook = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: SESSION_START_SELECTOR,
    fragment: DOVE_CLAUDE_SESSION_START_HOOK_ENTRY,
    digest: semanticDigest(DOVE_CLAUDE_SESSION_START_HOOK_ENTRY)
  };
  const statusLine = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: STATUS_LINE_SELECTOR,
    fragment: DOVE_CLAUDE_STATUS_LINE,
    digest: semanticDigest(DOVE_CLAUDE_STATUS_LINE)
  };
  const webFetchDeny = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: WEB_FETCH_DENY_SELECTOR,
    fragment: WEB_FETCH_DENY_PERMISSION,
    digest: semanticDigest(WEB_FETCH_DENY_PERMISSION)
  };
  const paperSearch = {
    hostId: CLAUDE_HOST,
    path: PAPER_SEARCH_MCP_PATH,
    kind: "json-fragment",
    selector: PAPER_SEARCH_MCP_SELECTOR,
    fragment: PAPER_SEARCH_MCP_FRAGMENT,
    digest: semanticDigest(PAPER_SEARCH_MCP_FRAGMENT)
  };
  const exa = {
    hostId: CLAUDE_HOST,
    path: PAPER_SEARCH_MCP_PATH,
    kind: "json-fragment",
    selector: EXA_MCP_SELECTOR,
    fragment: EXA_MCP_FRAGMENT,
    digest: semanticDigest(EXA_MCP_FRAGMENT)
  };
  const resources = [...files, sessionStartHook, statusLine, webFetchDeny, paperSearch, exa];
  if (new Set(resources.map(managedKey)).size !== resources.length) throw new Error("Generated project integration resources contain duplicate manifest entries.");
  return resources;
}

export function dshResources() {
  return [...generatedAdapterEntries(), ...generatedResearchQualityReferenceEntries()].filter((entry) => entry.hostId === "dsh").map((entry) => {
    assertManagedResourcePath(entry.destinationPath);
    const content = normalizedGeneratedContent(entry.content);
    return {
      hostId: "dsh",
      path: entry.destinationPath,
      kind: "exclusive-file",
      selector: null,
      content,
      digest: sha256(content)
    };
  });
}

export function resourcesForHosts(hosts) {
  const selected = [...claudeResources(), ...dshResources()].filter((entry) => hosts.includes(entry.hostId));
  return [...new Map(selected.map((entry) => [managedKey(entry), entry])).values()].sort(compareManaged);
}

export function desiredManaged(resources) {
  return resources.map(({ path: relativePath, kind, selector, digest }) => ({ path: relativePath, kind, selector, digest })).sort(compareManaged);
}

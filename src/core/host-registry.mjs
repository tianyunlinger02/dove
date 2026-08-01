export const PROJECT_HOST_IDS = Object.freeze(["opencode", "codex", "cursor", "agents", "claude"]);

const HOST_DEFINITIONS = [
  {
    id: "opencode",
    label: "OpenCode",
    order: 0,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectMcpRegistration: false, projectHooks: false, sharedInstructions: false, nativeReviewer: true, reviewerFreshContext: true, reviewerReadOnly: true, reviewerSynchronous: true },
    legacySignatures: [".opencode.json", ".opencode/commands/dove.status.md", ".opencode/skills/dove-planner/SKILL.md"]
  },
  {
    id: "codex",
    label: "Codex",
    order: 1,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectMcpRegistration: false, projectHooks: false, sharedInstructions: false },
    legacySignatures: [".codex/skills/dove-status/SKILL.md"]
  },
  {
    id: "cursor",
    label: "Cursor",
    order: 2,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectMcpRegistration: false, projectHooks: false, sharedInstructions: false },
    legacySignatures: [".cursor/commands/dove-status.md"]
  },
  {
    id: "agents",
    label: "Shared agent skills",
    order: 3,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectMcpRegistration: false, projectHooks: false, sharedInstructions: true },
    legacySignatures: [".agents/skills/dove-status/SKILL.md", "AGENTS.md"]
  },
  {
    id: "claude",
    label: "Claude Code",
    order: 4,
    projectInitializable: true,
    capabilities: { commandAdapters: true, projectMcpRegistration: true, projectHooks: true, sharedInstructions: false, nativeReviewer: true, reviewerFreshContext: true, reviewerReadOnly: true, reviewerSynchronous: true },
    legacySignatures: [
      "mcp/dove-claude-project.json",
      ".mcp.json",
      ".claude/settings.json",
      ".claude/rules/dove.md",
      ".claude/skills/dove-intake/SKILL.md"
    ]
  }
];

function freezeHostDefinition(definition) {
  return Object.freeze({
    ...definition,
    capabilities: Object.freeze({ ...definition.capabilities }),
    legacySignatures: Object.freeze([...definition.legacySignatures])
  });
}

export const HOST_REGISTRY = Object.freeze(Object.fromEntries(
  HOST_DEFINITIONS.map((definition) => [definition.id, freezeHostDefinition(definition)])
));

export const DEFAULT_INITIALIZABLE_HOSTS = Object.freeze(
  PROJECT_HOST_IDS.filter((hostId) => HOST_REGISTRY[hostId].projectInitializable)
);

function selectionValues(raw) {
  if (raw === undefined || raw === null) return [];
  if (typeof raw === "string") return [raw];
  if (!Array.isArray(raw)) throw new Error("Host selection must be a host id or an array of host ids.");
  return raw;
}

function defaultSelection(defaultWhenEmpty) {
  if (defaultWhenEmpty === false || defaultWhenEmpty === null) return [];
  if (defaultWhenEmpty === true || defaultWhenEmpty === undefined) return [...DEFAULT_INITIALIZABLE_HOSTS];
  return selectionValues(defaultWhenEmpty);
}

export function requireNativeReviewerHost(hostId) {
  if (typeof hostId !== "string" || !hostId.trim() || !HOST_REGISTRY[hostId]?.capabilities.nativeReviewer) {
    throw new Error(`Host ${String(hostId)} does not support a dedicated native Reviewer launch.`);
  }
  const host = HOST_REGISTRY[hostId];
  if (!host.capabilities.reviewerFreshContext || !host.capabilities.reviewerReadOnly || !host.capabilities.reviewerSynchronous) {
    throw new Error(`Host ${hostId} does not satisfy the dedicated Reviewer launch contract.`);
  }
  return host;
}

export function normalizeHostSelection(raw, options = {}) {
  const requested = selectionValues(raw);
  const source = requested.length > 0 ? requested : defaultSelection(options.defaultWhenEmpty);
  for (const hostId of source) {
    if (typeof hostId !== "string" || !hostId || hostId !== hostId.trim()) {
      throw new Error(`Invalid Dove project host id: ${String(hostId)}.`);
    }
  }

  const expanded = source.includes("all") ? PROJECT_HOST_IDS : source;
  const unknown = [...new Set(expanded.filter((hostId) => !PROJECT_HOST_IDS.includes(hostId)))];
  if (unknown.length > 0) throw new Error(`Unknown Dove project host(s): ${unknown.join(", ")}.`);

  const selected = PROJECT_HOST_IDS.filter((hostId) => expanded.includes(hostId));
  if (options.requireInitializable === true) {
    const unavailable = selected.filter((hostId) => !HOST_REGISTRY[hostId].projectInitializable);
    if (unavailable.length > 0) {
      throw new Error(`Dove project initialization is not available for host(s) without complete project MCP registration: ${unavailable.join(", ")}.`);
    }
  }
  return Object.freeze(selected);
}

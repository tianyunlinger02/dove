export const PROJECT_HOST_IDS = Object.freeze(["claude", "dsh"]);

const HOST_DEFINITIONS = [
  {
    id: "claude",
    label: "Claude Code",
    order: 0,
    projectInitializable: true,
    capabilities: { commandAdapters: true, projectHooks: true, sharedInstructions: false },
    legacySignatures: [
      "mcp/dove-claude-project.json",
      ".mcp.json",
      ".claude/settings.json",
      ".claude/rules/dove.md",
      ".claude/agents/dove.md",
      ".claude/skills/dove-intake/SKILL.md"
    ]
  },
  {
    id: "dsh",
    label: "DeepSeek Harness (dsh)",
    order: 1,
    projectInitializable: true,
    capabilities: { commandAdapters: true, projectHooks: false, sharedInstructions: false },
    legacySignatures: [".dsh/skills/dove-status/SKILL.md"]
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

export const DEFAULT_INITIALIZABLE_HOSTS = Object.freeze(["claude"]);

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

export function normalizeHostSelection(raw, options = {}) {
  const requested = selectionValues(raw);
  const source = requested.length > 0 ? requested : defaultSelection(options.defaultWhenEmpty);
  for (const hostId of source) {
    if (typeof hostId !== "string" || !hostId || hostId !== hostId.trim()) {
      throw new Error(`Invalid Dove project host id: ${String(hostId)}.`);
    }
    if (hostId === "all") throw new Error("Dove host selection accepts only claude or dsh; 'all' is not supported.");
  }

  const unknown = [...new Set(source.filter((hostId) => !PROJECT_HOST_IDS.includes(hostId)))];
  if (unknown.length > 0) throw new Error(`Unknown Dove project host(s): ${unknown.join(", ")}.`);

  const selected = PROJECT_HOST_IDS.filter((hostId) => source.includes(hostId));
  if (options.requireInitializable === true) {
    const unavailable = selected.filter((hostId) => !HOST_REGISTRY[hostId].projectInitializable);
    if (unavailable.length > 0) {
      throw new Error(`Dove project initialization is not available for host(s): ${unavailable.join(", ")}.`);
    }
  }
  return Object.freeze(selected);
}

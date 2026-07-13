const value = (name, options = {}) => ({ name, kind: "value", ...options });
const boolean = (name, options = {}) => ({ name, kind: "boolean", ...options });
const aliases = (key, names, options = {}) => names.map((name) => value(name, { key, ...options }));

const outputOptions = [boolean("--json"), value("--format")];
const mutationOptions = [value("--mutation-mode"), ...outputOptions];
const taskTargetOptions = [
  ...aliases("packet-target-id", ["--packet-id", "--task-packet-id", "--mission-packet-id", "--task-id"]),
  value("--target"), value("--packet-target"), value("--task-name")
];
const missionOptions = [
  value("--proposal-token"), value("--proposal-digest"), value("--mutation-mode"), ...outputOptions,
  ...aliases("mission-id", ["--id", "--packet-id", "--task-id"]),
  value("--goal"), ...aliases("domain", ["--domain", "--dove-domain", "--mission-domain"]),
  ...aliases("stage", ["--stage", "--mission-stage"]),
  ...aliases("artifact", ["--artifact", "--target-artifact", "--artifact-path", "--target"], { repeatable: true }),
  ...aliases("acceptance-check", ["--acceptance-check", "--check"], { repeatable: true }), value("--next-command"),
  boolean("--confirmed"), boolean("--yes")
];
const evidenceOptions = [
  ...aliases("validation-evidence", ["--validation-evidence", "--validation-evidence-path", "--evidence", "--evidence-path"], { repeatable: true }),
  ...aliases("changed-file", ["--changed-file", "--changed-file-path", "--changed-path"], { repeatable: true }),
  ...aliases("test-evidence", ["--test-evidence", "--test-evidence-path", "--test-path"], { repeatable: true }),
  ...aliases("validation-output", ["--validation-output", "--validation-output-path", "--validation-log", "--test-output"], { repeatable: true }),
  ...aliases("validation-output-text", ["--validation-output-text", "--test-output-text"], { repeatable: true }),
  ...aliases("review-evidence", ["--review-evidence", "--review-evidence-path"], { repeatable: true })
];
const isolatedOptions = [
  value("--run-id"), value("--scope"), value("--instructions"), value("--mediator-role"), value("--reviewer-role"),
  value("--artifact", { repeatable: true }), value("--mutation-mode"), ...outputOptions
];

function command(options = [], positional = { min: 0, max: 1 }) {
  return { options, positional };
}

export const CLI_COMMAND_SPECS = {
  install: command([boolean("--force"), ...aliases("host", ["--host", "--platform"], { repeatable: true }), value("--mutation-mode"), ...outputOptions]),
  sync: command([boolean("--force"), ...aliases("host", ["--host", "--platform"], { repeatable: true }), value("--mutation-mode"), ...outputOptions]),
  doctor: command([...mutationOptions]),
  onboard: command([boolean("--write-map"), value("--max-depth"), value("--max-files"), value("--exclude-dir", { repeatable: true }), ...mutationOptions]),
  init: command([value("--title"), value("--goal"), value("--objective"), value("--summary"), ...aliases("domain", ["--domain", "--dove-domain"]), ...mutationOptions]),
  orchestrate: command([...missionOptions, value("--request"), value("--user-request"), boolean("--allow-autonomy")]),
  mission: command(missionOptions),
  status: command([
    value("--intent"), ...aliases("domain", ["--domain", "--dove-domain", "--mission-domain"]), ...aliases("stage", ["--stage", "--mission-stage"]),
    ...aliases("packet", ["--packet-id", "--packet", "--mission-packet-id", "--mission-packet"], { repeatable: true }),
    ...aliases("status", ["--status", "--lifecycle-status"], { repeatable: true }), ...aliases("detail", ["--detail", "--view", "--result-mode"]),
    value("--format"), boolean("--contract-test"), boolean("--health"), boolean("--include-archived"), boolean("--full"),
    boolean("--include-details"), boolean("--missions"), boolean("--show-missions"), boolean("--include-mission-details"),
    boolean("--request-status-adjustment"), boolean("--status-adjustment"), boolean("--show-status-adjustments"),
    boolean("--include-status-adjustment-preview"), boolean("--json"), boolean("--help", { key: "help" }), boolean("-h", { key: "help" })
  ]),
  statusline: command([
    value("--intent"), ...aliases("domain", ["--domain", "--dove-domain", "--mission-domain"]), ...aliases("stage", ["--stage", "--mission-stage"]),
    ...aliases("packet", ["--packet-id", "--packet", "--mission-packet-id", "--mission-packet"], { repeatable: true }),
    ...aliases("status", ["--status", "--lifecycle-status"], { repeatable: true }), ...aliases("detail", ["--detail", "--view", "--result-mode"]),
    value("--format"), boolean("--contract-test"), boolean("--health"), boolean("--include-archived"), boolean("--full"), boolean("--include-details"),
    boolean("--missions"), boolean("--show-missions"), boolean("--include-mission-details"), boolean("--request-status-adjustment"),
    boolean("--status-adjustment"), boolean("--show-status-adjustments"), boolean("--include-status-adjustment-preview"), boolean("--json")
  ]),
  audit: command([...missionOptions, value("--scope"), ...evidenceOptions]),
  return: command([...missionOptions, value("--scope"), ...evidenceOptions]),
  launch: command([
    ...missionOptions, value("--source-type"), value("--source-id"), value("--actor-role"), value("--worker-role"), value("--dove-worker-role"),
    value("--follow-through-id"), value("--conversion-path"), value("--title"),
    value("--summary"), value("--assigned-role"), value("--lifecycle-status"), value("--current-focus"), value("--next-action"),
    value("--dependency", { repeatable: true }), ...aliases("evidence-link", ["--evidence", "--evidence-link"], { repeatable: true }),
    ...aliases("output-path", ["--output", "--output-path"], { repeatable: true }), value("--program-id"), value("--program-run-id"),
    value("--approval-id"), value("--allowed-step-type"), value("--decision-summary"), value("--rationale"), value("--execute-by"), value("--review-after")
  ]),
  auto: command([
    ...taskTargetOptions, value("--proposal-token"), value("--mutation-mode"), ...outputOptions, value("--goal"), value("--prompt"), value("--objective"),
    ...aliases("domain", ["--domain", "--dove-domain", "--mission-domain"]), ...aliases("stage", ["--stage", "--mission-stage"]),
    ...aliases("artifact", ["--artifact", "--artifact-path"], { repeatable: true }), value("--max-iterations"), value("--max-steps"), value("--steps-json"),
    value("--run-id"), boolean("--confirmed")
  ]),
  operator: command([value("--mutation-mode"), ...outputOptions, value("--blocker-investigation-mode"), value("--task-results-json"), value("--run-id"), boolean("--confirmed"), boolean("--include-queue-details"), boolean("--create-blocked-investigations")]),
  lessons: command([...taskTargetOptions, value("--title"), value("--problem"), value("--decision", { repeatable: true }), value("--pitfall", { repeatable: true }), value("--validation", { repeatable: true }), value("--next-time", { repeatable: true }), value("--tag", { repeatable: true }), ...aliases("domain", ["--domain", "--dove-domain"]), value("--status"), value("--limit"), ...mutationOptions]),
  version: command([value("--title"), value("--reason"), value("--summary"), ...aliases("version-id", ["--version-id", "--id"]), ...mutationOptions]),
  source: command([
    ...taskTargetOptions, value("--source-id"), value("--citation-key"), value("--title"), ...aliases("locator", ["--locator", "--url", "--doi"]),
    value("--source-type"), value("--origin"), value("--abstract"), value("--year"), value("--author", { repeatable: true }),
    value("--decision"), value("--method"), value("--checked-material"), value("--audit-evidence-json"), ...mutationOptions
  ], { min: 0, max: 2 }),
  note: command([...taskTargetOptions, value("--note-id"), value("--title"), value("--section-id"), value("--summary"), value("--quote", { repeatable: true }), value("--claim", { repeatable: true }), value("--open-question", { repeatable: true }), value("--source-id", { repeatable: true }), ...mutationOptions]),
  draft: command([...taskTargetOptions, value("--section-id"), value("--title"), value("--body"), value("--summary"), value("--status"), ...mutationOptions]),
  experience: command([...taskTargetOptions, ...aliases("experiment-id", ["--id", "--experiment-id"]), value("--title"), value("--goal"), value("--idea"), ...aliases("methodology", ["--methodology", "--method"]), ...aliases("success-metric", ["--success-metric", "--metric"]), value("--claim-id"), value("--outcome"), value("--result-summary"), value("--summary"), ...aliases("evidence", ["--evidence", "--evidence-link", "--artifact-path"], { repeatable: true }), ...aliases("comparison", ["--comparison-target", "--baseline"], { repeatable: true }), ...mutationOptions]),
  figure: command([...taskTargetOptions, value("--intent"), value("--description"), value("--name"), value("--title"), value("--figure-id"), value("--purpose"), value("--caption-intent"), ...aliases("claim-id", ["--target-claim-id", "--claim-id"], { repeatable: true }), ...aliases("section", ["--source-section", "--section-id"], { repeatable: true }), ...aliases("source-artifact", ["--source-artifact-path", "--artifact-path"], { repeatable: true }), ...aliases("experiment", ["--related-experiment-id", "--experiment-id"], { repeatable: true }), value("--review-concern-id", { repeatable: true }), value("--rebuttal-issue-id", { repeatable: true }), value("--required-visual-element", { repeatable: true }), value("--material-hint", { repeatable: true }), value("--provider-id"), value("--run-id"), value("--output-format"), value("--constraint", { repeatable: true }), value("--output-manifest-path"), value("--source-svg-path"), value("--target-final-svg-path"), value("--svg-content"), value("--caption"), value("--caption-draft"), value("--caption-id"), boolean("--execute-provider"), boolean("--allow-missing-materials"), ...mutationOptions]),
  review: command([...taskTargetOptions, value("--scope"), value("--stage"), value("--reviewer"), ...aliases("artifact", ["--artifact", "--artifact-path"], { repeatable: true }), value("--reviewed-artifact-path", { repeatable: true }), ...mutationOptions]),
  "review-loop": command([...taskTargetOptions, value("--run-id"), value("--scope"), value("--instructions"), value("--stage"), value("--summary"), ...aliases("artifact", ["--artifact", "--artifact-path"], { repeatable: true }), value("--reviewed-artifact-path", { repeatable: true }), value("--max-iterations"), value("--draft-body"), value("--section-id"), value("--experience-goal"), value("--final-plan"), value("--final-plan-path"), value("--final-result"), value("--final-result-path"), ...mutationOptions]),
  rebuttal: command([...taskTargetOptions, ...aliases("issue", ["--issue", "--reviewer-issue"], { repeatable: true }), value("--title"), value("--summary"), boolean("--issues-only"), boolean("--strategy-only"), ...mutationOptions]),
  "isolated-review-prepare": command(isolatedOptions),
  "isolated-review-import": command([value("--run-id"), value("--handoff"), value("--report"), ...mutationOptions]),
  "isolated-review": command([...isolatedOptions, value("--reviewer-command")]),
  "publish-status": command([boolean("--include-archived"), ...aliases("language", ["--response-language", "--language"]), boolean("--quiet"), ...mutationOptions]),
  "publish-global-status": command([value("--project", { repeatable: true }), value("--output"), ...aliases("language", ["--response-language", "--language"]), value("--generated-at"), boolean("--refresh"), boolean("--include-config"), boolean("--include-archived"), boolean("--quiet"), ...mutationOptions], { min: 0, max: Infinity }),
  "serve-global-status": command([value("--project", { repeatable: true }), value("--output"), ...aliases("language", ["--response-language", "--language"]), value("--generated-at"), ...aliases("auth-user", ["--auth-user", "--auth-username"]), value("--auth-password-env"), ...aliases("domain", ["--domain", "--hostname"]), value("--port"), value("--host"), value("--tunnel-name"), value("--cloudflared-path"), value("--cloudflare-config"), value("--credentials-file"), value("--token-env"), value("--dns-resolver-addrs", { repeatable: true }), boolean("--refresh"), boolean("--include-config"), boolean("--include-archived"), boolean("--no-auth"), boolean("--auth"), boolean("--no-cloudflare"), boolean("--cloudflare"), boolean("--configure-cloudflare"), boolean("--dry-run"), boolean("--quiet"), ...mutationOptions], { min: 0, max: Infinity })
};

function optionMap(spec) {
  const map = new Map();
  for (const option of spec.options) {
    if (map.has(option.name)) throw new Error(`Duplicate CLI option spec: ${option.name}`);
    map.set(option.name, option);
  }
  return map;
}

export function parseDoveCli(argv, specs = CLI_COMMAND_SPECS) {
  const tokens = Array.from(argv ?? [], (item) => String(item));
  if (tokens.length === 0) return { command: null, positionals: [], args: [] };
  const commandName = tokens.shift();
  if (["help", "--help", "-h"].includes(commandName)) return { command: commandName, positionals: [], args: [] };
  const spec = specs[commandName];
  if (spec && tokens.some((token) => token === "--help" || token === "-h")) {
    return { command: commandName, positionals: [], args: ["--help"] };
  }
  if (!spec) return { command: commandName, positionals: tokens, args: [] };
  const options = optionMap(spec);
  const args = [];
  const positionals = [];
  const seen = new Map();
  let separated = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const raw = tokens[index];
    if (!separated && raw === "--") {
      separated = true;
      continue;
    }
    if (separated || !raw.startsWith("-")) {
      positionals.push(raw);
      continue;
    }
    const equalsIndex = raw.indexOf("=");
    const name = equalsIndex > 0 ? raw.slice(0, equalsIndex) : raw;
    const inlineValue = equalsIndex > 0 ? raw.slice(equalsIndex + 1) : null;
    const option = options.get(name);
    if (!option) throw new Error(`Unknown or unsupported CLI argument: ${name}.`);
    const key = option.key ?? option.name;
    const count = seen.get(key) ?? 0;
    if (count > 0 && !option.repeatable) throw new Error(`${name} may be provided only once.`);
    seen.set(key, count + 1);
    if (option.kind === "boolean") {
      if (inlineValue !== null) throw new Error(`${name} does not accept a value.`);
      args.push(name);
      continue;
    }
    let optionValue = inlineValue;
    if (optionValue === null) {
      const next = tokens[index + 1];
      const nextName = next?.split("=", 1)[0];
      if (next === undefined || next === "--" || options.has(nextName)) throw new Error(`${name} requires a value.`);
      optionValue = next;
      index += 1;
    }
    if (optionValue === "") throw new Error(`${name} requires a value.`);
    args.push(name, optionValue);
  }
  const { min = 0, max = 0 } = spec.positional ?? {};
  if (positionals.length < min) throw new Error(`${commandName} requires ${min} positional argument(s).`);
  if (positionals.length > max) throw new Error(`${commandName} accepts at most ${max} positional argument(s).`);
  return { command: commandName, positionals, args };
}

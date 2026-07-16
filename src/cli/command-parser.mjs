const value = (name, options = {}) => ({ name, kind: "value", ...options });
const boolean = (name, options = {}) => ({ name, kind: "boolean", ...options });

const outputOptions = [boolean("--json"), value("--format")];
const mutationOptions = [value("--mutation-mode"), ...outputOptions];
const missionOptions = [
  value("--proposal-token"), value("--proposal-digest"), value("--mutation-mode"), ...outputOptions,
  value("--mission-id"), value("--goal"), value("--scope", { repeatable: true }),
  value("--out-of-scope", { repeatable: true }), value("--target-artifact", { repeatable: true }),
  value("--expected-artifact", { repeatable: true }), value("--completion-criterion", { repeatable: true }),
  value("--evidence-requirement", { repeatable: true }), value("--depends-on-mission-id", { repeatable: true }),
  value("--supersedes-mission-id"), boolean("--confirmed")
];
const receiptOptions = [
  value("--input"), value("--receipt-id"), value("--mission-id"), value("--contract-digest"),
  value("--summary"), value("--artifact-json", { repeatable: true }), value("--validation-json", { repeatable: true }),
  value("--criterion-json", { repeatable: true }), value("--produced-at"), ...mutationOptions
];
function command(options = [], positional = { min: 0, max: 1 }) {
  return { options, positional };
}

export const CLI_COMMAND_SPECS = {
  install: command([boolean("--force"), value("--host", { repeatable: true }), value("--platform", { repeatable: true }), value("--mutation-mode"), ...outputOptions]),
  sync: command([boolean("--force"), value("--host", { repeatable: true }), value("--platform", { repeatable: true }), value("--mutation-mode"), ...outputOptions]),
  doctor: command([...outputOptions]),
  init: command([value("--goal"), boolean("--archive-reset"), boolean("--confirmed"), value("--proposal-token"), value("--proposal-digest"), ...mutationOptions]),
  mission: command(missionOptions),
  receipt: command(receiptOptions),
  status: command([value("--detail"), value("--result-mode"), value("--format"), boolean("--full"), boolean("--missions"), boolean("--json"), boolean("--help", { key: "help" }), boolean("-h", { key: "help" })]),
  lessons: command([value("--lesson-id"), value("--mission-id"), value("--scope"), value("--kind"), value("--summary"), value("--details"), value("--next-time-guidance", { repeatable: true }), value("--source-id", { repeatable: true }), value("--note-id", { repeatable: true }), value("--artifact", { repeatable: true }), value("--applies-to-artifact", { repeatable: true }), value("--tag", { repeatable: true }), value("--supersedes-lesson-id"), boolean("--include-superseded"), boolean("--include-unscoped"), value("--limit"), value("--proposal-token"), value("--mutation-mode"), boolean("--confirmed"), ...outputOptions], { min: 0, max: 2 }),
  version: command([value("--mission-id"), value("--version-id"), value("--label"), value("--artifact", { repeatable: true }), value("--supersedes-version-id"), value("--from-version-id"), value("--to-version-id"), boolean("--finalize"), ...mutationOptions]),
  source: command([value("--mission-id"), value("--source-id"), value("--citation-key"), value("--title"), value("--locator"), value("--source-type"), value("--origin"), value("--abstract"), value("--year"), value("--author", { repeatable: true }), value("--capture-path"), value("--method"), value("--checked-material"), value("--audit-evidence-json"), ...mutationOptions], { min: 0, max: 2 }),
  note: command([value("--mission-id"), value("--note-id"), value("--title"), value("--summary"), value("--quote", { repeatable: true }), value("--claim", { repeatable: true }), value("--open-question", { repeatable: true }), value("--source-id", { repeatable: true }), value("--artifact", { repeatable: true }), ...mutationOptions]),
  draft: command([value("--mission-id"), value("--draft-id"), value("--title"), value("--body"), value("--summary"), value("--evidence", { repeatable: true }), value("--artifact", { repeatable: true }), boolean("--metadata-only"), ...mutationOptions]),
  experience: command([value("--mission-id"), value("--experiment-id"), value("--title"), value("--goal"), value("--hypothesis"), value("--protocol"), value("--success-criterion", { repeatable: true }), value("--comparison-target", { repeatable: true }), value("--result"), value("--result-evidence", { repeatable: true }), value("--audit-finding", { repeatable: true }), value("--integrity-flag", { repeatable: true }), value("--claim-id"), value("--bridge-reason"), ...mutationOptions]),
  figure: command([value("--mission-id"), value("--figure-id"), value("--intent"), value("--purpose"), value("--material", { repeatable: true }), value("--prompt"), value("--output-path"), value("--output-sha256"), value("--caption"), value("--qa-finding", { repeatable: true }), ...mutationOptions]),
  review: command([value("--mission-id"), value("--exchange-id"), value("--review-id"), value("--policy"), value("--artifact", { repeatable: true }), value("--final-plan", { repeatable: true }), value("--final-result", { repeatable: true }), boolean("--preflight"), boolean("--prepare"), boolean("--import"), boolean("--verify-coverage"), boolean("--require-authoritative"), ...mutationOptions]),
  rebuttal: command([value("--mission-id"), value("--issue-json", { repeatable: true }), value("--strategy"), value("--response-json", { repeatable: true }), boolean("--issues-only"), boolean("--strategy-only"), ...mutationOptions])
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
  if (spec && tokens.some((token) => token === "--help" || token === "-h")) return { command: commandName, positionals: [], args: ["--help"] };
  if (!spec) return { command: commandName, positionals: tokens, args: [] };
  const options = optionMap(spec);
  const args = [];
  const positionals = [];
  const seen = new Map();
  let separated = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const raw = tokens[index];
    if (!separated && raw === "--") { separated = true; continue; }
    if (separated || !raw.startsWith("-")) { positionals.push(raw); continue; }
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

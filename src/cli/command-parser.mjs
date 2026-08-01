const value = (name, options = {}) => ({ name, kind: "value", ...options });
const boolean = (name, options = {}) => ({ name, kind: "boolean", ...options });

const projectOption = value("--project");
const outputOptions = [boolean("--json"), value("--format")];
const businessOutputOptions = [...outputOptions, value("--language")];
const mutationOptions = [value("--mutation-mode"), ...businessOutputOptions];
const missionOptions = [
  projectOption,
  value("--operation"), value("--mission-number"), value("--mission-goal"),
  value("--mode"), value("--goal"), value("--requirement", { repeatable: true }),
  value("--assumption", { repeatable: true }), value("--scope", { repeatable: true }),
  value("--out-of-scope", { repeatable: true }), value("--artifact-json", { repeatable: true }),
  value("--completion-criterion", { repeatable: true }),
  value("--evidence-requirement", { repeatable: true }), value("--depends-on-mission-number", { repeatable: true }),
  value("--parent-mission-number"), value("--branch-kind"), value("--branch-reason"),
  value("--stop-parent-reason"), value("--handoff-artifact", { repeatable: true }),
  value("--requested-disposition"), value("--synthesis"),
  value("--hypothesis-json", { repeatable: true }), value("--route-json", { repeatable: true }),
  value("--open-question-json", { repeatable: true }), value("--evidence-ref", { repeatable: true }),
  value("--reason-code", { repeatable: true }),
  value("--next-action-json"), value("--mutation-mode"), ...businessOutputOptions
];
function command(options = [], positional = { min: 0, max: 1 }) {
  return { options, positional };
}

export const CLI_COMMAND_SPECS = {
  init: command([projectOption, value("--host", { repeatable: true }), ...outputOptions], { min: 0, max: 0 }),
  sync: command([projectOption, value("--host", { repeatable: true }), ...outputOptions], { min: 0, max: 0 }),
  doctor: command([projectOption, ...outputOptions], { min: 0, max: 0 }),
  workspace: command([projectOption, value("--goal"), value("--mainline"), value("--change-reason"), boolean("--archive"), ...mutationOptions], { min: 1, max: 1 }),
  mcp: command([projectOption], { min: 1, max: 1 }),
  hook: command([projectOption], { min: 1, max: 1 }),
  mission: command(missionOptions),
  status: command([projectOption, value("--mission-number"), value("--detail"), ...businessOutputOptions, boolean("--help", { key: "help" }), boolean("-h", { key: "help" })]),
  lessons: command([projectOption, value("--binding"), value("--markdown"), value("--mutation-mode"), ...businessOutputOptions], { min: 0, max: 2 }),
  source: command([projectOption, value("--mission-number"), value("--source-id"), value("--citation-key"), value("--title"), value("--locator"), value("--source-type"), value("--origin"), value("--abstract"), value("--year"), value("--author", { repeatable: true }), value("--capture-path"), value("--method"), value("--checked-material"), value("--audit-evidence-json"), ...mutationOptions], { min: 0, max: 2 }),
  experiment: command([projectOption, value("--mission-number"), value("--experiment-id"), value("--title"), value("--protocol-json"), value("--result-json"), ...mutationOptions]),
  draft: command([projectOption, value("--mission-number"), value("--artifact-path"), value("--reference-path", { repeatable: true }), value("--qa", { repeatable: true }), value("--finding", { repeatable: true }), ...mutationOptions]),
  figure: command([projectOption, value("--mission-number"), value("--artifact-path"), value("--reference-path", { repeatable: true }), value("--caption"), value("--qa", { repeatable: true }), value("--finding", { repeatable: true }), ...mutationOptions]),
  review: command([projectOption, value("--mission-number"), value("--review-mission-binding"), value("--host-kind"), value("--artifact", { repeatable: true }), value("--scope-binding-json"), value("--status"), value("--verdict"), value("--summary"), value("--findings-json"), value("--action-item", { repeatable: true }), value("--report"), value("--provenance-json"), boolean("--scope"), boolean("--archive"), ...mutationOptions]),
  rebuttal: command([projectOption, value("--mission-number"), value("--artifact-path"), value("--reference-path", { repeatable: true }), value("--finding-ref", { repeatable: true }), value("--qa", { repeatable: true }), value("--finding", { repeatable: true }), ...mutationOptions])
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
  if (["help", "--help", "-h", "--version"].includes(commandName)) return { command: commandName, positionals: [], args: [] };
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

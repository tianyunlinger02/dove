const value = (name, options = {}) => ({ name, kind: "value", ...options });
const boolean = (name, options = {}) => ({ name, kind: "boolean", ...options });

const projectOption = value("--project");
const outputOptions = [boolean("--json"), value("--format")];

function command(options = [], positional = { min: 0, max: 0 }, subcommands = null) {
  return subcommands === null ? { options, positional } : { options, positional, subcommands };
}

export const CLI_COMMAND_SPECS = Object.freeze({
  init: command([projectOption, value("--host", { repeatable: true }), ...outputOptions]),
  update: command([projectOption, value("--host", { repeatable: true }), ...outputOptions]),
  reinstall: command([projectOption, ...outputOptions]),
  uninstall: command([projectOption, ...outputOptions]),
  doctor: command([projectOption, ...outputOptions]),
  "export-research": command([projectOption, ...outputOptions]),
  hook: command([projectOption], { min: 1, max: 1 })
});

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
  if (["--help", "--version"].includes(commandName)) {
    if (tokens.length > 0) throw new Error(`${commandName} does not accept additional arguments.`);
    return { command: commandName, positionals: [], args: [] };
  }
  let spec = specs[commandName];
  if (!spec) throw new Error(`Unknown or unsupported Dove command: ${commandName}.`);
  if (spec.subcommands) {
    const subcommandName = tokens[0];
    const subcommandSpec = spec.subcommands[subcommandName];
    if (subcommandSpec) spec = { ...subcommandSpec, positional: { min: 1, max: 1 } };
  }
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

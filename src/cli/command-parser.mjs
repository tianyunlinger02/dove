const value = (name, options = {}) => ({ name, kind: "value", key: optionKey(name), ...options });
const boolean = (name, options = {}) => ({ name, kind: "boolean", key: optionKey(name), ...options });

const projectOption = value("--project");
const hostOption = value("--host", { repeatable: true, commaSeparated: true, dedupe: true, choices: ["claude", "dsh"] });
const outputOptions = [boolean("--json", { conflictsWith: ["--format"] }), value("--format", { choices: ["json"], conflictsWith: ["--json"] })];
const reviewOptions = [projectOption, value("--venue"), value("--material", { repeatable: true }), value("--id"), value("--file"), ...outputOptions];
const runMetricOptions = [value("--metric-name"), value("--direction", { choices: ["min", "max"] }), value("--metric-unit")];
const runBasisOptions = [value("--data"), value("--evaluator"), value("--resource-basis")];
const runBudgetOptions = [value("--wall-time"), value("--timeout-ms"), value("--kill-grace-ms")];
const runStartOptions = [projectOption, value("--id"), value("--group"), ...runBudgetOptions, ...runMetricOptions, ...runBasisOptions, ...outputOptions];
const runStatusOptions = [projectOption, value("--id", { conflictsWith: ["--group"] }), value("--group", { conflictsWith: ["--id"] }), ...outputOptions];
const runResumeOptions = [projectOption, value("--id"), ...outputOptions];
const runFinalizeOptions = [projectOption, value("--id"), ...runMetricOptions, value("--metric-value"), value("--decision"), value("--note"), ...outputOptions];
const runCompareOptions = [projectOption, value("--id", { repeatable: true, conflictsWith: ["--group"] }), value("--group", { conflictsWith: ["--id"] }), ...outputOptions];

function optionKey(name) {
  return String(name).replace(/^--/u, "").replace(/-([a-z0-9])/giu, (_, character) => character.toUpperCase());
}

function command(options = [], extra = {}) {
  return { options, ...extra };
}

export const CLI_COMMAND_SPECS = Object.freeze({
  init: command([projectOption, hostOption, ...outputOptions]),
  update: command([projectOption, hostOption, ...outputOptions]),
  reinstall: command([projectOption, ...outputOptions]),
  uninstall: command([projectOption, ...outputOptions]),
  doctor: command([projectOption, ...outputOptions]),
  review: command([], {
    subcommands: {
      handoff: command(reviewOptions),
      status: command([projectOption, value("--id"), ...outputOptions]),
      resume: command([projectOption, value("--id"), ...outputOptions]),
      rerun: command(reviewOptions),
      import: command(reviewOptions)
    }
  }),
  run: command([], {
    subcommands: {
      start: command(runStartOptions, { passthroughAfterSeparator: true }),
      status: command(runStatusOptions),
      resume: command(runResumeOptions),
      finalize: command(runFinalizeOptions),
      compare: command(runCompareOptions)
    }
  }),
  hook: command([], {
    subcommands: {
      "session-start": command([projectOption]),
      "user-prompt-submit": command([projectOption]),
      statusline: command([projectOption])
    }
  })
});

function optionNameFromToken(raw) {
  const equalsIndex = String(raw).indexOf("=");
  return equalsIndex > 0 ? String(raw).slice(0, equalsIndex) : String(raw);
}

function inlineValueFromToken(raw) {
  const equalsIndex = String(raw).indexOf("=");
  return equalsIndex > 0 ? String(raw).slice(equalsIndex + 1) : null;
}

function jsonRequestedBeforeSeparator(argv) {
  const tokens = Array.from(argv ?? [], (item) => String(item));
  for (let index = 0; index < tokens.length; index += 1) {
    const raw = tokens[index];
    if (raw === "--") break;
    const name = optionNameFromToken(raw);
    const inlineValue = inlineValueFromToken(raw);
    if (name === "--json") return true;
    if (name === "--format") {
      if (inlineValue === "json") return true;
      if (inlineValue === null && tokens[index + 1] === "json") return true;
    }
  }
  return false;
}

function attachJsonRequested(error, jsonRequested) {
  if (error instanceof Error && !Object.hasOwn(error, "jsonRequested")) error.jsonRequested = jsonRequested;
  return error;
}

function optionMap(spec) {
  const map = new Map();
  for (const option of spec.options ?? []) {
    if (map.has(option.name)) throw new Error(`Dove CLI 选项定义重复：${option.name}。`);
    map.set(option.name, option);
  }
  return map;
}

function splitOptionValues(option, rawValue, fail) {
  const values = option.commaSeparated === true
    ? String(rawValue).split(",").map((item) => item.trim()).filter(Boolean)
    : [rawValue];
  if (values.length === 0) fail(`${option.name} 需要一个值。`);
  for (const item of values) {
    if (item === "") fail(`${option.name} 需要一个值。`);
    if (Array.isArray(option.choices) && !option.choices.includes(item)) fail(`${option.name} 只接受 ${formatChoices(option.choices)}。`);
  }
  return values;
}

function rememberOption(seenNames, seenKeys, option) {
  seenNames.set(option.name, (seenNames.get(option.name) ?? 0) + 1);
  seenKeys.set(option.key, (seenKeys.get(option.key) ?? 0) + 1);
}

function conflictSeen(seenNames, seenKeys, conflict) {
  return seenNames.has(conflict) || seenKeys.has(optionKey(conflict));
}

function formatChoices(values) {
  if (values.length <= 2) return values.join(" 或 ");
  return `${values.slice(0, -1).join("、")}，或 ${values.at(-1)}`;
}

function parseTokens(argv, specs, jsonRequested) {
  const fail = (message) => {
    const error = new Error(message);
    error.jsonRequested = jsonRequested;
    throw error;
  };
  const tokens = Array.from(argv ?? [], (item) => String(item));
  const result = (commandName, subcommandName, options, passthrough) => ({
    command: commandName,
    subcommand: subcommandName,
    options,
    passthrough
  });

  if (tokens.length === 0) return result(null, null, {}, []);
  const commandName = tokens.shift();
  if (["--help", "--version"].includes(commandName)) {
    if (tokens.length > 0) fail(`${commandName} 后面不接受其他参数。`);
    return result(commandName, null, {}, []);
  }

  const commandSpec = specs[commandName];
  if (!commandSpec) fail(`Dove 不支持这个命令：${commandName}。`);

  let subcommandName = null;
  let spec = commandSpec;
  if (commandSpec.subcommands) {
    const allowed = formatChoices(Object.keys(commandSpec.subcommands));
    subcommandName = tokens.shift();
    if (!subcommandName || !Object.hasOwn(commandSpec.subcommands, subcommandName)) fail(`${commandName} 只接受这些子命令：${allowed}。`);
    spec = commandSpec.subcommands[subcommandName];
  }

  const optionsByName = optionMap(spec);
  const parsedOptions = {};
  const passthrough = [];
  const positionals = [];
  const seenNames = new Map();
  const seenKeys = new Map();
  let separated = false;
  let separatorSeen = false;

  for (let index = 0; index < tokens.length; index += 1) {
    const raw = tokens[index];
    if (!separated && raw === "--") {
      separated = true;
      separatorSeen = true;
      continue;
    }
    if (separated && spec.passthroughAfterSeparator === true) {
      passthrough.push(raw);
      continue;
    }
    if (separated || !raw.startsWith("-")) {
      positionals.push(raw);
      continue;
    }

    const name = optionNameFromToken(raw);
    const inlineValue = inlineValueFromToken(raw);
    const option = optionsByName.get(name);
    if (!option) fail(`Dove 不支持这个参数：${name}。`);
    for (const conflict of option.conflictsWith ?? []) {
      if (conflictSeen(seenNames, seenKeys, conflict)) fail(`${name} 不能和 ${conflict} 同时使用。`);
    }
    const count = seenKeys.get(option.key) ?? 0;
    if (count > 0 && !option.repeatable) fail(`${name} 只能提供一次。`);
    rememberOption(seenNames, seenKeys, option);

    if (option.kind === "boolean") {
      if (inlineValue !== null) fail(`${name} 不接受值。`);
      parsedOptions[option.key] = true;
      continue;
    }

    let optionValue = inlineValue;
    if (optionValue === null) {
      const next = tokens[index + 1];
      const nextName = next === undefined ? undefined : optionNameFromToken(next);
      if (next === undefined || next === "--" || optionsByName.has(nextName)) fail(`${name} 需要一个值。`);
      optionValue = next;
      index += 1;
    }
    if (optionValue === "") fail(`${name} 需要一个值。`);

    const values = splitOptionValues(option, optionValue, fail);
    if (option.repeatable) {
      const existing = Array.isArray(parsedOptions[option.key]) ? parsedOptions[option.key] : [];
      for (const item of values) {
        if (option.dedupe === true && existing.includes(item)) continue;
        existing.push(item);
      }
      parsedOptions[option.key] = existing;
    } else {
      parsedOptions[option.key] = values[0];
    }
  }

  const qualifiedName = subcommandName ? `${commandName} ${subcommandName}` : commandName;
  if (spec.passthroughAfterSeparator === true && !separatorSeen) fail(`${qualifiedName} 需要在 '--' 后提供要执行的命令。`);
  if (positionals.length > 0) {
    if (spec.passthroughAfterSeparator === true) fail(`${qualifiedName} 的 Dove 选项必须写在 '--' 前；要执行的命令和它的参数只能写在 '--' 后。`);
    fail(`${qualifiedName} 不接受位置参数。`);
  }
  if (spec.passthroughAfterSeparator === true && passthrough.length === 0) fail(`${qualifiedName} 需要在 '--' 后提供要执行的命令。`);

  return result(commandName, subcommandName, parsedOptions, passthrough);
}

export function parseDoveCli(argv, specs = CLI_COMMAND_SPECS) {
  const jsonRequested = jsonRequestedBeforeSeparator(argv);
  try {
    return parseTokens(argv, specs, jsonRequested);
  } catch (error) {
    throw attachJsonRequested(error, jsonRequested);
  }
}

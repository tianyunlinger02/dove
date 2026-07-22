function duplicateKeyError(label, key, path) {
  throw new Error(`${label} must not contain duplicate JSON object keys: ${path === "$" ? key : `${path}.${key}`}.`);
}

export function parseJsonWithoutDuplicateKeys(text, label = "JSON input") {
  if (typeof text !== "string") throw new Error(`${label} must contain valid JSON.`);
  let index = 0;

  function skipWhitespace() {
    while (/\s/u.test(text[index] ?? "")) index += 1;
  }

  function parseString() {
    if (text[index] !== '"') throw new Error(`${label} must contain valid JSON.`);
    const start = index;
    index += 1;
    let escaped = false;
    while (index < text.length) {
      const character = text[index];
      index += 1;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') {
        return JSON.parse(text.slice(start, index));
      }
      if (character.charCodeAt(0) < 0x20) throw new Error(`${label} must contain valid JSON.`);
    }
    throw new Error(`${label} must contain valid JSON.`);
  }

  function parseNumber() {
    const match = text.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u);
    if (!match) throw new Error(`${label} must contain valid JSON.`);
    index += match[0].length;
  }

  function parseArray(path) {
    index += 1;
    skipWhitespace();
    if (text[index] === "]") {
      index += 1;
      return;
    }
    let itemIndex = 0;
    while (true) {
      parseValue(`${path}[${itemIndex}]`);
      itemIndex += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      if (text[index] !== ",") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      skipWhitespace();
    }
  }

  function parseObject(path) {
    index += 1;
    skipWhitespace();
    if (text[index] === "}") {
      index += 1;
      return;
    }
    const keys = new Set();
    while (true) {
      const key = parseString();
      if (keys.has(key)) duplicateKeyError(label, key, path);
      keys.add(key);
      skipWhitespace();
      if (text[index] !== ":") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      parseValue(path === "$" ? `$.${key}` : `${path}.${key}`);
      skipWhitespace();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      if (text[index] !== ",") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      skipWhitespace();
    }
  }

  function parseValue(path) {
    skipWhitespace();
    const character = text[index];
    if (character === "{") parseObject(path);
    else if (character === "[") parseArray(path);
    else if (character === '"') parseString();
    else if (character === "-" || /\d/u.test(character ?? "")) parseNumber();
    else if (text.startsWith("true", index)) index += 4;
    else if (text.startsWith("false", index)) index += 5;
    else if (text.startsWith("null", index)) index += 4;
    else throw new Error(`${label} must contain valid JSON.`);
    skipWhitespace();
  }

  try {
    parseValue("$");
    skipWhitespace();
    if (index !== text.length) throw new Error(`${label} must contain valid JSON.`);
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${label} must not contain duplicate`)) throw error;
    throw new Error(`${label} must contain valid JSON.`);
  }
}

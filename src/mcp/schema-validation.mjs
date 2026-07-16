function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function valueTypeMatches(value, type) {
  if (type === "null") {
    return value === null;
  }
  if (type === "array") {
    return Array.isArray(value);
  }
  if (type === "object") {
    return isPlainObject(value);
  }
  if (type === "integer") {
    return Number.isInteger(value);
  }
  if (type === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  return typeof value === type;
}

function expectedTypeLabel(type) {
  return Array.isArray(type) ? type.join(" or ") : type;
}

function childPath(inputPath, key) {
  return /^[$A-Z_a-z][$0-9A-Z_a-z]*$/u.test(key)
    ? `${inputPath}.${key}`
    : `${inputPath}[${JSON.stringify(key)}]`;
}

function validateSchemaValue(value, schema, inputPath) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return null;
  }

  if (Array.isArray(schema.allOf)) {
    for (const branch of schema.allOf) {
      const error = validateSchemaValue(value, branch, inputPath);
      if (error) {
        return error;
      }
    }
  }

  if (schema.if) {
    const conditionError = validateSchemaValue(value, schema.if, inputPath);
    const branch = conditionError ? schema.else : schema.then;
    if (branch) {
      const error = validateSchemaValue(value, branch, inputPath);
      if (error) {
        return error;
      }
    }
  }

  if (Array.isArray(schema.anyOf)) {
    const errors = schema.anyOf
      .map((branch) => validateSchemaValue(value, branch, inputPath));
    if (errors.every(Boolean)) {
      return errors.at(-1) ?? `${inputPath} does not match any allowed schema.`;
    }
  }

  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf
      .map((branch) => validateSchemaValue(value, branch, inputPath))
      .filter((error) => !error).length;
    if (matches !== 1) {
      return `${inputPath} must match exactly one allowed schema.`;
    }
  }

  if (schema.not && !validateSchemaValue(value, schema.not, inputPath)) {
    return `${inputPath} matches a forbidden schema.`;
  }

  if (schema.const !== undefined && !Object.is(value, schema.const)) {
    return `${inputPath} must equal ${JSON.stringify(schema.const)}.`;
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((item) => Object.is(item, value))) {
    return `${inputPath} must be one of: ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}.`;
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => valueTypeMatches(value, type))) {
      return `${inputPath} must be ${expectedTypeLabel(schema.type)}.`;
    }
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      return `${inputPath} must contain at least ${schema.minLength} character(s).`;
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      return `${inputPath} must contain at most ${schema.maxLength} character(s).`;
    }
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value)) {
      return `${inputPath} does not match the required pattern.`;
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      return `${inputPath} must be at least ${schema.minimum}.`;
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      return `${inputPath} must be at most ${schema.maximum}.`;
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      return `${inputPath} must contain at least ${schema.minItems} item(s).`;
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      return `${inputPath} must contain at most ${schema.maxItems} item(s).`;
    }
    if (schema.items) {
      for (let index = 0; index < value.length; index += 1) {
        const error = validateSchemaValue(value[index], schema.items, `${inputPath}[${index}]`);
        if (error) {
          return error;
        }
      }
    }
  }

  if (isPlainObject(value)) {
    const properties = isPlainObject(schema.properties) ? schema.properties : {};
    if (Array.isArray(schema.required)) {
      const missing = schema.required.find((key) => !Object.hasOwn(value, key));
      if (missing) {
        return `${childPath(inputPath, missing)} is required.`;
      }
    }
    if (schema.additionalProperties === false) {
      const unknown = Object.keys(value).find((key) => !Object.hasOwn(properties, key));
      if (unknown) {
        return `${childPath(inputPath, unknown)} is not allowed.`;
      }
    }
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (!Object.hasOwn(value, key)) {
        continue;
      }
      const error = validateSchemaValue(value[key], propertySchema, childPath(inputPath, key));
      if (error) {
        return error;
      }
    }
  }

  return null;
}

export function assertMcpInputSchema(name, args, schema) {
  const error = validateSchemaValue(args, schema, "$");
  if (error) {
    throw new Error(`${name} input is invalid: ${error}`);
  }
}

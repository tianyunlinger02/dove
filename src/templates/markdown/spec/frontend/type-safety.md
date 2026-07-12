# Type Safety

> Runtime type and schema safety patterns in this JavaScript ESM project.

---

## Overview

The project uses Node.js ESM JavaScript (`.mjs`), not TypeScript. Type safety is achieved through explicit runtime shape checks, schema/default factories, normalizers, validation scripts, and Node test assertions.

Important examples:

- `src/core/schema.mjs` defines versions, role IDs, artifact paths, governance registries, default object factories, and normalizers.
- `bin/dove.mjs` validates JSON artifact shapes in doctor/audit-style code with helpers such as `requireObject`, `requireArray`, and `describeShape`.
- `src/mcp/tool-definitions.mjs` declares JSON-schema-like `inputSchema` objects for MCP tools.
- Tests in `tests/unit/schema.test.mjs` and `tests/integration/mcp-tools.test.mjs` assert schema migrations, exposed paths, tool lists, and governance classification.

---

## Type Organization

- Keep shared constants and shape factories in `src/core/schema.mjs`.
- Keep file IO and fallback/repair behavior in `src/core/workspace.mjs`.
- Keep MCP input shapes in `src/mcp/tool-definitions.mjs` and dispatch in `src/mcp/handlers.mjs`.
- Keep package surface lists in validators/tests when they are part of the public contract, such as `requiredCommands` and `requiredSkills` in `scripts/validate-commands.mjs`.

---

## Validation

Use lightweight runtime validation rather than external type libraries unless the project deliberately adopts one.

Current validation patterns:

```js
function requireObject(value, label, issues) {
  if (!isPlainObject(value)) {
    issues.push(`${label} must be an object (found ${describeShape(value)})`);
    return null;
  }
  return value;
}
```

```js
export function readJson(root, relativePath, fallback) {
  const fullPath = resolvePath(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    return cloneFallback(fallback);
  }
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return repairMalformedJson(root, relativePath, fallback);
  }
}
```

MCP schemas should stay explicit about arrays, objects, strings, booleans, and numbers. Board role strings are workflow routing metadata only; mutation schemas must omit retired governance bypass fields and rely on explicit task, artifact, follow-through, review, and completion contracts.

---

## Common Patterns

- Versioned schema migration: `SCHEMA_VERSION`, `createDefaultState()`, and `normalizeState(...)` keep legacy state loadable.
- Canonical path registry: `ARTIFACT_PATHS` prevents drift between prompts, code, tests, and docs.
- Enumerated surfaces: `ROLE_IDS`, `PIPELINE_STAGE_ORDER`, `GOVERNANCE_GUARDED_MUTATIONS`, `GOVERNANCE_EXEMPT_MUTATIONS`, `GOVERNANCE_READONLY_COMMANDS`, and `GOVERNANCE_READONLY_TOOLS` make contracts testable.
- Shape-specific doctor checks: CLI validation helpers collect readable issue strings instead of throwing at the first malformed artifact.
- Tests assert exact public contracts with `assert.deepEqual` where order matters, as in `tests/integration/mcp-tools.test.mjs`.

---

## Forbidden Patterns

- Do not introduce TypeScript-only syntax into `.mjs` files.
- Do not use unvalidated external/user JSON directly in core mutations; normalize or validate at the boundary.
- Do not add ad hoc artifact path strings when `ARTIFACT_PATHS` should own the path.
- Do not add a public command or MCP tool without updating the registries/tests that make the surface complete.
- Do not silently swallow malformed durable JSON without repair, fallback, or a visible issue in validation output.

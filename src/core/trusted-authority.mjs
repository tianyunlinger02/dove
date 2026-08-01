const capabilities = new WeakMap();

function nonEmpty(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function uniqueStrings(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must contain non-empty strings.`);
  }
  const normalized = value.map((item) => item.trim());
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} must not contain duplicates.`);
  return normalized;
}

export function issueTrustedAuthorityCapability({ kind, issuer, methods, scopes } = {}) {
  const capability = Object.freeze({});
  capabilities.set(capability, Object.freeze({
    kind: nonEmpty(kind, "kind"),
    issuer: nonEmpty(issuer, "issuer"),
    methods: Object.freeze(uniqueStrings(methods, "methods")),
    scopes: Object.freeze(uniqueStrings(scopes, "scopes"))
  }));
  return capability;
}

export function assertTrustedAuthorityCapability(capability, expected = {}) {
  const authority = capabilities.get(capability);
  if (!authority) throw new Error("Trusted authority requires an unforgeable internal issuer capability; public callers cannot self-sign.");
  if (authority.kind !== expected.kind || authority.issuer !== expected.issuer) throw new Error("Trusted authority capability kind or issuer does not match.");
  if (!authority.methods.includes(expected.method)) throw new Error("Trusted authority method exceeds the issuer capability.");
  if (!Array.isArray(expected.scope) || expected.scope.some((item) => !authority.scopes.includes(item))) throw new Error("Trusted authority scope exceeds the issuer capability.");
  return authority;
}

export const DOVE_MCP_PROTOCOL_VERSIONS = Object.freeze([
  "2025-06-18",
  "2025-11-25"
]);
export const DOVE_MCP_PROBE_PROTOCOL_VERSION = DOVE_MCP_PROTOCOL_VERSIONS[0];

export function negotiateDoveMcpProtocol(requestedProtocolVersion) {
  if (!DOVE_MCP_PROTOCOL_VERSIONS.includes(requestedProtocolVersion)) {
    throw new Error(`Unsupported MCP protocol version: ${String(requestedProtocolVersion)}.`);
  }
  return requestedProtocolVersion;
}

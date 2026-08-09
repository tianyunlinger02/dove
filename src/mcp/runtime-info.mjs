import {
  DOVE_MCP_SERVER_NAME
} from "../core/command-manifest.mjs";
import {
  readProjectInstallationManifest
} from "../core/project-installation-manifest.mjs";
import { PROJECT_HOST_IDS } from "../core/host-registry.mjs";
import {
  DOVE_RESEARCH_FORMAT,
  PACKAGE_VERSION
} from "../core/schema.mjs";
import { DOVE_MCP_PROTOCOL_VERSIONS } from "../core/mcp-runtime-identity.mjs";

export {
  DOVE_MCP_PROBE_PROTOCOL_VERSION,
  DOVE_MCP_PROTOCOL_VERSIONS,
  negotiateDoveMcpProtocol
} from "../core/mcp-runtime-identity.mjs";

function semverParts(value) {
  const match = typeof value === "string" ? value.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u) : null;
  return match ? match.slice(1).map(Number) : null;
}

function compareSemverVersions(left, right) {
  const leftParts = semverParts(left);
  const rightParts = semverParts(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] < rightParts[index] ? -1 : 1;
  }
  return 0;
}

export function inspectRunningMcpRuntime(root, negotiatedProtocolVersion) {
  let projectIntegration = null;
  let comparison = {
    state: "project-integration-unavailable",
    remediation: "inspect-project-integration"
  };
  try {
    const manifest = readProjectInstallationManifest(root, { allowPrevious: true, hostIds: PROJECT_HOST_IDS });
    projectIntegration = {
      package: { ...manifest.package },
      integrationVersion: manifest.integrationVersion,
      ownershipVersion: manifest.ownershipVersion,
      installationId: manifest.installationId
    };
    const packageOrder = compareSemverVersions(PACKAGE_VERSION, manifest.package.version);
    comparison = manifest.package.name !== "dove"
      ? { state: "integration-mismatch", remediation: "sync-project-integration" }
      : packageOrder === 0
        ? { state: "current", remediation: "none" }
        : packageOrder === -1
          ? { state: "restart-required", remediation: "restart-host" }
          : { state: "integration-mismatch", remediation: "sync-project-integration" };
  } catch (error) {
    projectIntegration = {
      package: null,
      integrationVersion: null,
      ownershipVersion: null,
      installationId: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
  if (negotiatedProtocolVersion !== null && !DOVE_MCP_PROTOCOL_VERSIONS.includes(negotiatedProtocolVersion)) {
    comparison = {
      state: "protocol-incompatible",
      remediation: "update-host-or-dove"
    };
  }
  return {
    serverInfo: { name: DOVE_MCP_SERVER_NAME, version: PACKAGE_VERSION },
    protocolVersion: negotiatedProtocolVersion,
    supportedProtocolVersions: [...DOVE_MCP_PROTOCOL_VERSIONS],
    researchFormat: DOVE_RESEARCH_FORMAT,
    projectIntegration,
    comparison
  };
}

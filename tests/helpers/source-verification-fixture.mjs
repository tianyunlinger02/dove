import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ARTIFACT_PATHS, sourceIdentityFingerprint } from "../../src/core/index.mjs";

export function seedTrustedSourceVerification(root, sourceId, packetId, options = {}) {
  const sourcesPath = path.join(root, ARTIFACT_PATHS.sources);
  const verificationsPath = path.join(root, ARTIFACT_PATHS.sourceVerifications);
  const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
  const source = (sources.items ?? []).find((item) => item.id === sourceId || item.citationKey === sourceId);
  if (!source) throw new Error(`Unknown fixture source: ${sourceId}`);
  const materialPath = `.dove/evidence/source-material/${source.id}.txt`;
  const fullMaterialPath = path.join(root, materialPath);
  const material = options.material ?? `Captured trusted fixture material for ${source.id}.\n`;
  fs.mkdirSync(path.dirname(fullMaterialPath), { recursive: true });
  fs.writeFileSync(fullMaterialPath, material);
  const materialHash = crypto.createHash("sha256").update(fs.readFileSync(fullMaterialPath)).digest("hex");
  const fingerprint = sourceIdentityFingerprint(source);
  const timestamp = options.checkedAt ?? new Date(0).toISOString();
  source.lifecycle = "verified";
  source.fingerprint = fingerprint;
  source.updatedAt = timestamp;
  sources.version = 2;
  sources.updatedAt = timestamp;
  fs.writeFileSync(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`);
  const verifications = fs.existsSync(verificationsPath)
    ? JSON.parse(fs.readFileSync(verificationsPath, "utf8"))
    : { version: 1, items: [], updatedAt: null };
  const record = {
    id: options.id ?? `fixture-verification-${source.id}`,
    sourceId: source.id,
    packetId,
    fingerprint,
    decision: "verified",
    method: options.method ?? "trusted fixture Reviewer inspected captured source material",
    checkedMaterial: options.checkedMaterial ?? "captured source material and registered identity",
    auditEvidence: options.auditEvidence ?? [{ reference: materialPath, kind: "capture", observation: `Captured material matched ${source.id}.` }],
    checkedAt: timestamp,
    issuer: options.issuer ?? "dove-reviewer",
    issuerRole: options.issuerRole ?? "reviewer",
    provenance: "trusted-internal-transition",
    materialPath,
    materialHash
  };
  verifications.items = [...(verifications.items ?? []).filter((item) => item.id !== record.id), record];
  verifications.updatedAt = timestamp;
  fs.mkdirSync(path.dirname(verificationsPath), { recursive: true });
  fs.writeFileSync(verificationsPath, `${JSON.stringify(verifications, null, 2)}\n`);
  return { source, verification: record };
}

#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RESEARCH_AUTHORITY_OWNERSHIP_MATRIX,
  RESEARCH_AUTHORITY_RECORD_TYPES,
  RESEARCH_CONSTITUTION,
  RESEARCH_CONSTITUTION_EVIDENCE_REQUIREMENTS,
  RESEARCH_CONSTITUTION_GUARANTEE_CLASSES,
  RESEARCH_CONSTITUTION_OWNER_IDS,
  RESEARCH_CONSTITUTION_VERIFICATION_CATEGORIES,
  RESEARCH_CONSTITUTION_VERIFICATION_REQUIREMENTS
} from "../src/core/research-constitution.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/u;
const owners = new Set(RESEARCH_CONSTITUTION_OWNER_IDS);
const evidence = new Set(RESEARCH_CONSTITUTION_EVIDENCE_REQUIREMENTS);
const guarantees = new Set(RESEARCH_CONSTITUTION_GUARANTEE_CLASSES);
const categories = new Set(RESEARCH_CONSTITUTION_VERIFICATION_CATEGORIES);
const verificationRequirements = new Set(RESEARCH_CONSTITUTION_VERIFICATION_REQUIREMENTS);
const forbiddenOwnership = /engineering|command|prose|writing template|reviewer rubric|cutover/iu;

assert.equal(RESEARCH_CONSTITUTION.length, 9, "Research Constitution must contain only the nine cross-domain invariants");
assert.deepEqual(RESEARCH_CONSTITUTION.map((entry) => entry.number), Array.from({ length: 9 }, (_, index) => index + 1));
assert.equal(new Set(RESEARCH_CONSTITUTION.map((entry) => entry.clauseId)).size, 9);
for (const [index, entry] of RESEARCH_CONSTITUTION.entries()) {
  const label = `RESEARCH_CONSTITUTION[${index}]`;
  assert.deepEqual(Object.keys(entry), ["number", "clauseId", "title", "canonicalOwner", "enforcementPoints", "evidenceRequirement", "verificationRequirement", "guaranteeClass", "verification"], `${label} shape`);
  assert.match(entry.clauseId, SAFE_ID, `${label}.clauseId`);
  assert.equal(owners.has(entry.canonicalOwner), true, `${label}.canonicalOwner`);
  assert.equal(evidence.has(entry.evidenceRequirement), true, `${label}.evidenceRequirement`);
  assert.equal(verificationRequirements.has(entry.verificationRequirement), true, `${label}.verificationRequirement`);
  assert.equal(guarantees.has(entry.guaranteeClass), true, `${label}.guaranteeClass`);
  assert.equal(categories.has(entry.verification.category), true, `${label}.verification.category`);
  assert.equal(forbiddenOwnership.test(`${entry.title} ${entry.clauseId} ${entry.enforcementPoints.join(" ")}`), false, `${label} owns non-constitutional workflow concerns`);
  if (/^(?:src|scripts|tests)\//u.test(entry.verification.reference)) {
    const [relativePath] = entry.verification.reference.split("#");
    assert.equal(fs.existsSync(path.join(ROOT, relativePath)), true, `${label} verification reference is missing`);
  }
}

assert.deepEqual(RESEARCH_AUTHORITY_OWNERSHIP_MATRIX.map((entry) => entry.recordType), RESEARCH_AUTHORITY_RECORD_TYPES);
assert.equal(new Set(RESEARCH_AUTHORITY_OWNERSHIP_MATRIX.map((entry) => entry.authorityId)).size, RESEARCH_AUTHORITY_OWNERSHIP_MATRIX.length);
for (const entry of RESEARCH_AUTHORITY_OWNERSHIP_MATRIX) {
  assert.equal(owners.has(entry.canonicalOwner), true, `${entry.recordType} owner must be constitutional`);
  assert.ok(entry.fieldAuthorities.length > 0, `${entry.recordType} needs field authorities`);
}

console.log(JSON.stringify({ status: "passed", clauseCount: RESEARCH_CONSTITUTION.length, authorityRecordCount: RESEARCH_AUTHORITY_OWNERSHIP_MATRIX.length }, null, 2));

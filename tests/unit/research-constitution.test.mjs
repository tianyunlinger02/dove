import test from "node:test";
import assert from "node:assert/strict";

import {
  RESEARCH_AUTHORITY_OWNERSHIP_MATRIX,
  RESEARCH_AUTHORITY_RECORD_TYPES,
  RESEARCH_CONSTITUTION,
  RESEARCH_CONSTITUTION_GUARANTEE_CLASSES
} from "../../src/core/research-constitution.mjs";

test("research constitution is a frozen ordered registry with one stable entry per clause", () => {
  assert.equal(RESEARCH_CONSTITUTION.length, 9);
  assert.deepEqual(RESEARCH_CONSTITUTION.map((entry) => entry.number), Array.from({ length: 9 }, (_, index) => index + 1));
  assert.equal(new Set(RESEARCH_CONSTITUTION.map((entry) => entry.clauseId)).size, 9);
  assert.equal(Object.isFrozen(RESEARCH_CONSTITUTION), true);
  assert.equal(RESEARCH_CONSTITUTION.every((entry) => Object.isFrozen(entry) && Object.isFrozen(entry.enforcementPoints) && Object.isFrozen(entry.verification)), true);
  assert.equal(RESEARCH_CONSTITUTION.every((entry) => RESEARCH_CONSTITUTION_GUARANTEE_CLASSES.includes(entry.guaranteeClass)), true);
});

test("authority ownership matrix covers the seven planned authoritative record families exactly once", () => {
  assert.deepEqual(RESEARCH_AUTHORITY_OWNERSHIP_MATRIX.map((entry) => entry.recordType), RESEARCH_AUTHORITY_RECORD_TYPES);
  assert.equal(new Set(RESEARCH_AUTHORITY_OWNERSHIP_MATRIX.map((entry) => entry.authorityId)).size, RESEARCH_AUTHORITY_OWNERSHIP_MATRIX.length);
  assert.equal(Object.isFrozen(RESEARCH_AUTHORITY_OWNERSHIP_MATRIX), true);
  for (const entry of RESEARCH_AUTHORITY_OWNERSHIP_MATRIX) {
    assert.equal(Object.isFrozen(entry), true);
    assert.ok(entry.fieldAuthorities.length > 0);
    const fields = entry.fieldAuthorities.flatMap((group) => group.fields);
    assert.equal(new Set(fields).size, fields.length, `${entry.recordType} must assign each field once`);
    assert.equal(entry.fieldAuthorities.every((group) => Object.isFrozen(group) && Object.isFrozen(group.fields)), true);
  }
});

const freeze = (value) => {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const item of Array.isArray(value) ? value : Object.values(value)) freeze(item);
  return Object.freeze(value);
};

export const RESEARCH_CONSTITUTION_GUARANTEE_CLASSES = freeze(["hard-invariant", "transition-precondition", "required-assessment"]);
export const RESEARCH_CONSTITUTION_OWNER_IDS = freeze(["research-planner", "evidence-owner", "experiment-owner", "author", "public-report-renderer"]);
export const RESEARCH_CONSTITUTION_EVIDENCE_REQUIREMENTS = freeze(["static-contract-evidence", "current-recorded-evidence", "experiment-record-evidence"]);
export const RESEARCH_CONSTITUTION_VERIFICATION_REQUIREMENTS = freeze(["none"]);
export const RESEARCH_CONSTITUTION_VERIFICATION_CATEGORIES = freeze(["unit-contract-test", "integration-contract-test", "assessment-contract"]);

function clause(number, clauseId, title, canonicalOwner, enforcementPoints, evidenceRequirement, guaranteeClass, category, reference) {
  return freeze({ number, clauseId, title, canonicalOwner, enforcementPoints, evidenceRequirement, verificationRequirement: "none", guaranteeClass, verification: { category, reference } });
}

export const RESEARCH_CONSTITUTION = freeze([
  clause(1, "truth-before-convenience", "真实结果优先于便利叙述", "evidence-owner", ["src/core/research-decisions.mjs", "src/core/completion-gates.mjs"], "current-recorded-evidence", "required-assessment", "assessment-contract", "src/core/research-decisions.mjs"),
  clause(2, "current-evidence-only", "科研判断只使用当前可追溯证据", "evidence-owner", ["src/core/workspace-schema.mjs", "src/core/receipt-ledger.mjs"], "current-recorded-evidence", "hard-invariant", "integration-contract-test", "tests/integration/domain-artifacts.test.mjs"),
  clause(3, "uncertainty-remains-explicit", "不确定性和局限必须显式保留", "author", ["src/core/evidence-contracts.mjs", "src/core/research-decisions.mjs"], "current-recorded-evidence", "hard-invariant", "unit-contract-test", "tests/unit/research-decisions.test.mjs"),
  clause(4, "claim-scope-follows-evidence", "主张范围不得超出当前证据", "author", ["src/core/retained-domain-workflows.mjs", "src/core/workspace-schema.mjs"], "current-recorded-evidence", "hard-invariant", "integration-contract-test", "tests/integration/domain-artifacts.test.mjs"),
  clause(5, "protocol-before-result", "正式实验协议必须先于结果冻结", "experiment-owner", ["src/core/retained-domain-workflows.mjs", "src/core/evidence-contracts.mjs"], "experiment-record-evidence", "transition-precondition", "integration-contract-test", "tests/integration/domain-artifacts.test.mjs"),
  clause(6, "preserve-failures-and-raw-evidence", "失败、分母、偏差和原始证据不得被成功结果覆盖", "experiment-owner", ["src/core/evidence-contracts.mjs", "src/core/workspace-schema.mjs"], "experiment-record-evidence", "hard-invariant", "integration-contract-test", "tests/integration/domain-artifacts.test.mjs"),
  clause(7, "current-reference-integrity", "所有证据引用必须保持当前、同任务或祖先可读且哈希一致", "evidence-owner", ["src/core/domain-artifacts.mjs", "src/core/workspace-schema.mjs"], "current-recorded-evidence", "hard-invariant", "integration-contract-test", "tests/integration/domain-artifacts.test.mjs"),
  clause(8, "authority-is-not-completion", "权威判断与完成证明不得由普通记录、测试或主机返回自动铸造", "public-report-renderer", ["src/core/completion-gates.mjs", "src/core/public-reports.mjs"], "current-recorded-evidence", "hard-invariant", "unit-contract-test", "tests/unit/mcp-public-projection.test.mjs"),
  clause(9, "fail-closed-on-invalid-state", "缺失、陈旧、越权或未知状态必须拒绝而非回退", "research-planner", ["src/core/workspace-schema.mjs", "src/core/mission-graph.mjs"], "static-contract-evidence", "hard-invariant", "integration-contract-test", "tests/integration/workspace-schema.test.mjs")
]);

export const RESEARCH_AUTHORITY_RECORD_TYPES = freeze(["Workspace", "Mission Contract", "ResearchDecision", "Receipt/lineage records", "Experiment records", "Claim records", "Narrative/Public report"]);
function authority(authorityId, recordType, canonicalOwner, authorityScope, mutationAuthority, fieldAuthorities) { return freeze({ authorityId, recordType, canonicalOwner, authorityScope, mutationAuthority, fieldAuthorities }); }
function fields(names, sourceOfTruth, writeAuthority, verificationAuthority) { return freeze({ fields: names, sourceOfTruth, writeAuthority, verificationAuthority }); }
export const RESEARCH_AUTHORITY_OWNERSHIP_MATRIX = freeze([
  authority("authority-workspace", "Workspace", "research-planner", "Owns the current project research mainline, not scientific truth or completion.", ["manage_dove_workspace"], [fields(["mainline", "changeReason", "revision"], "Workspace revision chain", "Explicit Workspace management", "Revision-chain validation")]),
  authority("authority-mission-contract", "Mission Contract", "research-planner", "Owns the bounded work promise but cannot assert execution success.", ["manage_dove_mission", "create_ambient_dove_mission"], [fields(["goal", "requirements", "scope", "artifacts", "completionCriteria", "evidenceRequirements"], "Mission Contract", "Mission materialization", "Current completion gates")]),
  authority("authority-research-decision", "ResearchDecision", "research-planner", "Owns bounded current research judgment without fabricating outcomes.", ["manage_dove_mission"], [fields(["synthesis", "hypotheses", "routes", "openQuestions", "evidenceRefs", "disposition", "nextAction"], "Current research assessment", "Research planner", "Current evidence and decision-chain validation")]),
  authority("authority-receipt-lineage-records", "Receipt/lineage records", "evidence-owner", "Owns recorded execution facts, current artifact ownership, hashes, validation observations, and explicit handoffs; it does not establish scientific truth, independent review, or completion by itself.", ["close_host_outcome", "record_research_outcome", "domain recorders"], [fields(["summary", "artifacts", "validations", "criteriaSatisfied", "producedAt"], "Immutable execution Receipt ledger", "Canonical closure or domain recorder", "Receipt schema, current hash, and mission-binding validation"), fields(["currentOwnership", "history", "handoffs"], "Receipt ledger and explicit artifact handoffs", "Receipt append and approved handoff", "Lineage and handoff validation")]),
  authority("authority-experiment-records", "Experiment records", "experiment-owner", "Owns immutable formal protocol and preserved observed result; it does not mint independent authority.", ["record_dove_experiment"], [fields(["protocol", "protocolDigest"], "Frozen Experiment plan", "Experiment owner before execution", "Protocol digest validation"), fields(["status", "outcome", "measurements", "artifactRefs", "validationRefs", "denominator", "failures", "deviations", "limitations"], "Observed Experiment result", "Experiment owner after execution", "Current evidence and result-digest validation")]),
  authority("authority-claim-records", "Claim records", "author", "Owns bounded wording and uncertainty while referenced evidence remains authoritative for its own content.", ["record_dove_claims"], [fields(["text", "evidenceRefs", "experimentEvidence", "uncertainty", "unsupportedExtensions", "currentAssessment"], "Claim record and current evidence", "Author", "Mechanical current-reference and optional measurement validation")]),
  authority("authority-narrative-public-report", "Narrative/Public report", "public-report-renderer", "May summarize authoritative records but cannot create evidence, decisions, completion, or review authority.", ["query_dove_status", "publicResult"], [fields(["report", "completion", "authority"], "Validated current records", "Public report renderer", "Public projection and completion gates")])
]);

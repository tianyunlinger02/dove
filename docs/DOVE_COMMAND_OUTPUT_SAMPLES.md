# Dove Command Output Samples

This checked source-output document records representative shapes for the 12 public schema 9 host workflows. Separately, the CLI has 16 top-level subcommands; the remaining inventory is 28 MCP tools and 60 generated adapters. Exact ids, hashes, timestamps, and mutation summaries vary by workspace.

## Common rules

- Human-facing text defaults to Chinese; machine fields remain English.
- Every proposal is zero-write until exact replay where confirmation is required.
- Every domain mutation requires explicit `missionId`.
- Domain writes preflight all referenced material and evidence before the first write.
- Successful domain writes include substantive artifacts and a canonical receipt; ownership and lineage are derived from the receipt ledger.
- Unknown or retired packet/target/domain/stage/status/role/policy fields are rejected.

## `dove.init`

```text
/dove:init Initialize this research workspace
```

Representative result:

```json
{
  "status": "needs-confirmation",
  "kind": "init",
  "newSchemaVersion": 9,
  "detectedSchemaState": {
    "state": "absent",
    "detectedSchema": "absent"
  },
  "proposalDigest": "<64 lowercase hex>",
  "confirmation": {
    "required": true,
    "exactReplay": true,
    "proposalDigest": "<same 64 lowercase hex>",
    "mutationMode": "direct-process",
    "proposalToken": "<base64url token>"
  },
  "mutation": {
    "mutationMode": "direct-process",
    "writesApplied": false,
    "paths": []
  }
}
```

Exact confirmation creates only the sealed manifest, project identity, and required directories. Ownership and lineage are later derived from execution receipts.

## `dove.mission`

```text
/dove:mission Validate the retrieval method against the current baseline
```

```json
{
  "status": "needs-confirmation",
  "mission": {
    "schemaVersion": 1,
    "proposalVersion": 1,
    "missionId": "mission-...",
    "contractDigest": "<64 lowercase hex>",
    "goal": "Validate the retrieval method against the current baseline",
    "completionCriteria": ["..."],
    "evidenceRequirements": ["artifact:...", "validation:..."],
    "completionCriterionIds": ["criterion-..."],
    "evidenceRequirementIds": ["evidence-...", "evidence-..."]
  },
  "confirmation": {
    "required": true,
    "proposalDigest": "<64 lowercase hex>",
    "mutationMode": "direct-process",
    "proposalToken": "<base64url token>"
  },
  "mutation": {
    "mutationMode": "direct-process",
    "writesApplied": false,
    "paths": []
  }
}
```

Exact replay persists one mission contract and returns control to the host. Its nonpersisted result includes `executionHandoff` with mission/contract identity, target/expected artifacts, stable criterion/evidence ids, the existing receipt CLI template ending in `--json`, and the existing ingest/assess MCP names.

## `dove.status`

```text
/dove:status
```

```json
{
  "mode": "dove-status-query",
  "query": true,
  "scope": {
    "kind": "minimal-mission-workspace",
    "schemaVersion": 8,
    "missionScope": "explicit",
    "missionId": "mission-..."
  },
  "currentContext": {
    "missionCount": 2,
    "selectedMissionId": "mission-...",
    "receiptCount": 4,
    "sourceCount": 3,
    "domainIntegrity": {
      "artifactCount": 9,
      "staleArtifactCount": 0,
      "stalePaths": []
    }
  },
  "needsAttention": {
    "status": "incomplete",
    "stableGaps": {
      "completion": [],
      "sources": [],
      "domain": [],
      "review": ["trusted-review-issuer-missing"]
    }
  }
}
```

Status is always zero-write and never refreshes or repairs state. Zero missions reports none, one mission is scoped automatically, and multiple missions return `explicit-mission-required` until `missionId` is supplied; scoped gaps cover completion, source, domain, and review.

## `dove.lessons`

```text
/dove:lessons Query method lessons for the current mission
/dove:lessons Record this explicit review insight
```

Representative query:

```json
{
  "status": "ok",
  "missionId": "mission-...",
  "lessonCount": 1,
  "items": [{
    "lessonId": "review-scope-check",
    "scope": "global",
    "kind": "review-insight",
    "summary": "Freeze exact artifact hashes before external review.",
    "assessment": { "current": true }
  }],
  "advisoryOnly": true,
  "writes": []
}
```

Representative record proposal:

```json
{
  "status": "needs-confirmation",
  "lesson": {
    "missionId": "mission-...",
    "scope": "mission",
    "kind": "method"
  },
  "confirmation": {
    "exactReplay": true,
    "exactConfirmationCommand": "node ./bin/dove-package.mjs lessons record ... --confirmed --json"
  },
  "advisoryOnly": true,
  "authority": false,
  "completionEligible": false
}
```

All lessons retain recording-mission provenance. Global scope means broadly applicable, not provenance-free. The five kinds are `preference`, `constraint`, `method`, `failure`, and `review-insight`. Query and record are explicit; there is no automatic capture, automatic recall, transcript import, Trellis write, runtime write, or hidden authority.

## `dove.source`

```text
search_network → host visibly captures ./downloads/paper-a.pdf
/dove:source --mission-id mission-... --source-id paper-a --title "Paper A" --locator https://... --capture-path ./downloads/paper-a.pdf
query_sources
```

```json
{
  "status": "candidate",
  "sourceId": "paper-a",
  "capturedMaterial": {
    "path": ".dove/sources/materials/paper-a.pdf",
    "sha256": "..."
  },
  "positiveVerificationIssued": false
}
```

Search candidates carry a non-authoritative `registrationDraft` and `captureRequiredForEvidence: true`. Public verification can record rejection only; neither search nor registration makes a positive trust claim.

## `dove.note`

```text
/dove:note --mission-id mission-... --note-id finding-a --summary "..." --source-id paper-a
```

The current package records substantive note text from current mission-owned artifacts or current mission notes, plus a receipt-derived ownership/lineage binding. `sourceIds` remain unavailable as eligible note evidence until a trusted positive source verifier exists.

## `dove.experience`

```text
/dove:experience --mission-id mission-... --experiment-id ablation-a --goal "..." --hypothesis "..." --protocol "..." --success-criterion "..."
```

The canonical workflow atomically writes protocol, result evidence when supplied, audit, claim bridge, receipt, ownership, and lineage.

## `dove.draft`

```text
/dove:draft --mission-id mission-... --draft-id methods --body "..." --evidence source:paper-a
```

Draft body must be substantive. Metadata-only mode is explicit and requires an existing mission-owned draft.

## `dove.figure`

```text
/dove:figure --mission-id mission-... --figure-id pipeline --intent "Method overview" --material ./data/results.json --prompt "..."
```

Dove binds materials and prepares/imports declared host-generated output. The result records imported hash, caption, provenance, QA, receipt, ownership, and lineage. Clean diagnostics do not self-issue authoritative validation.

## `dove.review`

```text
/dove:review --mission-id mission-... --artifact .dove/drafts/methods.md --preflight
/dove:review --mission-id mission-... --policy external --artifact .dove/drafts/methods.md --prepare
/dove:review --mission-id mission-... --exchange-id exchange-external-... --review-id methods-review --import
/dove:review --mission-id mission-... --artifact .dove/drafts/methods.md --verify-coverage
```

Review-exchange format v8 operates inside the schema 9 workspace. Its four policies are `local-preflight`, `isolated-selected-artifacts`, `final-plan-results-only`, and `external`; policy controls input scope only. Results name `operation` as `preflight`, `prepare`, or `import`. Preflight maps to zero-write `local-preflight`. Prepare freezes mission, contract digest, exact classified artifact paths/sizes/hashes, set hash, privacy boundary, canonical input/manifest/handoff/report paths, and returns the exact import action. Import rejects tampering, drift, symlinks, aliases, noncanonical paths, cross-mission or cross-scope material, and repeated imports before writing, then returns imported paths and the existing coverage action. Coverage verification is read-only. Imported review material remains non-authoritative, and Dove never launches a reviewer, process, session, subagent, or loop.

## `dove.rebuttal`

```text
/dove:rebuttal --mission-id mission-... --issue-json '{"findingRef":".dove/reviews/review.json#finding-1",...}' --strategy "..." --response-json '{...}'
```

Every issue and response links to a concrete review finding. Strategy and response remain author-side.

## `dove.version`

```text
/dove:version --mission-id mission-... --version-id v2 --artifact .dove/drafts/methods.md
```

Snapshots copy actual artifact contents into immutable version storage. Comparison verifies those copies against current hashes and returns added, removed, and changed paths without writing a comparison artifact.

## Removed public surfaces

`dove.review-loop`, `dove.auto`, `dove.operator`, onboarding, public-status publishing/serving, packet mutation, board, runtime, and navigation commands are not public schema 9 surfaces. `dove.lessons` is public, but retired operator lesson storage and tools are absent. `dove.review` is the mission-bound policy-scoped prepare/import/coverage exchange only; it does not expose packet review, audio review, review-loop, reviewer execution, routing, or caller-minted authority.

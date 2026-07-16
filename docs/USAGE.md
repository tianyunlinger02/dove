# Usage

## Product model

Dove is a local-first mission workflow system for paper, experiment, engineering, and research work.

- **Mission contracts** define one explicit goal and evidence boundary.
- **Advisory lessons** record explicit reusable guidance with recording-mission provenance and mission or global applicability.
- **Domain artifacts** record substantive source, note, claim, experiment, draft, figure, rebuttal, and version work.
- **Canonical execution receipts** bind results to the current mission contract and current file hashes.
- **Artifact ownership and lineage** make mission ownership, derivation, and overwrite authorization explicit.
- **Status and completion** are pure live queries; they never repair, refresh, route, or persist lifecycle state.

Dove should advance real work, not replace it with workflow ceremony. A useful mutation creates or updates a substantive research/paper artifact and records its integrity evidence in the same atomic operation.

## Public commands

Dove exposes exactly 12 flat public commands:

| Command | Use it for |
|---|---|
| `project:dove.init` | Propose and exactly confirm a sealed schema 7 workspace. |
| `project:dove.mission` | Propose and persist one minimal mission contract, then return control to the host. |
| `project:dove.status` | Read schema health, mission/receipt/source counts, and current artifact integrity without writes. |
| `project:dove.lessons` | Explicitly query advisory guidance or explicitly propose and exactly confirm one mission-provenanced lesson. |
| `project:dove.version` | Create immutable mission snapshots, compare snapshots, or request fail-closed finalization. |
| `project:dove.source` | Import captured external material as a mission-bound candidate or record rejection. |
| `project:dove.note` | Write substantive current-evidence notes. |
| `project:dove.figure` | Bind materials and import host-generated figure output with hash, caption, provenance, and QA. |
| `project:dove.experience` | Atomically record experiment protocol, result, audit, claim bridge, or evidence-backed claims. |
| `project:dove.draft` | Write substantive draft text or explicit metadata for an existing mission-owned draft. |
| `project:dove.review` | Preflight current artifacts with zero writes, prepare a frozen mission exchange, or import only its canonical handoff/report as non-authoritative review material. |
| `project:dove.rebuttal` | Normalize concrete review findings and write author-side strategy and evidence-backed responses. |

There is no public packet, board, runtime, navigation, review-loop, operator, auto, onboarding, or public-status publishing command in schema 7. The public lesson command is the new sealed `dove.lessons` surface, not the retired operator lesson system.

## First 10 minutes with Dove

1. Install Dove and run `dove doctor` to check package bundles, adapters, the MCP entrypoint, and workspace schema.
2. Run `/dove:init` with a project goal. Inspect the zero-write proposal and replay the exact confirmation only when approved.
3. Run `/dove:mission` for one concrete goal. Exact confirmation persists only the contract; native host planning and tools perform the work.
4. Use a domain command with explicit `missionId`. Domain writes never infer a packet target or accept packet/target/domain/stage/status/role/policy authority.
5. Use `/dove:status` for a zero-write current integrity view.
6. Use `/dove:version` before a meaningful revision and for immutable comparison/finalization gates.

## Mission contract and receipt model

- `/dove:init` is proposal-first and zero-write. Exact confirmation creates `.dove/manifest.json`, `.dove/project.json`, ownership/lineage indexes, and required schema 7 directories.
- Legacy, malformed, contradictory, or future `.dove` state is never imported, repaired, normalized, or used as a fallback. Explicit `dove init --archive-reset` binds the old tree identity/digest and uses direct-process atomic rename before clean initialization.
- `/dove:mission` accepts goal, scope, out-of-scope, target/expected artifacts, completion criteria, evidence requirements, dependencies, and optional supersession metadata.
- Exact replay is bound to canonical workspace identity, mutation mode, project identity, target artifact identities, stable serialization, proposal version, and contract digest.
- Receipt ingestion binds `missionId`, current `contractDigest`, canonical realpath-contained artifact and validation files, SHA-256 hashes, deterministic criterion coverage, and typed evidence references.
- Completion is derived live. File drift, contract drift, stale source/note evidence, incomplete criterion coverage, or missing authoritative review proof makes completion fail closed.
- Evidence requirement syntax is exact: `artifact:<path>`, `validation:<path>`, `source:<id>`, `note:<id>`, and `review:authoritative`.

## Durable schema 7 workspace

Important public durable surfaces include:

- `.dove/manifest.json` — sealed schema identity.
- `.dove/project.json` — canonical project identity.
- `.dove/missions/<missionId>.json` — confirmed mission contracts.
- `.dove/lessons/<lessonId>.json` — immutable advisory lessons with recording-mission provenance and optional global applicability.
- `.dove/receipts/execution/<receiptId>.json` — immutable canonical execution receipts.
- `.dove/artifacts/ownership.json` — current artifact owner, hash, and receipt binding.
- `.dove/artifacts/lineage.json` — artifact derivation and typed evidence relationships.
- `.dove/sources/` and `.dove/sources/materials/` — mission-bound source records and captured material.
- `.dove/notes/`, `.dove/claims/`, `.dove/experiments/`, `.dove/drafts/`, `.dove/figures/`, `.dove/rebuttal/`, `.dove/versions/` — substantive mission artifacts.

Schema 7 public workflows do not write `.dove/state.json`, `.dove/task-packets`, `.dove/orchestration`, `.dove/runtime`, `.dove/workspace`, or navigation refresh state.

## Domain workflows

### Lessons

`dove.lessons` has two explicit operations: `query` and `record`. Query is the default, is always zero-write, and can filter by lesson id, recording mission, scope, kind, tags, or mission-owned artifact applicability. Artifact filters require an explicit `missionId`.

Every lesson records the mission that produced its provenance. `scope: global` means the guidance may apply across missions; it does not erase or globalize provenance. `scope: mission` limits applicability to the recording mission. The five accepted kinds are `preference`, `constraint`, `method`, `failure`, and `review-insight`.

Record is proposal-first. The proposal is zero-write and confirmation must replay the exact returned token, workspace identity, contract digest, mutation mode, timestamp, content, references, and supersession. Lessons are advisory-only: they grant no authority, satisfy no completion criterion, and cannot be used as mission target artifacts or execution evidence. Dove does not auto-capture lessons, auto-recall them from other commands, ingest transcripts, or write lesson data into Trellis, runtime, navigation, orchestration, or hidden host memory.

### Source

Register concrete captured material with explicit `missionId`, source identity, title, locator, and material path. Dove validates containment and material identity before the first write, imports the material into `.dove/sources/materials/`, hashes it, and creates a candidate source record plus receipt/ownership/lineage.

Public `verify_source` is rejection-only. Positive verification fails closed until a private verifier capability can issue current material- and fingerprint-bound authority.

### Note and claims

Notes must be substantive and cite current typed evidence. Before writing, Dove rechecks current source trust and artifact hashes. Candidate, rejected, drifted, cross-mission, or otherwise ineligible evidence cannot authorize a note or claim.

Claims require evidence. Current audited experiment results must match their audit id and pass state before use.

### Experience

`run_experience_workflow` is the single canonical implementation for protocol, result evidence, audit, and claim bridge. The complete write set is preflighted before any artifact, receipt, ownership, or lineage mutation is applied.

### Draft

Draft writes require a substantive body. Metadata-only updates are explicit and operate only on an existing mission-owned draft. Typed source/note/experiment evidence is revalidated before mutation.

### Figure

Figure providers execute on the host side. Dove prepares or imports only declared materials/output, validates containment, records the imported output hash, caption, provenance, QA, receipt, ownership, and lineage. Clean diagnostics can reach `ready-for-independent-review`; Dove does not self-issue authoritative `validated` state.

### Review

Review uses one schema 7 contract with four input-scope policies: `local-preflight`, `isolated-selected-artifacts`, `final-plan-results-only`, and `external`. Their sealed input boundaries are respectively `read-only-current-workspace`, `selected-artifact-isolation`, `classified-final-plan-results`, and `host-mediated-external-review`; policy never chooses or launches a reviewer. `dove review --preflight` maps to `local-preflight` and is strictly zero-write. `--prepare --policy <policy>` freezes the boundary, exact classified artifact paths, sizes, hashes, artifact-set hash, mission identity, contract digest, privacy boundary, and canonical output paths under `.dove/reviews/exchanges/<exchangeId>/`. `--import --exchange-id <id> --review-id <id>` accepts only those canonical handoff/report leaves and rejects manifest, input, handoff, report, scope, set, or artifact drift; traversal; external symlinks; internal aliases; malformed or cross-scope findings; cross-mission identity; and repeated import before any durable write. `--verify-coverage` is read-only and reports stale or missing exact coverage. The imported review and report become mission-owned artifacts, but public reviewer identity, verdict, report, and handoff fields never issue authoritative Reviewer proof. Dove never launches a reviewer, session, subagent, process, board transition, runtime continuation, or loop.

### Rebuttal

Every normalized issue and response must link to a concrete review finding using `<review-artifact-path>#<finding-id>`. Strategy and response drafting remain author-side. Author-written reports or verdict strings cannot authenticate Reviewer authority.

### Version

A snapshot copies actual current mission artifact contents into an immutable version directory and records hashes and lineage. Comparison validates immutable copies rather than trusting mutable path labels. Finalization requires current completion plus authoritative review proof.

## Network search

Public network search is an explicit retrieval helper. Search output is not trusted evidence by itself. Material must be visibly retrieved, imported through the source workflow, fingerprinted, and pass the applicable trust gate before it can support completion.

Credential-bearing search configuration and arbitrary authorization headers are rejected on the public no-key surface.

## Language configuration

Dove defaults to Chinese user-facing responses. Set `language` to `zh` or `en` in supported configuration, or use the documented process environment override. Machine tokens, command ids, MCP tool names, JSON keys, paths, hashes, and status tokens remain English.

## MCP tools

The MCP server exposes a sealed schema 7 registry for:

- initialization and mission contracts;
- read-only mission/status/completion queries;
- public network search and provider inspection;
- source registration/query/rejection;
- explicit advisory lesson query and exact-confirmation recording;
- notes, claims, experiments, drafts, figures, review prepare/import/coverage verification, rebuttals, and versions;
- canonical execution-receipt ingestion.

The registry contains exactly 27 tools. Every object schema uses `additionalProperties: false`, including nested objects. Mutating tools declare `mutationMode`, all tools declare `resultMode`, and every domain mutation requires explicit `missionId`. Lesson tools are exactly `query_dove_lessons` and `record_dove_lesson`; old operator lesson tool names are absent. Unknown and retired packet/target/domain/stage/status/role/policy fields are rejected.

## Role model

Planner, Builder/Author, and Reviewer are conceptual responsibility boundaries:

- **Planner** defines mission scope and acceptance evidence.
- **Builder/Author** performs substantive work and writes domain artifacts.
- **Reviewer** provides independent findings or authority proof through a trusted boundary.

Schema 7 does not persist role routing, a board, owner transitions, or lifecycle mirrors. Reviewer authority fails closed when no trusted issuer exists.

## Source-checkout validation

These commands are maintainer-only and run from a Dove source checkout:

```bash
npm run commands:generate
npm run build
npm run check
npm run doctor:validate
npm run pack:dry-run
```

`npm run check` validates generated adapters, sealed command/MCP contracts, workflow pressure tests, governance coverage, public module isolation, and the full Node test suite.

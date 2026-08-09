# Capability matrix

## Public surfaces

| Capability | Status | Contract |
|---|---|---|
| Flat Skills | Implemented | Exactly 9: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, and `lessons`. |
| Public MCP tools | Implemented | Exactly 8 sealed research tools. |
| Generated adapters | Implemented | Exactly 45: 9 for each of five host formats. Files on disk do not prove registration or readiness. |
| Runtime CLI | Implemented | Exactly 7 commands: `init`, `sync`, `upgrade`, `reinstall`, `doctor`, `mcp`, and `hook`. Business research writes are not exposed as CLI commands. |
| Research Format 1 | Implemented | Exact marker `dove-research-v1` with Workspace, Mission, Source, Experiment, Claim, Review, and Lessons records. |
| Zero-write views | Implemented | Exactly 9 research projections: overview, diagnosis, related work, hypotheses, experiment options, result synthesis, claim story, branch synthesis, and reviews. |
| Semantic IDs | Implemented | Durable records use explicit stable IDs rather than positional selectors. |
| Public MCP result | Implemented | Human `content` plus `structuredContent` containing `status`, `operation`, and a public `research` projection. |

## Skills

| Skill | Status | Boundary |
|---|---|---|
| `dove.research` | Implemented | Routes Workspace and Mission research, internal synthesis, and bounded project work. It does not create a Mission by default. |
| `dove.status` | Implemented | Reads a current research projection without writes. |
| `dove.source` | Implemented | The host searches and captures external material; Dove records Source context and limits. |
| `dove.experiment` | Implemented | The host designs and runs real experiments; Dove freezes plans, records results, and stores bounded Claims. |
| `dove.draft` | Implemented | The host writes or revises an ordinary project draft from current evidence. |
| `dove.figure` | Implemented | The host gathers materials and creates an ordinary project figure and caption. |
| `dove.review` | Implemented | Prepares and imports a user-managed separate review exchange and checks current coverage. |
| `dove.rebuttal` | Implemented | Keeps rebuttal and revision author-side, using imported findings and current evidence. |
| `dove.lessons` | Implemented | Reads or explicitly replaces one advisory Markdown document without creating a Mission. |

## MCP tools

| Tool | Public role |
|---|---|
| `query_dove_research` | Read one of nine zero-write research views. |
| `manage_dove_workspace` | Initialize Research Format 1 when `.dove/` is absent, or update the current research direction. |
| `manage_dove_missions` | Query, create, branch, or conclude immutable Missions using semantic IDs. |
| `manage_dove_sources` | Query or record captured Sources and related-work relationships. |
| `manage_dove_experiments` | Query, freeze a plan, or record a full Experiment result. Dove does not run the experiment. |
| `manage_dove_claims` | Query or record Claims with support, counter-evidence, missing evidence, uncertainty, and cannot-say boundaries. |
| `manage_dove_reviews` | Run local preflight, prepare an exchange, import a user-obtained return, or inspect coverage. Dove does not launch a reviewer. |
| `manage_dove_lessons` | Read or replace the complete advisory Lessons Markdown. |

## Research semantics

| Capability | Status | Boundary |
|---|---|---|
| Workspace direction | Implemented | Records question, mainline, intended contribution, current focus, and concise change history. No separate revision ledger exists. |
| Mission tree | Implemented | Parent/child and dependency relationships are explicit Mission fields; the tree is a view, not another store. |
| External Sources | Implemented | Captured material can be fingerprinted and classified by exact research relationship. Recording does not establish trust. |
| Experiment plans | Implemented | Protocol, hypotheses, metrics, discriminating observations, cost, risk, failure value, and stop conditions are frozen before a result. |
| Experiment results | Implemented | Positive, negative, null, mixed, failed, and stopped evidence preserves observations, denominators, failures, deviations, limitations, and uncertainty. |
| Claims | Implemented | Exact support is required and every Claim carries explicit cannot-say boundaries. |
| Branch synthesis | Implemented | Exact sibling consensus, conflicts, common unknowns, and anomalies can be projected. Suggestions do not authorize new work. |
| Advisory Lessons | Implemented | One free-form `.dove/LESSONS.md` document; reading is zero-write and replacement writes the complete document. |
| Automatic scientific interpretation | Unavailable | Dove projects records and exact relationships. The host interprets research meaning. |
| Automatic search or experiment execution | Unavailable | The host performs retrieval, analysis, execution, writing, and figure creation with real tools. |
| Scientific certification | Unavailable | Tests, local checks, records, and host statements do not prove scientific correctness or generalization. |

## Review

| Capability | Status | Boundary |
|---|---|---|
| Local preflight | Implemented | Checks an explicit artifact boundary without writes. |
| Frozen exchange package | Implemented | Returns current project-relative paths, byte sizes, and fingerprints for a separate reviewer. |
| Reviewer launch | User-managed | The user chooses and starts the separate reviewer session or person. Dove never launches or impersonates one. |
| Review import | Implemented | Records the structured return and current artifact fingerprints. |
| Coverage verification | Implemented | Detects whether reviewed artifact bytes are still current. |
| Independence or identity proof | Not established | A prompt, agent definition, provenance string, or imported report does not prove reviewer independence, identity, authority, acceptance, or sign-off. |

## Installation and state

| Capability | Status | Boundary |
|---|---|---|
| Exact user installation | Implemented | Installs `dove` on `PATH` from a trusted exact artifact; the bare public npm name is unrelated. |
| Claude project initialization | Implemented | Installs 9 Claude adapters, one Reviewer definition, three ambient resources, MCP/hook fragments, and `.dove/install/manifest.json`. |
| Other host adapters | Packaged | OpenCode, Codex, Cursor, and shared-agent adapters are release artifacts, but their complete project registration path is not provided by 0.7.0 init. |
| Integration sync | Implemented | Refreshes manifest-selected managed integration under the current `.dove/` root. |
| Project Upgrade | Implemented | Refreshes project integration, preserves Research Format 1 byte-for-byte, and cleans a valid legacy `.dove-install/` root. It does not manage user npm. |
| Project Complete Reinstall | Implemented | After exact preview and default-No confirmation, removes Dove state and integration only from the selected project, cleans legacy roots and copied runtimes, and recreates `.dove/install/manifest.json`. It does not manage user npm. |
| Single project-private root | Implemented | `.dove/install/manifest.json` is required after project initialization; Research Format 1 siblings are optional. `.dove-install/` is legacy cleanup input only. |
| Read-only doctor | Implemented | Reports CLI availability, current or legacy integration, connection, shallow research-format state, and copied-runtime state separately. |
| Research Format initialization | Implemented | Adds Research Format 1 beside `.dove/install/` only through `manage_dove_workspace` when research state is absent. |
| Unsupported existing research state | Fail closed | Older, unknown, malformed, symlinked, or incomplete research state is left unchanged. |
| Research migration, reset, import, alias, or fallback | Unavailable | Dove 0.7.0 provides none of these research-state paths; legacy installation/archive cleanup is a separate project lifecycle concern. |

> Release contract: Dove `0.7.0`, Research Format 1 (`dove-research-v1`), 9 Skills, 8 MCP tools, 45 generated adapters, 7 runtime CLI commands, 9 zero-write research views, and a user-managed review exchange.

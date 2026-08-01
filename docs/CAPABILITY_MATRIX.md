# Capability matrix

## Public interaction

| Capability | Status | Contract |
|---|---|---|
| Direct Skills | Implemented | Exactly 12 flat Skills run directly and accept optional text. |
| Canonical MCP | Implemented | Exactly 14 sealed tools implement the structured public boundary. |
| Generated adapters | Implemented | Five host formats contain 12 adapters each, exactly 60 total; presence is not readiness. |
| Root/child Missions | Implemented | Independent goals use roots; continuation and follow-up use children with explicit parent provenance. |
| One-based selection | Implemented | Existing work uses the exact visible `missionNumber` returned by status. |
| Safe output | Implemented | `report` is human-facing; `researchHandoff` and `hostControl` remain machine-only. |
| Work ambient route | Implemented | `dove-intake` chooses explicit `ordinary` or `research`, creates through `create_ambient_dove_mission`, then resumes host work after success. |
| Lessons ambient route | Implemented | Natural read, remember, and reflect requests use `dove-lessons-intake` and `manage_dove_lessons` without creating a Mission. |

## Direct Skills

| Skill | Status | Contract |
|---|---|---|
| `dove.workspace` | Implemented | Inspect the project and establish or replace one concise research mainline. |
| `dove.mission` | Implemented | Create a proportional root/child Mission or reevaluate one current research judgment. |
| `dove.status` | Implemented | Read current Workspace, Mission, evidence, output, Review, and blocker state without writes. |
| `dove.lessons` | Implemented | Read or atomically replace the complete `.dove/LESSONS.md` document. |
| `dove.source` | Implemented | Discover external content, register captured candidates, and record supported rejection. |
| `dove.note` | Implemented | Synthesize internal project material into a normal artifact without a Note store. |
| `dove.experience` | Implemented | Conceive and prevalidate experiments before formal protocol freeze. |
| `dove.experiment` | Implemented | Freeze a protocol or record its full-denominator evidence-backed result. |
| `dove.draft` | Implemented | Write or revise in the project, then archive the current path and references. |
| `dove.figure` | Implemented | Gather materials, draw in the project, then archive with caption and QA. |
| `dove.review` | Implemented | Freeze one scope, run one isolated Reviewer, and archive its structured return. |
| `dove.rebuttal` | Implemented | Perform author-side revision and archive a response with current finding references. |

## MCP tools

| Tool | Public role |
|---|---|
| `manage_dove_workspace` | Establish or replace the Workspace mainline. |
| `manage_dove_mission` | Query, start a Skill Mission, create, branch, or reevaluate a Mission. |
| `query_dove_status` | Read status or assess completion. |
| `manage_dove_sources` | Query, register, or reject Source candidates. |
| `record_dove_experiment` | Freeze a formal protocol or record its immutable result. |
| `record_dove_claims` | Record claims bounded by current evidence and experiment measurements. |
| `record_dove_draft` | Archive a current Mission-owned project draft. |
| `record_dove_figure` | Archive a current project figure with caption and QA. |
| `manage_dove_review` | Freeze scope without writes or archive one isolated Reviewer return. |
| `record_dove_rebuttal` | Archive an author-side response with preserved findings. |
| `manage_dove_lessons` | Read or replace the canonical Lessons Markdown document. |
| `create_ambient_dove_mission` | Create one clear ordinary or research ambient Mission. |
| `close_host_outcome` | Record one ordinary host execution attempt. |
| `record_research_outcome` | Record one research execution attempt without treating it as scientific judgment. |

## Research and artifact boundaries

| Capability | Status | Contract |
|---|---|---|
| Source/Note distinction | Implemented | Source is captured external material; Note is internal synthesis in a normal project artifact. |
| Experience/Experiment distinction | Implemented | Experience precedes formalization; Experiment owns protocol freeze and result recording. |
| Canonical Lessons | Implemented | One `.dove/LESSONS.md` document is advisory-only and updated by read-bound full replacement. |
| Thin Draft/Figure/Rebuttal | Implemented | The host produces the substantive artifact; Dove archives current paths and evidence through Receipts, without mirrors. |
| Isolated Review | Implemented | One fresh read-only Reviewer sees only frozen declared paths and returns findings without edits. |
| Review authority | Not established | Archived Review material cannot mint identity, sign-off, acceptance, or scientific endorsement. |
| Positive Source authority | Not established | Candidate registration and rejection do not mint positive trust. |
| Completion integrity | Implemented | Completion derives live from current artifacts, criteria, evidence, dependencies, and Review; host return or tests alone are insufficient. |

## Installation and state

| Capability | Status | Contract |
|---|---|---|
| Exact user installation | Implemented | Install an exact artifact so `dove` is on `PATH`; no project or global host configuration is written. |
| Claude project integration | Implemented | Init installs 12 Claude adapters, three ambient resources, MCP/hook settings, and a manifest without creating `.dove/`. |
| Canonical Reviewers | Implemented | Dedicated Claude and OpenCode Reviewer definitions are generated from one role source. |
| Manifest-driven sync | Implemented | Sync refreshes only recorded managed integration. |
| Read-only doctor | Implemented | Doctor reports CLI, integration, Workspace, registration, readiness, and copied runtime separately. |
| Schema 18 cutover | Implemented | Current runtime reads Schema 18 only and requires explicit archive replacement for unsupported state. |
| Migration or fallback | Unavailable | There is no state migration, compatibility alias/root, copied-runtime fallback, or alternate execution path. |

> Current release contract: 12 direct Skills, 14 canonical MCP tools, 60 generated adapters, one canonical Lessons document, two hidden Claude ambient routes, and one scope-to-Reviewer-to-archive Review lifecycle.

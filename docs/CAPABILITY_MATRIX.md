# Capability matrix

Dove is one research collaborator. Ordinary Claude conversation is the primary entrance; the optional agent and nine flat Skills add no personas, stages or permissions. The main session owns conversation, execution and adoption. Bounded requests keep their scope.

## Nine capabilities

| Skill | Claude Code | DSH | What it helps with |
|---|---|---|---|
| `dove.research` | Command | Skill | Build body-grounded gaps and cross-field candidates, review them and offer the user a choice; then advance the confirmed mainline. |
| `dove.status` | Command | Skill | Read the card, recent evaluation and brief; report results, core evidence, blockers and round without new work. |
| `dove.source` | Command | Skill | Discover sources, verify citations and claims, and accumulate question-led full-text notes in `papers/<id>.md`. |
| `dove.experiment` | Command | Skill | Develop and evaluate methods through fair comparisons, diagnostics and actual outputs. |
| `dove.draft` | Command | Skill | Group related work from `papers/library.json` and `papers/library.md` by direction, export verified BibTeX and inspect the authoritative build/export. |
| `dove.figure` | Command | Skill | Gather materials, draw, inspect and deliver figures, captions and editable sources. |
| `dove.review` | Command | Skill | Distinguish author self-check, delivery inspection, independent current-paper review and returned opinions. |
| `dove.rebuttal` | Command | Skill | Verify concerns, respond and make requested evidence-backed revisions. |
| `dove.lessons` | Command | Skill | Read or preserve transferable guidance, not another progress log. |

There is no Auto Skill. Project standards govern contribution types. Actual topic selection grounds gaps in body-read near-misses and searches mechanisms according to key unknowns; query and field counts are breadth strategies, not quotas or proof of novelty. The mentor tests novelty and compares changes addressing bottlenecks and shared causes, with evidence and the strongest objection. Parallel generation precedes recommendations for user choice; selection-only limits do not block already-authorized bounded work. See [Usage](USAGE.md#topic-selection-and-original-user-grounding).

## Host support

| Surface | Claude Code | DSH |
|---|---|---|
| Project rule / optional Dove agent | Installed | Not projected |
| `dove-mentor` / `dove-review` | Fresh read-only contexts | Equivalent isolation depends on host tools; no packaged agent service |
| SessionStart / UserPromptSubmit | Read-only context | Not projected |
| Status line | Installed when absent | Not projected |
| Paper-search / Exa MCP | Declarations, not access approval | Not projected |
| Quality/preference essentials and full companions | Four exact resources | Same resources |
| `dove run` receipts | User-installed Node CLI | Same CLI |

Fresh author contexts personally read the two short essentials; full companions are on demand. DSH Status has no author bootstrap. Mentors read quality guidance, not private preferences. Installation does not prove reading or behavior; see [Usage](USAGE.md#short-core-and-two-reference-read-contracts).

## Records and independent judgment

Researcher-owned records preserve goals, version-level evidence, briefs/results and mentor memory. Q&A is reused; summary-only material names its source and remains 未读全文. Notes/library are not managed software. Default-off `hostMigration` lets updates register software tasks for the host to apply at a quiet point, never stopping jobs or altering conclusions/user wording. See [records](USAGE.md#research-markdown) and [migration](USAGE.md#submission-readiness-and-maintenance).

Call the mentor at round end, after two no-science rounds, on direction/story corrections, before route changes or when requested. Engineering failures count toward stagnation diagnosis, not automatic reauthorization: continue a credible next step within scope; ask the user when commitments or resources must change or no credible path remains. Use `dove mentor brief --project <root>` plus the trigger, with attributed opinions and relevant raw-artifact paths as materials. Engineering remains the executor's responsibility.

Cross-round judgment uses a fresh context. The mentor may retrieve sources; the paper reviewer only reads supplied current manuscript materials through Read/Grep/Glob. Neither executes nor edits. Every mentor checks tracking configuration, unjudged impacts and overdue weekly scans, independently of rounds.

Tracking shows Chinese lines (or pending), direction and provenance. Watch or explicit accumulation saves judged papers; library reads/exports do not write. Older-paper supplementation is off by default and nonrepeating. Unknown BibTeX kind uses `@misc`, not a venue guess. See [tracking](USAGE.md#dashboard-tracking-and-topics).

## Completion and evidence

Requested-work completion, scientific progress and [software verification](PACKAGING.md#verification-evidence) differ. Negative evidence can end a round without completing the goal; plans and engineering checks are not scientific results. Submission needs scientific sufficiency, independent review of the same complete current version and actual delivery readiness. Installed rules alone establish none of these.

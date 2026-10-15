# Capability matrix

Dove is one research collaborator. Ordinary Claude conversation in an initialized project is the primary entrance; the optional Dove agent and nine flat Skills add no personas, stages or permissions. The main session owns the user conversation, execution and adoption of findings. Bounded requests keep their scope.

## Nine capabilities

| Skill | Claude Code | DSH | What it helps with |
|---|---|---|---|
| `dove.research` | Command | Skill | Explore parallel candidates for the user's choice, or advance the confirmed mainline through substantive method work. |
| `dove.status` | Command | Skill | Read the card, recent evaluation and current brief; report results, core evidence, blockers and round without new work. |
| `dove.source` | Command | Skill | Discover and inspect sources, verify citation identity and claims, and improve affected decisions. |
| `dove.experiment` | Command | Skill | Develop and evaluate methods through fair comparisons, diagnostics and analysis of actual outputs. |
| `dove.draft` | Command | Skill | Write evidence-grounded text in the authoritative format and inspect the real build or export. |
| `dove.figure` | Command | Skill | Gather materials, create or revise visuals, inspect rendered figures, and deliver captions and editable sources. |
| `dove.review` | Command | Skill | Distinguish author self-check, delivery inspection, independent current-paper review and returned-review inspection. |
| `dove.rebuttal` | Command | Skill | Verify concerns, write author responses and make requested evidence-backed revisions. |
| `dove.lessons` | Command | Skill | Read or preserve useful transferable guidance without creating a second progress log. |

There is no Auto Skill. Existing standards govern topic selection: broad candidate generation and real searches precede 2–3 recommendations for the user's choice. Before that choice, do not implement candidate methods; do only standards-allowed diagnostics. After selection, scale work by whether it can answer the question, not by a default preference for the smallest change.

## Host support

| Surface | Claude Code | DSH |
|---|---|---|
| Ordinary project rule / optional Dove agent | Installed | Not projected |
| `dove-mentor` / `dove-review` definitions | Native fresh read-only contexts | No packaged agent service; equivalent isolated judgment depends on host tools |
| SessionStart / UserPromptSubmit | Read-only integration and bounded context | Not projected |
| Status line | Installed only when absent | Not projected |
| Paper-search / Exa MCP | Project declarations, not access approval | Not projected |
| Quality/preference essentials and full companions | Four exact shared resources | Same four resources |
| `dove run` receipts | User-installed Node CLI | Same CLI |

Fresh author main contexts personally read the two short essentials; full companions are on demand. DSH Status has no author bootstrap. Both hosts' mentors read the quality summary, including shared note and tracking duties, but not private author preferences. Installation does not prove reading or live behavior. See [Usage](USAGE.md#short-core-and-two-reference-read-contracts).

## Records and independent judgment

Researcher-owned records have fixed fields and caps: the identity card includes target tier, research state and sourced restrictions; EVAL holds one row per method version and one replaceable current mentor assessment; each round has one brief and one result linking ordinary artifacts. Mentor memory lives in its own `MENTOR_NOTES.md`, not resumed conversation. Existing missions, experiments and claims stay in place; installation does not migrate research. See [Research Markdown](USAGE.md#research-markdown).

Call the mentor at round end, after two rounds without scientific results, on user direction/story corrections, before route changes or when requested. Engineering and verification failures count; ask the user before a third no-result continuation. Supply materials and four fixed direction questions, not an executor-framed verdict request. Engineering, parameters, acceleration and evaluator repairs belong to the executor; the mentor judges direction, scientific adequacy and time spent. Route changes name the old route, new route and reason.

Each cross-round judgment uses a fresh context. The mentor may inspect supplied materials and retrieve paper/web sources; the reviewer only reads specified current manuscript materials and grounding through Read/Grep/Glob. Neither executes or edits. The mentor checks draft tracking, unjudged papers and overdue weekly scans on every invocation, independently of rounds. Main-session saves do not turn opinions into empirical evidence.

## Completion and evidence

Requested-work completion, scientific progress and [software verification](PACKAGING.md#verification-evidence) are separate. A negative evaluation can end a round without completing the goal; plans, smoke checks and engineering-only work are not scientific results. Submission completion requires scientific sufficiency, current independent review of the same complete version and actual delivery readiness. None is established by installed rules alone.

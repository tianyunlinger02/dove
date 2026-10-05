# Capability matrix

Dove is one research agent. Ordinary Claude conversation in an initialized project is the primary entrance; `claude --agent dove` and nine flat Skills are optional, not personas, stages, or permission grants. The main session owns the user conversation, execution, and adoption of delegated findings. Ordinary tasks retain their scope.

## Nine capabilities

| Skill | Claude Code | DSH | What it helps with |
|---|---|---|---|
| `dove.research` | Command | Skill | Start or continue the current round; call the mentor when no round is active. |
| `dove.status` | Command | Skill | Read identity, latest evaluation rows, and current brief; report progress in four plain sentences. |
| `dove.source` | Command | Skill | Find, read, check, and use relevant sources, including requested bounded bibliography DOI identity checks. |
| `dove.experiment` | Command | Skill | Develop, rerun, diagnose, or analyze within a round; freeze/preregister only final heldout confirmation. |
| `dove.draft` | Command | Skill | Draft, assess, or revise manuscripts, responses, methods, results, and other project text from real evidence. |
| `dove.figure` | Command | Skill | Gather materials, draw or revise figures, check them in manuscript context, and write captions. |
| `dove.review` | Command | Skill | Do author-side self-check, delivery review, native paper review where available, or returned-review preservation/inspection. |
| `dove.rebuttal` | Command | Skill | Analyze review findings, write responses, and make requested evidence-backed revisions. |
| `dove.lessons` | Command | Skill | Read or maintain reusable lessons that may improve current or future research judgment. |

Source, Draft, Figure, Rebuttal, and Lessons are unchanged by the mentor/round structure. There is no Auto Skill or command.

## Host support

| Surface | Claude Code | DSH |
|---|---|---|
| Ordinary main-session rule / optional Dove agent | Installed | Not projected |
| `dove-mentor` and `dove-review` definitions | Native fresh read-only subagents | No packaged agent service |
| SessionStart / UserPromptSubmit | Read-only integration and bounded identity/guidance delivery | Not projected |
| Narrow Stop reminder | Once for an ongoing round without a current-turn mentor call | Not projected |
| Status line | Installed only if the project has no existing line | Not projected |
| Paper-search / Exa MCP integration | Project declarations; approval/access remain user-provided | Not projected |
| Quality/preference essentials and full companions | Four exact shared resources | Four exact shared resources |
| `dove run` receipts | User-installed Node CLI | Same CLI, not a host process service |

Each fresh main context personally reads the short Chinese quality/preference essentials; full companions are on demand. Claude startup/clear supplies the bootstrap; DSH applies it on first author-side Skill use if needed. DSH Status has no author stance/bootstrap. Neither resource installation nor hook output proves reading or model behavior. See [Usage](USAGE.md#short-core-and-two-reference-read-contracts).

## Research records and evaluation

New core records are researcher-owned `IDENTITY.md`, `EVAL.md`, and `rounds/NNN-brief.md` / `NNN-result.md`. Brief authors are mentor, user, or external. Results name changed files, measurements, and prediction versus actual in a few lines, with one evaluation row per round. `RESEARCH.md` is a short history index; existing missions, experiments, and claims remain in place without migration/deletion or new entries. Initialization still creates only minimal `RESEARCH.md` when no research tree exists.

The user confirms the evaluation script, dev/test split, key columns, and completion standard once, including a generalization column for unseen categories/styles or equivalent scope. Later changes need confirmation. After important results, the mentor supplies the eight-dimensional paper assessment in `EVAL.md`; the weakest decisive dimension guides the next brief. A plan or smoke test does not end a round.

`Current round` and `Round status: ongoing / paused / completed` stay at the top of the identity card within its first 4KB. Overlong cards show their first 4KB plus a shortening notice rather than being declared missing. Explicit discussion-only or stop requests pause the round. Repeated cross-project corrections prompt a one-sentence suggestion about global `AUTHOR_PREFERENCES`, never an automatic edit. See [Research Markdown](USAGE.md#research-markdown).

## Independent judgment

`dove-mentor` reads the identity/recent corrections, evaluation, recent briefs/results, and actual changes. It judges prediction versus actual, general capability versus case-specific patches, and the method family's remaining value, then proposes the next round or a concrete completion/user decision. It may change methods within the confirmed goal and constraints.

`dove-review` reads the specified current manuscript and cited results from a reviewer position. Both use native fresh contexts and only `Read`/`Grep`/`Glob`, with no execution conversation, resumed history, commands, or edits. They list the files actually read; the main session saves and applies their returns. Frozen review snapshots, external workspaces, and socket launchers are not prerequisites. Missing independent judgment remains a limitation; author-side self-check is not relabeled independent review.

## Completion

Requested-work completion, scientific progress, and [software verification](PACKAGING.md#verification-evidence) are separate. A bounded request can finish without a new scientific result. A research round ends at its actual evaluation result, including a negative result; that does not automatically complete the goal. A user-confirmed submission goal requires scientific sufficiency, a current independent review recommendation for the same complete version, and actual delivery readiness.

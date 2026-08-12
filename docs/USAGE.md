# Usage

## Collaboration defaults

Unless the user requests another language or format, Dove-facing host work should respond in natural, clear Chinese. Requested artifacts and strict external contracts take priority over conversational defaults.

Dove Skills use normal host file, coding, execution, and research tools directly. Research context is read and maintained as ordinary Markdown under `.dove/research/`. There is no research MCP service or runtime database.

The final conversation should answer the actual request, preserve material failures, limits, and uncertainty, and avoid replaying private workflow detail.

## Daily entry

After installing Dove 3.0.0 and initializing the project, enter or re-enter Claude Code from that project. You may issue a normal request or invoke one of the ten flat Skills:

```text
/dove:research Compare the implementation with the documented design and identify the strongest unresolved question.
```

When research context is useful, a Skill first looks for `.dove/research/RESEARCH.md`. These are normal states:

- `.dove/research/` does not exist;
- the directory exists but `RESEARCH.md` does not;
- the overview exists but links no relevant topic document; or
- a linked document has moved or is missing.

The host reports those facts naturally and continues from relevant ordinary project materials when the task allows. It does not classify them as an invalid research database, because there is no research database. A Skill invocation does not create research documents merely to record that it ran.

## Ten Skills

### Research

Use `research` for one bounded pass of framing, investigation, synthesis, or project work. Read the overview when present, inspect the relevant project files and real external sources, produce the requested deliverable, preserve uncertainty, and stop rather than turning the request into open-ended autonomy.

When the work creates durable research value, update an existing linked topic document or create one human-named Markdown document. Update `RESEARCH.md` only when the mainline, an important conclusion, navigation, or priority materially changes.

### Status

Use `status` for a read-only account of current direction and progress. It reads `RESEARCH.md` once when present and follows only the links needed to explain:

- the documented mainline;
- real progress and important conclusions;
- failed, adverse, or blocked work;
- limitations and uncertainty; and
- next priorities.

Status does not browse without purpose, run tests, repair links, create files, or infer hidden state. If the overview is absent or a link is broken, it says so plainly.

### Source

Use `source` to discover, retrieve, read, compare, and verify real material with host research tools. Distinguish material merely found from material actually inspected and used.

When durable context is useful, write or update a readable Source note with the citation or URL, what was learned, relevant conditions, conflicts, limitations, and links to related work. Sources are natural documents, not generated records with IDs or fingerprints.

### Experiment

Use one Experiment Markdown document before and after execution.

Before execution, record the prospective plan proportionally to the work: why the experiment matters, hypotheses or competing explanations, protocol, inputs, comparisons, metrics, discriminating observations, stop conditions, expected artifacts, cost, risk, and failure value.

Then execute that written plan with normal host tools and append the actual procedure and results to the same document. Preserve raw artifact paths, denominator accounting, exclusions, deviations, unexpected observations, positive, negative, null, mixed, failed, or stopped outcomes, limitations, uncertainty, and what the result can and cannot establish.

Do not execute first and reconstruct a supposedly prospective plan afterward.

### Draft

Read the target and relevant evidence, then create or revise the ordinary draft artifact. Validate it with appropriate host tools and identify unsupported claims, citation gaps, counter-evidence, and uncertainty. Dove does not maintain a separate draft or Claim database.

### Figure

Gather actual project materials and data, then create or revise the ordinary figure and caption. Validate labels, denominators, provenance, legibility, and agreement between the figure, caption, and underlying evidence.

Link the figure from a relevant research document only when the link improves future recovery.

### Review

Review is a user-managed separate exchange recorded in one readable Review document:

1. create or select the Review document;
2. write the purpose, exact project-relative artifact paths, scope limits, rubric, and a self-contained prompt;
3. give only those declared files and prompt to a separate reviewer session or person chosen by the user;
4. require read-only review and a Markdown return;
5. when the user supplies the actual return, preserve it faithfully in the same Review document; and
6. append author interpretation, responses, revisions, unresolved issues, and follow-up actions.

If exact version freezing matters, use an ordinary Git commit, versioned copy, or explicit review bundle and link it from the Review document. Dove does not generate a review exchange identity or treat file identity as scientific authority.

A built-in Reviewer role can help keep responsibilities separate, but the host label alone does not establish identity or independence. Dove does not launch, impersonate, silently substitute, or certify the reviewer.

### Rebuttal

Rebuttal and revision remain Builder/Author work. Read the actual Review document and artifacts, analyze each material finding against the evidence, write the response, make ordinary project revisions, and verify that every response maps to a real finding without overstating support or erasing uncertainty.

Keep author handling in the same Review document or in the directly affected research document when that is clearer.

### Lessons

`LESSONS.md` is one optional, complete, ordinary advisory Markdown document at `.dove/research/LESSONS.md`. Read it directly. For an explicit remember or reflection request, preserve its useful structure and add only supported reusable guidance.

Lessons are fallible advice, not evidence, a ledger, or a completion certificate.

### Auto

Use `auto` only through an explicit invocation for multi-round work. Ambient routing cannot select it.

Auto requires an adequately documented current mainline in `RESEARCH.md`. The documented mainline is a read-only boundary: Auto may advance aligned work, update linked topic documents, and maintain navigation or progress, but it must not silently redefine the research direction.

If the overview is absent, materially incomplete, or evidence says the mainline must change, Auto records or returns a recommendation as an ordinary artifact, reports the block, and stops. It also stops when the user budget ends, no useful feasible action remains, a safety boundary is reached, or a required user-managed Review return is unavailable.

Auto is an explicit foreground workflow. It is not a background daemon, scheduler, research server, or hidden session store.

## Research document organization

The recommended organization is intentionally lightweight:

```text
.dove/research/
├── RESEARCH.md                 # overview and navigation when maintained
├── LESSONS.md                  # optional advisory guidance
└── <human-named topic files>   # optionally grouped in human-chosen folders
```

A project may use folders such as `missions/`, `sources/`, `experiments/`, or `reviews/`, but none is required. A useful document should be named and structured for the human reader and linked where future recovery benefits.

Do not impose fixed headings, frontmatter, generated IDs, enums, a machine index, stored counts, or research hashes. Do not create a mandatory Markdown template merely to replace the old structured model.

### Missions and Sources

A Mission document may describe a bounded goal, assumptions, competing explanations, evidence needs, work performed, failures, conclusions, limits, and next branches in whatever structure best serves the work. A Source document may combine bibliographic context, verification notes, conflicts, conditions, and limitations.

Both are ordinary Markdown. They may link to project artifacts and to one another.

### Claims

Claims should remain scoped prose in the draft, overview, experiment, review, or a dedicated human-readable document when that improves reasoning. Preserve support, counter-evidence, missing evidence, uncertainty, and cannot-say boundaries naturally. There is no Claim store or required assessment vocabulary.

## Runtime CLI

The CLI is for project software lifecycle and the prompt hook:

```text
init, sync, upgrade, reinstall, doctor, export-research, hook
```

- `init` establishes the supported Claude project integration.
- `sync` refreshes recognized managed integration without changing research documents.
- `upgrade` refreshes integration and preserves research Markdown.
- `reinstall` performs a destructive Dove project reset only after a displayed default-No confirmation; ordinary project files are preserved.
- `doctor` reports software and local readability facts, not research quality.
- `export-research` performs the separately authorized, one-time legacy Dove JSON research records-to-Markdown conversion and archives the original bytes under `.dove/archive/...`.
- `hook user-prompt-submit` supports project integration and ambient routing.

There is no `mcp` command and no `migrate-research` command. v1 research conversion and runtime fallback to old JSON are not supported.

## Installation and research boundaries

`.dove/install/` is software metadata at manifest revision `2.0` and may contain Doctor machine state plus readable `DOCTOR.md`. `.dove/research/` is researcher-owned Markdown. `.dove/archive/` holds original bytes created by explicit export.

Installation safety hashes remain internal and do not become research evidence. `sync` and `upgrade` do not rewrite research documents. Complete Reinstall deliberately deletes Dove research and old archives after confirmation.

## Maintainer validation

Use focused checks while implementing and the documented release gates for a release candidate. Passing tests, adapter checks, package checks, or local review establishes software behavior only, not scientific completion, correctness, reproducibility, or reviewer independence.

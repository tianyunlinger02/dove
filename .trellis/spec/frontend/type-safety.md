# Type Safety

> Software contracts, path safety, CLI boundaries, and research-document non-schema rules for Dove 3.0.0.

---

## Overview

Dove uses Node.js ESM JavaScript. Runtime safety applies to software-owned boundaries such as package metadata, CLI parsing, installation manifests, managed paths, lifecycle plans, generated inventories, and export authorization.

Research meaning is not a runtime type system. Ordinary Markdown must not acquire a replacement schema, DTO layer, typed research errors, generated IDs, or machine authority.

## Software Contract Sources

- `package.json` and package metadata define package identity and Node requirements.
- The project installation manifest implementation defines revision `2.0` and managed-resource metadata.
- CLI parsing defines the supported command and option inventory.
- Project installation and file-transaction modules enforce contained software writes and conflict handling.
- Canonical Skill and role sources define workflow inventory for adapter generation.
- Build scripts define the library, CLI, and prompt-hook bundles.
- Export code defines the supported legacy JSON input boundary, archival behavior, confirmation or authorization boundary, and Markdown output.

No research MCP definitions or Research Format schema belong in the Dove 3 contract surface.

## Required Software Validation

- Package name and release version are valid and explicit.
- Node.js `>=22` remains the supported runtime.
- CLI parsing accepts only `init`, `sync`, `upgrade`, `reinstall`, `doctor`, `export-research`, and `hook` with their declared options.
- The CLI does not expose `mcp` or `migrate-research`.
- Installation manifests use revision `2.0` and reject unsupported or ambiguous software state.
- Project roots and Dove-managed paths reject traversal, escaping paths, and unsafe symlink use where Dove owns the boundary.
- Shared configuration preserves unrelated fields.
- Managed-resource digests detect changed installation bytes without becoming public research evidence.
- File-set changes verify preconditions and avoid partial promotion.
- Generated adapters match the ten-Skill and three-role canonical sources.
- Package output contains exactly the declared library, CLI, and prompt-hook runtime bundles.
- Real research export requires separate user authorization.
- Export accepts supported legacy Dove JSON research records only, archives the original bytes under `.dove/archive/...`, and does not install a runtime fallback.
- Complete Reinstall requires an explicit confirmed destructive plan whose default is No.

## Research Markdown Boundary

Research content under `.dove/research/` is ordinary UTF-8 Markdown. Software may enforce only genuine file-safety boundaries needed to read or write a selected project file. It must not validate research meaning through a fixed document shape.

Allowed conventions include:

- recommended `RESEARCH.md` overview and navigation;
- optional `LESSONS.md`;
- human-named linked topic documents; and
- optional human-chosen folders.

Do not require or synthesize:

- fixed headings or section order;
- frontmatter;
- generated document, Mission, Source, Experiment, Claim, or Review IDs;
- research enums or status vocabularies;
- machine indexes or stored inventory counts;
- research fingerprints or hashes; or
- a mandatory Markdown template.

An absent overview is normal. A broken Markdown link is reported naturally and does not become a typed invalid-research-state error.

## Workflow Invariants Without a Database

Some semantic order and responsibility boundaries still matter even though documents are untyped:

- prospective experiment planning is written before execution;
- actual experiment results are appended to the same document;
- review purpose, exact path scope, limits, and prompt precede the external exchange;
- the Reviewer remains read-only and returns Markdown;
- the actual user-obtained return is preserved in the same Review document before author handling;
- Auto is explicit-only and cannot rewrite the documented mainline; and
- Status performs no writes.

Protect these through canonical workflow order, focused behavior tests, and semantic review. Do not enforce them by inventing an entity database.

## Version and Lifecycle Boundaries

- Package release: `3.0.0`.
- Installation manifest revision: `2.0`.
- Supported export source: legacy JSON research state.
- Unsupported export source: v1 research state.
- Runtime research source: ordinary Markdown only.
- Runtime fallback to old JSON: none.

Sync and Upgrade preserve research documents. Complete Reinstall deletes Dove research and old archives after default-No confirmation while preserving ordinary project files.

## Machine and Human Language

Final conversation policy defaults to natural Chinese unless the user requests another language or format. Source code names, CLI commands, package versions, manifest revisions, and project-relative paths remain exact where needed. Research documents use the language and structure appropriate to their human readers.

Validation output must stay software-scoped and must not imply scientific correctness, completion, reproducibility, acceptance, or reviewer independence.

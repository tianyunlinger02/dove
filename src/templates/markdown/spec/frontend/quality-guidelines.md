# Quality Guidelines

> Behavioral, documentation, and release validation for Dove 3.0.0.

---

## Primary Gates

```bash
npm run check
npm run release:check
npm run pack:dry-run
```

Use full gates for an installation or release candidate. During implementation, prefer the smallest focused checks and one real interface verification. For documentation-only work, a targeted terminology scan and byte-identity comparison may be sufficient when broader tests were not requested.

Passing tests or validators proves software behavior only. It does not prove research completion, scientific correctness, reproducibility, acceptance, or reviewer independence.

## What Validation Should Protect

- the public release is Dove `3.0.0` with ten flat Skills and three roles;
- canonical Skill workflows and generated host adapters do not drift;
- generated adapters remain projections rather than readiness claims;
- Claude Code remains the supported project initialization path;
- the package contains the library, CLI, and prompt-hook bundles and no research MCP bundle;
- the CLI exposes `init`, `sync`, `upgrade`, `reinstall`, `doctor`, `export-research`, and `hook`, with no `mcp` or `migrate-research` command;
- Skills use normal host tools rather than a research MCP service or CLI research fallback;
- Auto is explicit-only and ambient routing cannot select it;
- Status is read-only and treats missing overviews and broken links naturally;
- ordinary Markdown remains ordinary rather than becoming a fixed schema;
- Experiment planning precedes execution and the same document receives actual results;
- Review remains exact-scope, user-managed, read-only, Markdown-returning, and preserved in one document;
- Missions and Sources remain natural documents and Claims do not become a store;
- installation manifest revision `2.0`, Doctor state, and managed-file safety remain separate from research evidence;
- Sync and Upgrade preserve research documents;
- export accepts supported legacy JSON research records only, archives original bytes, requires separate real-data authorization, and provides no fallback;
- Complete Reinstall defaults to No and deletes Dove research and old archives only after confirmation while preserving ordinary project files;
- Trellis source and template pairs are byte-identical; and
- package entrypoints build and run for the declared software surface.

## What Not to Use as Quality Proof

Do not treat exact file, line, test, byte, document, source, claim, or experiment counts as evidence that Dove advances research. Inventory equality is useful only where it protects a sealed software release surface or generated completeness.

Do not validate research Markdown by requiring headings, frontmatter, IDs, enums, hashes, indexes, or counts. Do not replace a retired JSON schema with a mandatory Markdown template.

Avoid fixed whole-sentence prompt regexes. Check stable behavior and workflow order instead. Delete tests that merely duplicate another owner or freeze incidental prose.

## Documentation Checks

Public docs, Trellis specs, canonical prompts, and generated adapters must agree that:

- Dove 3 has no research MCP server, tools, registration, Research Format runtime, or database;
- research context is ordinary Markdown under `.dove/research/`;
- `RESEARCH.md` is recommended navigation, `LESSONS.md` is optional, and human-named topic files remain flexible;
- missing or broken navigation is reported naturally rather than classified as invalid research state;
- one Experiment document contains plan and result;
- one Review document contains preparation, actual return, and author handling;
- Reviewer separation is user-managed and does not prove independence;
- Auto is explicit-only and cannot rewrite the documented mainline;
- there are three bundles and the documented CLI inventory is current; and
- validation statements remain software-scoped.

Search specifically for retired eight-tool inventories, DTO examples, typed research errors, schemas, views, generated research IDs, research hashes, old bundle counts, `mcp`, and `migrate-research` claims. Negative statements that explicitly describe their removal are acceptable; affirmative old contracts are not.

## Research Workflow Checks

- Substantive host work occurs before or alongside document maintenance.
- Source notes distinguish material found from material actually inspected and used.
- Prospective experiment details exist before execution begins.
- Actual results preserve denominators, exclusions, deviations, failures, adverse or null evidence, limitations, and uncertainty when material.
- Claims stay within evidence and preserve counter-evidence and cannot-say boundaries naturally.
- `RESEARCH.md` changes only for material mainline, conclusion, navigation, or priority changes.
- Lessons remain advisory and are never presented as evidence.
- No workflow creates a document merely to show that it ran.

## Review Checks

- The Review document declares exact project-relative artifact paths and scope limits.
- The user selects and manages the separate Reviewer.
- Reviewer access is read-only and limited to the declared scope.
- The return is Markdown and is preserved faithfully before author handling.
- No output claims reviewer identity, independence, authority, sign-off, scientific validity, or acceptance.
- A native role or separate local session is described only as responsibility separation.

## Lifecycle Checks

- `.dove/install/manifest.json` remains revision `2.0`.
- Doctor state and `DOCTOR.md` remain software-facing and do not store prompts or scientific judgments.
- Managed-file hashes remain internal software safety data.
- Sync and Upgrade do not modify research Markdown.
- `export-research` is explicit, limited to the supported legacy JSON format, archival, separately authorized for real data, and one-time without runtime fallback.
- v1 conversion remains unsupported.
- Complete Reinstall shows the real destructive scope, defaults to No, deletes Dove research and old archives only after confirmation, and preserves ordinary project files.

## Final Review

After focused interface verification, perform a separate read-only semantic review. If a mechanism merely recreates a database in Markdown, offers self-certification, or makes research heavier without improving decisions, remove or simplify it rather than adding tests to preserve it.

# Quality Guidelines

> Behavioral, documentation, and release validation for Dove 3.0.0.

---

## Primary Gates

```bash
npm run check
npm run release:check
npm run pack:dry-run
```

Use full gates for an installation or release candidate. During implementation, prefer the smallest focused checks and one real interface verification. For documentation-only work, a targeted terminology scan and byte-identity comparison may be sufficient.

Validators and real interface checks establish bounded software evidence only. They do not prove research completion, scientific correctness, reproducibility, acceptance, or reviewer independence.

## What Validation Should Protect

- the public release is Dove `3.0.0` with ten flat Skills and three roles;
- canonical Skill workflows and generated host adapters do not drift;
- generated adapters remain projections rather than readiness claims;
- Claude Code remains the supported project initialization path;
- the package contains the library, CLI, and hook bundles, the hidden Claude paper-search support Skill, and no Dove research MCP or third-party Python bundle;
- the CLI exposes `init`, `update`, `reinstall`, `doctor`, `export-research`, and `hook`, with no `mcp` or `migrate-research` command;
- public Skills use normal host tools; the optional external paper MCP remains bounded, pinned, user-approved, and has no CLI/shell fallback;
- Auto is explicit-only and ambient routing cannot select it;
- Status is read-only and treats missing overviews and broken links naturally;
- ordinary Markdown remains ordinary rather than becoming a fixed schema;
- Experiment follows the requested design, execution, analysis, or retrospective work; newly executed work plans prospectively and appends actual results to the same document;
- Review preparation, faithful return import, and context inspection remain distinct; the separate Reviewer is user-managed, scoped, read-only, and Markdown-returning;
- Missions and Sources remain natural documents and Claims do not become a store;
- installation manifest revision `2.0`, ordinary Dove feedback, and managed-file safety remain separate from research evidence;
- project update creates or exactly appends only missing research defaults while preserving existing bytes and ordinary topic documents;
- contextual follow-ups skip ambient routing, and the Stop hook requests at most one additional plain-language rendering;
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

- Dove 3 has no Dove-owned research-state MCP server, tool registry, Research Format runtime, or database; Claude projects may declare only the documented pinned external paper-acquisition server without automatic approval, credentials, or bundled runtime;
- research context is ordinary Markdown under `.dove/research/`;
- root `RESEARCH.md`, six directory summaries, six general Lessons themes, and human-named topic files remain ordinary flexible Markdown rather than entity stores;
- missing or broken navigation is reported naturally rather than classified as invalid research state;
- one Experiment document contains plan and result;
- a Review import faithfully preserves the actual return without requiring author handling or creating a new exchange;
- Reviewer separation is user-managed and does not prove independence;
- Auto is explicit-only and cannot rewrite the documented mainline;
- there are three bundles and the documented CLI inventory is current; and
- validation statements remain software-scoped.

Search specifically for retired eight-tool inventories, DTO examples, typed research errors, schemas, views, generated research IDs, research hashes, old bundle counts, `mcp`, and `migrate-research` claims. Negative statements that explicitly describe their removal are acceptable; affirmative old contracts are not.

## Research Workflow Checks

- Substantive host work occurs before or alongside document maintenance.
- Source notes distinguish material found from material actually inspected and used.
- When execution is requested, the experiment target and judgment method are written before execution begins.
- Design-only work stops before execution, existing results are analyzed from their provenance, and retrospective records are labeled honestly.
- Actual results preserve material failures, deviations, interpretation evidence, limitations, and uncertainty.
- Claims stay within evidence and preserve counter-evidence and cannot-say boundaries naturally.
- `RESEARCH.md` changes only for material mainline, conclusion, navigation, or priority changes.
- Lessons remain advisory and are never presented as evidence.
- No workflow creates a document merely to show that it ran.

## Review Checks

- Review preparation declares relevant project-relative artifact paths and scope limits.
- The user selects and manages the separate Reviewer.
- Reviewer access is read-only and limited to the declared scope.
- Import preserves the returned Markdown faithfully and does not automatically begin author response or revision.
- No output claims reviewer identity, independence, authority, sign-off, scientific validity, or acceptance.
- A native role or separate local session is described only as responsibility separation.

## Lifecycle Checks

- `.dove/install/manifest.json` remains revision `2.0`.
- `DOCTOR.md` remains ordinary feedback about Dove itself, without machine issue state, fixed fields, general conversation capture, or scientific judgments.
- Managed-file hashes remain internal software safety data.
- Project update reports `needs-sync` when defaults are missing, preserves existing file bytes as a prefix, appends each canonical paragraph or navigation line at most once by exact text, leaves ordinary topic documents unchanged, and becomes current after synchronization.
- The one-time old top-level research Lessons migration preserves original bytes in `lessons/additional-lessons.md`, deletes the old path transactionally, and installs no runtime fallback.
- `export-research` is explicit, limited to the supported legacy JSON format, archival, separately authorized for real data, additive into an existing default tree, and one-time without runtime fallback; legacy `.dove/LESSONS.md` becomes `lessons/imported-lessons.md`.
- v1 conversion remains unsupported.
- Complete Reinstall shows the real deletion and replacement scope, defaults to No, deletes custom Dove research and old archives and replaces existing default research files only after confirmation, rebuilds the current complete default tree, and preserves ordinary project files.

## Final Review

After focused interface verification, perform a separate read-only semantic review. If a mechanism merely recreates a database in Markdown, offers self-certification, or makes research heavier without improving decisions, remove or simplify it rather than adding tests to preserve it.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate documents while preserving substantive content, failures, limitations, and uncertainty; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the workflow requires it or the work creates durable research value.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `dove doctor` remains a read-only developer diagnostic; host-maintained `DOCTOR.md` feedback is separate and users normally do not need the command.

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

Validators and real interface checks establish bounded software evidence only. They do not prove research completion, scientific correctness, reproducibility, acceptance, reviewer independence, or Dove research quality.

## What Validation Should Protect

- the public release is Dove `3.0.0` with one Dove research agent and ten flat Skills;
- canonical Dove persona, Skill workflows, and generated host adapters do not drift, including research drive that turns gaps into hypotheses, discriminating evidence, or concrete next moves;
- generated adapters remain projections rather than readiness claims;
- Claude Code remains the supported project initialization path;
- the package contains the library, CLI, hook bundles, Dove agent surface, hidden Claude paper-search support Skill, and no Dove research MCP or third-party Python bundle;
- the CLI exposes `init`, `update`, `reinstall`, `doctor`, `export-research`, and `hook`, with no `mcp` or `migrate-research` command;
- public Skills use normal host tools; the optional external paper MCP remains bounded, pinned, user-approved, and has no CLI/shell fallback;
- Auto is explicit-only and ambient routing cannot select it;
- Status is read-only and treats missing overviews and broken links naturally;
- ordinary Markdown remains ordinary rather than becoming a fixed schema;
- Experiment follows the requested design, execution, analysis, or retrospective work; newly executed central work that needs recording plans prospectively and appends actual results to the same document when the maintenance trigger is met;
- Review preparation, faithful return import, and context inspection remain distinct; any separate reviewer is user-managed, scoped, read-only, and Markdown-returning;
- Missions and Sources remain natural documents and Claims do not become a store;
- installation manifest revision `2.0`, ordinary Dove feedback, and managed-file safety remain separate from research evidence;
- project update creates missing summaries, completes only current standard overview and Lessons-summary navigation, replaces the six package-managed built-in Lessons themes, and preserves other researcher-owned documents;
- ambient routing uses a positive clear Dove/research work threshold, hidden intake may choose no Dove Skill for contextual or judgment-only prompts, and the Stop hook requests at most one additional plain-language rendering;
- export accepts supported legacy JSON research records only, archives original bytes, requires separate real-data authorization, and provides no fallback;
- Complete Reinstall defaults to No and deletes Dove research and old archives only after confirmation while preserving ordinary project files;
- Trellis source and template pairs are byte-identical; and
- package entrypoints build and run for the declared software surface.

## What Not to Use as Quality Proof

Do not treat exact file, line, test, byte, document, source, claim, experiment, prompt, validator, or checklist counts as evidence that Dove advances research. Inventory equality is useful only where it protects a sealed software release surface or generated completeness.

Do not validate research Markdown by requiring headings, frontmatter, IDs, enums, hashes, indexes, or counts. Do not replace a retired JSON schema with a mandatory Markdown template.

Avoid fixed whole-sentence prompt regexes. Check stable behavior and workflow order instead. Delete tests that merely duplicate another owner or freeze incidental prose.

Review Dove through code logic, generated natural-language behavior, installed project surfaces, and whether real interactions serve the research mainline. Validators protect software boundaries and regressions; they do not prove Dove's research judgment.

## Documentation Checks

Public docs, Trellis specs, canonical prompts, and generated adapters must agree that:

- Dove 3 has one complete Dove research agent plus ten flat capability Skills; it does not expose planning, authoring, or reviewing as user-switchable Dove personas;
- Dove 3 has no Dove-owned research-state MCP server, tool registry, Research Format runtime, or database; Claude projects may declare only the documented pinned external paper-acquisition server without automatic approval, credentials, or bundled runtime;
- research context is ordinary Markdown under `.dove/research/`;
- researcher-owned root `RESEARCH.md`, six researcher-owned directory summaries, six package-managed built-in Lessons themes, and human-named topic files remain ordinary flexible Markdown rather than entity stores;
- missing or broken navigation is reported naturally rather than classified as invalid research state;
- one Experiment document contains plan and result when central execution needs recording;
- a Review import faithfully preserves the actual return without requiring author handling or creating a new exchange;
- reviewer separation is user-managed and does not prove independence;
- Auto is explicit-only and cannot rewrite the documented mainline;
- there are three bundles and the documented CLI inventory is current; and
- validation statements remain software-scoped.

Search specifically for retired eight-tool inventories, DTO examples, typed research errors, schemas, views, generated research IDs, research hashes, old bundle counts, `mcp`, and `migrate-research` claims. Negative statements that explicitly describe their removal are acceptable; affirmative old contracts are not.

## Research Workflow Checks

- Dove works as one complete research agent rather than separate planning, authoring, or reviewing personas.
- Work starts from the real research question, current mainline, external context, user need, key uncertainty, and decision that matters.
- Work stays objective and proportional: act from evidence, task risk, user preference, and the research mainline without rushing into aggressive execution or over-defending with unnecessary caution.
- In research-facing work, hunches and first impressions are hypotheses, not decisions; ground useful hunches in observed signals and turn them into discriminating questions or actions.
- Do not stop at admitting limits; turn gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves that advance the mainline while keeping exploration aimed rather than diffuse.
- User preferences are tradeoff signals, not rigid rules; when they conflict with evidence, task risk, or the mainline, state the tradeoff.
- Rigor, novelty, experiments, validation, engineering, writing, review, documents, and preferences are layered means rather than equal goals.
- Lower-level artifacts must not simulate higher-level research progress.
- Substantive host work occurs before or alongside document maintenance.
- Source notes distinguish material found from material actually inspected and used.
- A central experiment serves a real problem, key uncertainty, or route decision; when the problem definition is missing, experiment design stops and identifies the project material or relevant sources needed rather than inventing a substitute experiment.
- When central experiment execution needs recording, the experiment target and judgment method are written before execution begins and actual results are appended when the maintenance trigger is met.
- Design-only work stops before execution, existing results are analyzed directly, and retrospective records remain retrospective.
- Actual results and interpretation-changing deviations inform whether the route continues, changes, or stops.
- Important claims change when results change the research argument.
- `RESEARCH.md` changes only for material mainline, conclusion, navigation, or priority changes.
- Lessons remain advisory and are never presented as evidence.
- No workflow creates a document merely to show that it ran.

## Review Checks

- Review preparation declares relevant project-relative artifact paths and scope limits.
- The user selects and manages any separate reviewer.
- reviewer access is read-only and limited to the declared scope.
- Import preserves the returned Markdown faithfully and does not automatically begin author response or revision.
- No output claims reviewer identity, independence, authority, sign-off, scientific validity, or acceptance.
- A separate local session is described only as user-managed responsibility separation.

## Lifecycle Checks

- `.dove/install/manifest.json` remains revision `2.0`.
- `DOCTOR.md` remains ordinary feedback about Dove itself, without machine issue state, fixed fields, general conversation capture, or scientific judgments.
- Managed-file hashes remain internal software safety data.
- Project update reports `needs-sync` when required defaults or navigation are missing, creates missing summaries, completes current standard navigation only in `RESEARCH.md` and `lessons/LESSONS.md`, replaces all six built-in Lessons themes with current package content, leaves other researcher-owned documents unchanged, and becomes current after synchronization.
- Each built-in Lessons theme carries the package-management notice. Deprecated `.dove/research/LESSONS.md` and `lessons/additional-lessons.md` are directly deleted without migration or fallback, and the Additional migrated Lessons link is removed.
- `export-research` is explicit, limited to the supported legacy JSON format, archival, separately authorized for real data, additive into an existing default tree, and one-time without runtime fallback; legacy `.dove/LESSONS.md` becomes `lessons/imported-lessons.md`.
- v1 conversion remains unsupported.
- Complete Reinstall shows the real deletion and replacement scope, defaults to No, deletes custom Dove research and old archives and replaces existing default research files only after confirmation, rebuilds the current complete default tree, and preserves ordinary project files.

## Final Review

After focused interface verification, perform a separate read-only semantic review. If a mechanism merely recreates a database in Markdown, offers self-certification, exposes role labels as research authority, or makes research heavier without improving decisions, remove or simplify it rather than adding tests to preserve it.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate substantive content; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the user explicitly asks to record, update, or save it, or when results clearly change the research mainline, conclusion, decision, or priority.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `dove doctor` remains a read-only developer diagnostic; host-maintained `DOCTOR.md` feedback is separate and users normally do not need the command.

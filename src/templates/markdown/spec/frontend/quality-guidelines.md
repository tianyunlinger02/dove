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

- the public release is Dove `3.0.0` with one Dove research agent and nine flat Skills;
- canonical Dove behavior, Skill workflows, and generated host adapters do not drift, including the nine-capability shared mainline anchor, highest-level active limit, explicit candidate explanations, discriminating action choice, material-progress judgment, and research drive that turns gaps into hypotheses, discriminating evidence, or concrete next moves;
- generated adapters remain projections rather than readiness claims;
- Claude Code remains the supported project initialization path;
- the package contains the library, CLI, hook bundles, Dove agent surface, hidden Claude paper-search and web-reader support Skills, and no Dove research MCP or third-party Python bundle;
- the CLI exposes `init`, `update`, `reinstall`, `doctor`, `export-research`, and `hook`, with no `mcp` or `migrate-research` command;
- public Skills use normal host tools; the optional external paper MCP remains bounded, pinned, user-approved, and has no CLI/shell fallback;
- Claude project integration preserves built-in `WebSearch`, denies built-in `WebFetch` through project-scoped `permissions.deny`, uses pinned `dove-paper-search` for papers, uses hosted Exa MCP for ordinary webpage bodies and known URLs, has no CLI/shell/`curl`/fetch fallback, and DSH does not receive Claude permissions or MCP projection;
- Default multi-round progression is foreground work, ambient routing cannot select a separate Auto Skill or command, and it reads the user-confirmed Workspace mainline, preserving it while feasible in-scope actions can advance or protect the mainline;
- Status is read-only and treats missing overviews and broken links naturally;
- ordinary Markdown remains ordinary rather than becoming a fixed schema;
- Experiment follows the requested design, execution, analysis, or retrospective work; when a central basis is missing, Dove pauses central design and inspects actual project material, relevant sources, or a smallest low-risk diagnostic; newly executed central work that needs recording plans prospectively and appends actual results to the same document when the maintenance trigger is met;
- author-side scientific self-check, `dove-review` handoff, returned-review import, and context inspection remain distinct; each `dove-review` round reads only that round's explicit frozen list, and the reviewer is host-provided, isolated, persistent, read-only, and Markdown-returning;
- Review findings are evidence to analyze rather than direct rewrite or claim-narrowing triggers; feasible high-level author-side action comes first, narrowing requires evidence or a real boundary, and changes to the confirmed mainline, contribution, or completion meaning go to the user;
- Missions and Sources remain natural documents and Claims do not become a store;
- installation manifest revision `2.0`, ordinary Dove feedback, and managed-file safety remain separate from research evidence;
- project update refreshes package-managed integration and preserves existing `.dove/research/**` without creating summaries, completing navigation, or replacing Lessons;
- ambient routing uses a positive clear Dove work threshold, hidden intake may choose no Dove Skill for contextual or pure judgment-only prompts, judgment plus authorized bounded action may route as work, and Dove does not install or rely on a Stop hook; Stop does not drive continuity, routing, tools, writes, scheduling, or plain-language second turns;
- export accepts supported legacy JSON research records only, archives original bytes, requires separate real-data authorization, and provides no fallback;
- Complete Reinstall defaults to No and rebuilds package-managed integration while preserving `.dove/research/**`, `.dove/install/DOCTOR.md`, and ordinary project files;
- Trellis source and template pairs are byte-identical; and
- package entrypoints build and run for the declared software surface.

## What Not to Use as Quality Proof

Do not treat exact file, line, test, byte, document, source, claim, experiment, prompt, validator, or checklist counts as evidence that Dove advances research. Inventory equality is useful only where it protects a sealed software release surface or generated completeness.

Do not validate research Markdown by requiring headings, frontmatter, IDs, enums, hashes, indexes, or counts. Do not replace a retired JSON schema with a mandatory Markdown template.

Avoid fixed whole-sentence prompt regexes. Check stable behavior and workflow order instead. Delete tests that merely duplicate another owner or freeze incidental prose.

Review Dove through code logic, generated natural-language behavior, installed project surfaces, and whether real interactions serve the research mainline. Validators protect software boundaries and regressions; they do not prove Dove's research judgment.

## Documentation Checks

Public docs, Trellis specs, canonical prompts, and generated adapters must agree that:

- Dove 3 has one complete Dove research agent plus nine flat capability Skills; it does not expose planning, authoring, or reviewing as user-switchable Dove agent behaviors;
- Dove 3 has no Dove-owned research-state MCP server, tool registry, Research Format runtime, or database; Claude projects may declare only the documented pinned external paper-acquisition server without automatic approval, credentials, or bundled runtime;
- research context is ordinary Markdown under `.dove/research/`;
- fresh initialization creates only researcher-owned `RESEARCH.md`; optional directory summaries, Lessons, and human-named topic files remain ordinary flexible Markdown rather than entity stores;
- missing or broken navigation is reported naturally rather than classified as invalid research state;
- one Experiment document contains plan and result when central execution needs recording;
- author-side scientific self-check and `dove-review` handoff preparation first establish applicable review grounding from current official venue requirements and actually inspected relevant published work, without fixed paper counts or substituting published practice for official rules;
- author-side scientific self-check stays scoped and does not claim independent external review;
- a Review import faithfully preserves the actual return without requiring author handling or creating a new exchange;
- `dove-review` separation is host-provided and does not by itself prove independence;
- Default progression reads the user-confirmed Workspace mainline from substantive research context, conversation, and project artifacts; a confirmed goal-shaped request continues within that mainline, while a material direction or real boundary change must be surfaced to the user. It asks only when such a change would alter the work, keeps support work subordinate, and does not treat a recommendation, summary, validation result, Markdown update, or Lessons update as completion by itself; bounded tasks may finish without pretending to advance the mainline; for submission readiness it uses LaTeX as the authoritative manuscript source and primary working format by default, verifies its compiled output, uses another format only when the target venue officially does not provide or accept LaTeX, identifies the required venue-facing materials, distinguishes a promising scientific core from an actually submit-ready manuscript, makes a holistic venue-grounded judgment across the paper and required materials, and revises earlier optimistic judgments when broader evidence or grounded `dove-review` contradicts them;
- there are three bundles and the documented CLI inventory is current; and
- validation statements remain software-scoped.

Search specifically for retired eight-tool inventories, DTO examples, typed research errors, schemas, views, generated research IDs, research hashes, old bundle counts, `mcp`, and `migrate-research` claims. Negative statements that explicitly describe their removal are acceptable; affirmative old contracts are not.

## Research Workflow Checks

- Dove works as one complete research agent rather than separate planning, authoring, or reviewing personas.
- Work starts from the real research question, current mainline, external context, user need, key uncertainty, and decision that matters.
- Across the nine capabilities, work shares the user-confirmed Workspace mainline anchor, highest-level active limit, explicit candidate explanations, discriminating action choice, and material-progress judgment.
- Work stays objective and proportional: act from evidence, task risk, user preference, and the research mainline without rushing into aggressive execution or over-defending with unnecessary caution.
- In research-facing work, hunches and first impressions are hypotheses, not decisions; ground useful hunches in observed signals and turn them into discriminating questions or actions.
- Do not stop at admitting limits; turn gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves that advance the mainline while keeping exploration aimed rather than diffuse.
- User preferences are tradeoff signals, not rigid rules; when they conflict with evidence, task risk, or the mainline, state the tradeoff.
- Rigor, novelty, experiments, validation, engineering, writing, review, documents, and preferences are layered means rather than equal goals.
- Lower-level artifacts must not simulate higher-level research progress.
- Substantive host work occurs before or alongside document maintenance.
- Source notes distinguish material found from material actually inspected and used.
- A central experiment serves a real problem, key uncertainty, or route decision; when the problem definition is missing, Dove pauses central experiment design and inspects actual project material, relevant sources, or a smallest low-risk diagnostic rather than inventing a substitute experiment or merely stopping at the gap.
- When central experiment execution needs recording, the experiment target and judgment method are written before execution begins and actual results are appended when the maintenance trigger is met.
- Design-only work stops before execution, existing results are analyzed directly, and retrospective records remain retrospective.
- Actual results and interpretation-changing deviations inform whether the route continues, changes, or stops.
- Important claims change when results change the research argument.
- `RESEARCH.md` changes only for material mainline, conclusion, navigation, or priority changes.
- Lessons remain advisory and are never presented as evidence or as a default completion record.
- No workflow creates a document merely to show that it ran.

## Review Checks

- author-side scientific self-check and `dove-review` handoff preparation use current official venue sources for applicable formal requirements and a small, discriminating set of actually inspected published work for novelty, positioning, evidence norms, experiment presentation, and reader expectations.
- Review distinguishes material merely found from material retrieved, inspected, and actually used; published practice does not replace official venue rules, and no fixed paper count or checklist is required.
- author-side scientific self-check tests claims, evidence, method, novelty, limitations, writing clarity, and likely reader confusion against that grounding without claiming independent external review.
- `dove-review` handoff declares frozen project-relative artifact paths, whole-paper scope, grounding, and access boundaries.
- Dove or Review supplies the frozen materials and invokes a genuinely isolated persistent `dove-review` context when available; each round sees only its explicit frozen list, and the user may still mediate the exchange but is not required to start each review round manually.
- Reviewer access is read-only and limited to the frozen handoff materials.
- Import preserves the returned Markdown faithfully and does not automatically begin author response, revision, venue search, or paper search; ordinary context inspection likewise avoids unnecessary external search.
- Review findings are evidence to analyze rather than direct rewrite or claim-narrowing triggers; feasible high-level author-side action comes first, narrowing requires evidence or a real boundary, and changes to the confirmed mainline, contribution, or completion meaning go to the user.
- No output claims `dove-review` identity, independence, authority, sign-off, scientific validity, external acceptance, or independent status without a real isolated `dove-review` context judging the current frozen handoff.
- A separate local session is described only as responsibility separation; it does not by itself prove independence.

## Lifecycle Checks

- `.dove/install/manifest.json` remains revision `2.0`.
- `DOCTOR.md` remains ordinary feedback about Dove itself, without machine issue state, fixed fields, general conversation capture, or scientific judgments.
- Managed-file hashes remain internal software safety data.
- Project update reports `needs-sync` only for package-managed integration drift, refreshes recognized integration, and preserves existing `.dove/research/**` without creating summaries, completing navigation, replacing Lessons, or deleting retired researcher-visible materials.
- Update and uninstall remove only an array entry that exactly matches the old Dove-owned Stop hook fragment; user-owned or non-array Stop settings are preserved.
- `export-research` is explicit, limited to the supported legacy JSON format, archival, separately authorized for real data, additive into an existing minimal bootstrap, and one-time without runtime fallback; legacy `.dove/LESSONS.md` becomes `lessons/imported-lessons.md`.
- v1 conversion remains unsupported.
- Complete Reinstall shows the real deletion and replacement scope, defaults to No, and rebuilds package-managed integration after confirmation while preserving `.dove/research/**`, `.dove/install/DOCTOR.md`, and ordinary project files.

## Final Review

After focused interface verification, perform a separate read-only semantic review. If a mechanism merely recreates a database in Markdown, offers self-certification, exposes role labels as research authority, or makes research heavier without improving decisions, remove or simplify it rather than adding tests to preserve it.

## Stable Markdown and project file boundaries

- Research Markdown has no format or schema version. Future organization changes use ordinary host file operations to rename, move, relink, or consolidate substantive content; they do not create a migration framework or runtime fallback.
- Requested artifacts such as drafts, figures, experiment documents, and revisions are created or modified when the task requires them. Additional Dove research Markdown is maintained only when the user explicitly asks to record, update, or save it, when results clearly change the research mainline, conclusion, decision, or priority, or when preserving the work's evidence and continuation context is genuinely useful.
- Dove project file operations use cross-platform Node path containment, ordinary-file and symbolic-link checks, same-directory temporary writes, expected-state rechecks, and transactional rollback; they do not require Linux `/proc` features.
- Complete Reinstall displays the current deletion and replacement paths, defaults to No, and after confirmation rereads the project and executes the current plan.
- `dove doctor` remains a read-only developer diagnostic; host-maintained `DOCTOR.md` feedback is separate and users normally do not need the command.

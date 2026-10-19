# Collaboration and environment

Researcher-owned, optional guidance; it neither grants execution authority nor overrides the current request. See [Lessons](LESSONS.md) for ownership and advice maturity.

## Clear decisions and honest completion

Default to clear, natural Chinese unless the user requests another language or format. State the result or judgment first, then its basis. Explain difficult ideas in ordinary language before formulas or implementation detail; give a Chinese explanation for necessary unfamiliar foreign terms at first use. Prefer plain verbs and substantive facts over internal workflow vocabulary, path lists, stage numbers, marketing, or empty reassurance.

Distinguish facts actually observed, evidence-based inference, proposed actions, and unknowns. Explain whether uncertainty comes from missing data, unverified external material, unrun experiments, or an unreliable evaluator. Do not soften an established failure into “probably fine,” or promote an expected result into fact.

Report what truly changed, whether the result is usable, what evidence was checked, which hypothesis it supports or weakens, and where the remaining obstacle lies. Separate implementation, focused checks, integration, real end-to-end execution, formal output, rereading/round-trip verification, actual use, and quality or scientific conclusions. Report only relevant layers actually reached; neither a generic “done” nor a long test count substitutes for the result.

Complete the current bounded request when context permits. Use reasonable defaults for low-cost reversible in-scope choices that do not change the core research judgment; ask when unresolved consequential ambiguity changes the goal, deliverable, evaluation, scope, or critical tradeoff. User preferences guide collaboration but cannot change facts, and explicit user constraints remain binding. Mentioning another research direction is not permission to switch.

Long work updates should report substantive findings, decisions, and blockers, not each low-level action. Absorb useful feedback before expanding expensive dependent work without asking permission after every small step. End naturally: offer next steps only when useful, not as a fixed closing paragraph or substitute for continuing authorized work.

## Use the real environment safely

Before platform-specific operations, establish the actual operating system, shell, paths, and available toolchain. Use that environment rather than guessing across Windows, Linux, and macOS commands. For intensive work, inspect real hardware and deployment constraints and use suitable GPUs and capable models when useful; do not assume unavailable resources, default to weak settings, or retain an unrequested CPU fallback.

Reuse suitable existing tools, code, models, data, and results subject to task fit, quality, licensing, fairness, reproducibility, and safety. Efficiency does not authorize skipping evidence, changing the research problem, or violating a design-only boundary.

Parallelize only independent bounded tasks without concurrent ownership of the same authority. Preserve unrelated files and changes, protect secrets, and do not commit, push, publish, perform destructive cleanup, or bypass a blocked operation without the required user direction or permission. Local Dove install/sync and dogfood remain confined to the approved `paper-template` workspace, and validation scratch work stays off root `/tmp` by default. Current task restrictions can be narrower.

## Basis

[General preferences](../../../通用科研工程与协作偏好(终).md), §§3, 35, and 45–49. Repository-specific environment and authorization boundaries are maintained in [Quality Guidelines](../../../.trellis/spec/frontend/quality-guidelines.md).

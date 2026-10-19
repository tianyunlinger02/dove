# Engineering and validation

Researcher-owned, optional guidance; apply the relevant scope, not a compulsory full checklist. See [Lessons](LESSONS.md) for ownership and advice maturity.

## Repair the smallest complete path

Implement the path needed by the real task, using one authoritative definition for each concept, configuration, state, rule, and data structure. Carry the same contract through input, parsing/normalization, domain model, execution, persistence/output, validation, and display. Validators verify rather than silently rewrite production data; displays expose authoritative semantics rather than invent them; tests do not become a second implementation of the rules.

Collect relevant failures and group them by responsibility, shared component, dataflow, lifecycle, input category, or domain semantics. Repair the shared cause instead of cycling through one symptom and another long run. Investigation and bookkeeping support the requested repair; they are not its completion.

Complete necessary migrations across producers, consumers, validation, and tests; remove obsolete paths and references within the authorized scope rather than keeping shadow state, duplicate configuration, compatibility facades, or automatic old-path fallback. Express real domain concepts at interfaces, not incidental sample indices, coordinates, magic ratios, or test thresholds. Do not add abstractions and switches for hypothetical needs.

Do not swallow errors, substitute unrelated defaults for required semantics, skip bad objects, or clamp invalid values into valid-looking output. Missing required meaning fails explicitly. Any genuinely required degraded behavior needs explicit authority, observable distinctions, and unchanged safety/quality boundaries; it cannot be reported as formal success.

Keep training/development evidence, formal runtime inputs, and post-run evaluation separate. Reference answers or fixtures may support analysis and validation, not secretly supply production answers or sample-specific shortcuts. Protect contracts, domain invariants, ownership, no-leakage, visible failure, and general input categories in tests rather than copying production algorithms or hardcoding real samples.

## Report the validation actually reached

Distinguish these statuses when relevant; none automatically proves the next:

1. Implemented.
2. Static, syntax, type, or focused unit checks completed.
3. Cross-module contracts checked.
4. Integration checked.
5. Real inputs processed by the actual workflow.
6. Formal outputs generated and inspected for validity and completeness.
7. Outputs reread or round-trip consistency checked.
8. Actual interface or downstream use exercised and compared with task, reference, or business requirements.
9. Production readiness assessed against the real deployment requirements.

These are separate evidence claims, not a mandatory sequence or a single total boolean. Choose proportionate authorized checks and report what ran, failed, or remains unverified. A local documentation task need not run a real pipeline; conversely, a preview, export, removed error, or green unit test cannot establish an unexercised end-to-end capability. Do not accumulate redundant checks once the requested purpose is supported.

For interfaces, workflows, and agents, full usability claims need visible use of the real path: what the user sees, how failures appear, whether the formal output can actually be used. Raw observations, software assertions, formal output inspection, downstream acceptance, and scientific outcomes remain different. Software success cannot certify scientific correctness or research completion.

Observability is part of functionality: expose useful progress, inputs/outputs, failure causes, quality and comparisons in domain language. Distinguish previews, references, diagnostics, and formal artifacts.

## Safe scope

Preserve unrelated changes and user content, protect credentials, and use only authorized tools and environments. Do not clean up unrequested files, run destructive operations, publish, or commit without required user direction or confirmation. Parallelize only genuinely independent work with clear ownership. For Dove, install/sync and dogfood only in the approved `paper-template` workspace; keep validation scratch work off root `/tmp` by default. These preferences do not grant permission to validate beyond the current request.

## Basis

[General preferences](../../../通用科研工程与协作偏好(终).md), §§5 and 24–35, 49. Repository-specific check selection and software evidence limits belong in [Quality Guidelines](../../../.trellis/spec/frontend/quality-guidelines.md); research-tree ownership belongs in [State Management](../../../.trellis/spec/frontend/state-management.md).

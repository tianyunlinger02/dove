# Type Safety

Dove uses Node.js ESM JavaScript (`.mjs`), Node.js `>=22`. Validate software-owned contracts at runtime, not research meaning. Locate implementations through [Directory Structure](./directory-structure.md); natural-document ownership is defined in [State Management](./state-management.md).

## Paths and transactions

- Resolve an unambiguous project root and use cross-platform Node path containment. Reject traversal, escaping paths, unsafe symlinks, and non-ordinary files wherever Dove owns the boundary. Do not depend on Linux `/proc` for project file safety.
- Stage the complete file set using same-directory temporary writes, recheck expected file/configuration state before promotion, and roll back transactionally on failure. Changed preconditions or unowned conflicts block replacement; do not partially promote a plan.
- Preserve unrelated shared-configuration fields and ordinary files. Explicit `update` may replace valid manifest-owned local edits, reporting paths in human output and `replacedLocalEdits` JSON; automatic synchronization handles edits as specified in [Hook Guidelines](./hook-guidelines.md).
- Reinstall/uninstall previews the actual deletion/replacement scope and defaults to No. Complete Reinstall must reread the project after confirmation and execute the current plan, not a stale preview.

## CLI and installation contracts

- Package identity, release version, and runtime requirements come from `package.json` and package metadata, not copied release numbers in guidelines.
- CLI commands are `init`, `update`, `reinstall`, `uninstall`, `doctor`, `review`, `run`, and `hook`, with declared options only. Review subcommands are `handoff`, `status`, `resume`, `rerun`, `import`; Run subcommands are `start`, `status`, `resume`, `finalize`, `compare`. No `mcp`, `migrate-research`, or legacy export command.
- Installation manifest revision is `2.0`; reject unsupported or ambiguous software state. Keep package version, manifest revision, runtime receipts, and research content distinct. Managed-resource digests protect installation bytes only.
- Doctor separates current program version, manifest-recorded package version, and resource state. Missing versions remain unknown; version equality does not replace inventory/digest checks, and the CLI cannot verify what an active host session has loaded.
- Adapters must match canonical inventory and workflows; output bundles must match the declared build entries. Neither introduces research DTOs, typed research errors, or Markdown schema validation.

## Review records

Accept only canonical project-relative regular non-symlink material files; reject private Dove/Claude/settings/research paths. Copy only the explicit frozen list. Keep path, size, and SHA-256 receipts internal; omit hashes from human and CLI JSON projections. Reviewer workspaces use short, contained paths, remain separate from durable exchange records, and distinguish projects with the same Review id. Validate real backend session IDs and provenance without turning reports into parsed acceptability state. Scientific access and response responsibilities are in [Component Guidelines](./component-guidelines.md).

## Run receipts

- Use path-safe ids, atomically reserve run directories, and pass target argv without a shell. The supervisor owns journal writes; record timeout termination scope. PID liveness is an observation, not completion evidence.
- Preserve one ordinary terminal event and explicit missing-terminal reconciliation/finalization. Status is read-only; resume never reruns; finalize appends one scalar metric only after terminal completion.
- Compare only compatible terminal finalized runs by metric, budget, data, evaluator, and resource basis. Receipt compatibility is not scientific comparability.
- Beyond command, timing, outcome, metric, budget, and comparison basis, record only explicitly declared seed and minimum Git commit/dirty (`true`/`false`/`null`) facts. Seed is not proof the target used it. Do not add status counts, porcelain receipts, lockfile fingerprints, or environment taxonomies; Git does not affect eligibility or ranking.
- Budget metadata is not prepayment or an automatically enforced spending cap. Explicit user limits and timeout controls remain binding.

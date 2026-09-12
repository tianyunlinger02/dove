# Type Safety

Dove uses Node.js ESM JavaScript (`.mjs`), Node.js `>=22`. Validate software-owned contracts at runtime, not research meaning. Locate implementations through [Directory Structure](./directory-structure.md); natural-document ownership is defined in [State Management](./state-management.md).

## Paths and transactions

- Resolve an unambiguous project root and use cross-platform Node path containment. Reject traversal, escaping paths, unsafe symlinks, and non-ordinary files wherever Dove owns the boundary. Do not depend on Linux `/proc` for project file safety.
- Stage the complete file set using same-directory temporary writes, recheck expected file/configuration state before promotion, and roll back transactionally on failure. Changed preconditions or unowned conflicts block replacement; do not partially promote a plan. If restoring a backup fails, retain that transaction root and backups and report their absolute paths; preserve newly occupied targets. This covers caught failures, not crash recovery, filesystem-wide atomicity, or reversal of external reviewer session history.
- Preserve unrelated shared-configuration fields and ordinary files. Explicit `update` may replace valid manifest-owned local edits, reporting paths in human output and `replacedLocalEdits` JSON; SessionStart remains entirely read-only as specified in [Hook Guidelines](./hook-guidelines.md).
- Reinstall/uninstall previews the actual deletion/replacement scope and defaults to No. Complete Reinstall must reread the project after confirmation and execute the current plan, not a stale preview.

## CLI and installation contracts

- Package identity, release version, and runtime requirements come from `package.json` and package metadata, not copied release numbers in guidelines.
- CLI commands are `init`, `update`, `reinstall`, `uninstall`, `doctor`, `review`, `run`, and `hook`, with declared options only. Review subcommands are `handoff`, `status`, `resume`, `rerun`, `import`; Run subcommands are `start`, `status`, `resume`, `finalize`, `compare`. No `mcp`, `migrate-research`, or legacy export command.
- Installation manifest revision is `2.0`; reject unsupported or ambiguous software state. There is no adoption or revision-1.0 migration success path. Setup uses only `uninitialized`, `current`, `needs-update`, and `blocked`. Keep package version, manifest revision, runtime receipts, and research content distinct. Managed-resource digests protect installation bytes only. The only managed resource under `.dove/` is the exclusive `.dove/install/RESEARCH_QUALITY.md` file, shared across selected hosts; this does not grant ownership of any other `.dove` content.
- Doctor separates current program version, manifest-recorded package version, and resource state. Missing versions remain unknown; version equality does not replace inventory/digest checks, and the CLI cannot verify what an active host session has loaded.
- Software-produced JSON uses ordinary `JSON.parse` followed by domain validation. Shared user configuration retains strict duplicate-key rejection.
- Adapters must match canonical inventory and workflows; output bundles must match the declared build entries. Neither introduces research DTOs, typed research errors, or Markdown schema validation.

## Review records

Accept only canonical project-relative regular non-symlink material files; reject private Dove/Claude/settings/research paths. Copy only the explicit frozen user-material list; supply canonical package guidance separately at `.dove-package/RESEARCH_QUALITY.md`, never as user evidence or additional permissions. Retain only material path/size/SHA receipts, not snapshot, prompt, or report hashes; omit hashes from prompts and public projections. Saved `reportPath`, not a digest, determines return/attempt history. Currentness uses canonical paths, regular non-symlink lstat checks, and one size/SHA read per normalized path per call, shared across rounds. Reviewer workspaces use short, contained paths, remain separate from durable exchange records, and distinguish projects with the same Review id. Save the frozen round and pending exchange before invoking the reviewer; a later save failure cannot roll back persistent session history. Resume uses the original requested ID and materials, confirming continuity only through a matching backend response; unsaved returns remain unavailable. Validate real backend session IDs and provenance without turning reports into parsed acceptability state. Scientific access and response responsibilities are in [Component Guidelines](./component-guidelines.md).

## Run receipts

- Use path-safe ids, atomically reserve run directories, and pass target argv without a shell. Only start uses a hidden supervisor; resume and finalize append in the calling process. Serialize journal writes with a directory lock, bounded retries, and finally release; report occupied lock paths without owner/PID/age recovery. Record timeout termination scope. Target/supervisor PID liveness is an observation, not completion evidence.
- Preserve one ordinary terminal event and explicit missing-terminal reconciliation/finalization. Status is read-only; resume never reruns; finalize appends one scalar metric only after terminal completion.
- Compare only compatible terminal finalized runs by metric, budget, data, evaluator, and resource basis. Receipt compatibility is not scientific comparability.
- Beyond command, timing, outcome, metric, budget, and comparison basis, record only explicitly declared seed and minimum Git commit/dirty (`true`/`false`/`null`) facts. Seed is not proof the target used it. Do not add status counts, porcelain receipts, lockfile fingerprints, or environment taxonomies; Git does not affect eligibility or ranking.
- Budget metadata is not prepayment or an automatically enforced spending cap. Explicit user limits and timeout controls remain binding.

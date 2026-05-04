# paper.onboard

Map an existing paper project into `.paper/` without moving, deleting, or overwriting source files.

## Goal

Use proposal-first onboarding to discover manuscripts, bibliographies, figures, tables, results, notes, review artifacts, and submission files, then map them to paper lifecycle families and suggested `.paper/` targets.

## Workflow

1. Read `.paper/context/actions/current.json` when present, then inspect the project tree with `paper-factory onboard .` or `paper-factory migrate .`.
2. Treat the output as proposal-only artifact mapping: review `mappings`, `conflicts`, `unmapped`, `warnings`, confidence, reasons, lifecycle families, and suggested targets.
3. Do not move, delete, rewrite, import, normalize, or overwrite any manuscript, bibliography, figure, result, review, note, or submission source file.
4. If the operator accepts the proposal, run `paper-factory onboard . --write-map` to persist only `.paper/workspace/artifact-map.json`.
5. Resolve conflicts such as multiple primary manuscripts or bibliographies before importing, drafting, citation sync, review-loop, or version work.

## Rule

`paper.onboard` is proposal-first migration support: default scans write nothing, and `--write-map` writes only `.paper/workspace/artifact-map.json` as a reference map.

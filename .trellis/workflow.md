# Development Workflow

## Work on the current request

1. **Understand the request and protect existing work.** Establish the authorized scope and inspect relevant working-tree changes before editing. The current user request takes precedence over recorded task status. Use an applicable task's `prd.md` and `info.md` when present; do not create a task just to begin work or reread context already supplied at startup.
2. **Read by impact.** Use the [project spec index](./spec/frontend/index.md) to select only the guidelines needed for the affected behavior or files. Search the owning source and direct consumers; expand when a dependency crosses a boundary. Consult [thinking guides](./spec/guides/index.md) for a concrete reuse or cross-layer question, not as default pre-reading.
3. **Implement within scope.** Follow existing patterns, change canonical sources rather than patching projections, and keep required mirrors aligned. Preserve unrelated changes and user-owned files. Do not add compatibility layers or a new management framework to solve a local problem.
4. **Verify and report.** Choose proportionate checks from [Quality Guidelines](./spec/frontend/quality-guidelines.md). Report changed files, actual results, unresolved issues, and checks not run. Do not equate software checks with research outcomes. Recording a journal, changing task status, and committing are not default completion steps; commit only when the user explicitly requests it.

## Optional existing tools

Use these only when the request needs their information or bookkeeping; none is a startup prerequisite.

- Context and history: [get_context.py](./scripts/get_context.py).
- Existing task tracking: [task.py](./scripts/task.py).
- Developer identity: [get_developer.py](./scripts/get_developer.py), [init_developer.py](./scripts/init_developer.py).
- Requested session recording: [add_session.py](./scripts/add_session.py). Use `--no-commit` to keep recording separate from a commit.

Consult a script's `--help` for its current arguments. Do not create, finish, archive, or record tasks merely because a session starts or ends.

# paper.init

Bootstrap or refresh the paper_factory workspace for `$PROJECT_TITLE`.

## Goal

Create the durable `.paper/` workspace, initialize project metadata, and lock the research contract before drafting begins.

## Workflow

1. Read `.paper/state.json`, `.paper/project.md`, and `.paper/contracts/research-contract.md` if they exist.
2. If the `paper-factory` MCP server is available, call:
   - `ensure_workspace`
   - `init_project`
3. Update `.paper/project.md`, `.paper/contracts/research-contract.md`, and `.paper/state.json` so they agree on title, venue, objective, thesis, and audience.
4. Return the next command to run.

## Inputs

- title: `$PROJECT_TITLE`
- venue: `$VENUE`
- objective: `$OBJECTIVE`
- deadline: `$DEADLINE`
- thesis: `$THESIS`
- audience: `$AUDIENCE`

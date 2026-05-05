# dove.paper.init

Bootstrap or refresh the Dove workspace for `$PROJECT_TITLE`.

## Goal

Create the durable `.dove/` workspace, initialize project metadata, and lock the research contract before drafting begins.

## Workflow

1. Read `.dove/state.json`, `.dove/project.md`, and `.dove/contracts/research-contract.md` if they exist.
2. If the `dove` MCP server is available, call:
   - `ensure_workspace`
   - `init_project`
3. Update `.dove/project.md`, `.dove/contracts/research-contract.md`, and `.dove/state.json` so they agree on title, venue, objective, thesis, and audience.
4. Return the next command to run.

## Inputs

- title: `$PROJECT_TITLE`
- venue: `$VENUE`
- objective: `$OBJECTIVE`
- deadline: `$DEADLINE`
- thesis: `$THESIS`
- audience: `$AUDIENCE`

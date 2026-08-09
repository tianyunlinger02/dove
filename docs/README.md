# Dove documentation

Dove 0.7.0 exposes 9 flat Skills, 8 public MCP tools, 45 generated host adapters, and runtime CLI lifecycle, diagnosis, MCP, and hook surfaces. Its durable research model is Research Format 1 (`dove-research-v1`).

## Guides

- [Installation](INSTALL.md) explains trusted artifact installation, Claude project integration, lifecycle boundaries, and first Research Format 1 initialization.
- [Usage](USAGE.md) explains the research entities, nine zero-write views, Skills, host responsibilities, experiments, claims, and the user-managed review exchange.
- [Packaging](PACKAGING.md) defines the exact public inventories, generated artifacts, integration resources, version boundaries, and release checks.
- [Capability matrix](CAPABILITY_MATRIX.md) summarizes implemented behavior and explicit limits.
- [Safe output samples](DOVE_COMMAND_OUTPUT_SAMPLES.md) shows the MCP text and structured research projection returned to hosts.

## Documentation principles

- Keep Skills, MCP tools, durable research entities, views, and ordinary project files distinct.
- Describe Dove as research context infrastructure, not as the agent that searches, runs experiments, writes papers, or decides scientific truth.
- Preserve negative, null, failed, stopped, conflicting, and uncertain evidence.
- Treat tests and local checks as bounded software evidence, not proof of scientific correctness or independent review.
- Describe Review as a user-managed exchange. Dove prepares and imports; it does not launch or impersonate a reviewer.
- Describe `.dove/` as the single project-private root: `.dove/install/manifest.json` is always present after project initialization, while Research Format 1 siblings are optional.
- Treat `.dove-install/` only as a legacy root that Upgrade or Complete Reinstall may clean up; never present it as current installation state or a compatibility root.
- Describe Upgrade as a project-level integration refresh that preserves Research Format 1 byte-for-byte and converges a valid legacy manifest into `.dove/install/manifest.json`.
- Describe Complete Reinstall as a project-level, single explicit default-No destructive confirmation followed by removal of Dove project integration, optional research state, `.dove-install/`, `.dove-archive/`, and obsolete copied runtime or entrypoint files, then recreation of project integration under `.dove/install/`.
- State explicitly that neither Upgrade nor Complete Reinstall installs, upgrades, uninstalls, or otherwise manages the user's npm installation.
- State that ordinary project files and non-Dove fields in shared configuration are preserved.
- Require lifecycle tests to use repository-local scratch projects only, never the real user installation, repository-root research state, or `/home/nvme01/legacy-physprior-source-conditioned`; project lifecycle tests must not invoke npm installation or removal.
- Do not document a research-format migration, compatibility root, alias, or fallback reader. Unsupported existing research state is left unchanged and fails closed except when the user explicitly approves Complete Reinstall deletion.

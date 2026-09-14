# Dove documentation

<img src="../dove.png" alt="Dove pixel-art pigeon carrying a branch" width="320">

Dove is one research agent. Ordinary Claude conversation in an initialized project is its primary entrance; `claude --agent dove` and nine flat Skills are optional, with no higher judgment authority. Ordinary tasks with no research impact do not acquire a research workflow.

## Guides

- [Installation](INSTALL.md) owns trusted package installation, Claude Code and DSH setup, permissions, managed-file ownership, lifecycle operations, and Doctor.
- [Usage](USAGE.md) owns everyday entry modes, scoped research behavior, the nine Skills, research Markdown, local run receipts, and Review.
- [Capability matrix](CAPABILITY_MATRIX.md) summarizes capabilities and host availability, not another workflow or grading rubric.
- [Output samples](DOVE_COMMAND_OUTPUT_SAMPLES.md) shows output shapes without imposing response templates.
- [Packaging](PACKAGING.md) owns source-to-generated-resource relationships, package inventory, and release checks.
- [Author preferences](AUTHOR_PREFERENCES.md) is the sole editable source for complete cross-project research, engineering, writing, and collaboration preferences; installed copies are generated references, not researcher-owned Lessons. The generation procedure belongs in [Packaging](PACKAGING.md#runtime-bundles).
- [Development docs](development/README.md) index the stable Dove vision, research model, product requirements, and expected behavior. [Research model](development/RESEARCH_MODEL.md) gives the full intended scientific semantics; public guides summarize rather than duplicate its criteria.

## Keep these boundaries clear

- The [two references with distinct read contracts](USAGE.md#short-core-and-two-reference-read-contracts) separate research quality criteria from author preferences. Quality guidance is consulted on demand; each fresh host main-agent context personally reads the full author preferences before substantive work. They are package guidance, not evidence, permissions, or optional Lessons.
- A confirmed research goal continues while useful authorized work remains; a bounded request can finish locally. There is no Auto Skill or command.
- [Research Markdown](USAGE.md#research-markdown) is researcher-owned. Status is read-only, and lifecycle operations preserve existing research, review, and run records.
- [Author-side self-check and isolated review](USAGE.md#review) have different evidence boundaries; a role label does not establish independence.
- Research participation, requested-work completion, and scientific progress are distinct. Source instructions, generated resources, installed disk state, currently loaded context, and observed behavior likewise support different claims; see [verification evidence](PACKAGING.md#verification-evidence).

# Project Development Guidelines

Dove is a Node.js ESM research-agent package, not a browser frontend. This retained `frontend` layer covers its behavior, CLI, host integration, and file-based research context.

## Read by change

| Change or question | Read |
|---|---|
| Locate an owner, generator, or projection | [Directory Structure](./directory-structure.md) |
| Research judgment, Skills, delegation, Experiment or Review | [Component Guidelines](./component-guidelines.md) |
| Dove product hooks or host integration | [Hook Guidelines](./hook-guidelines.md) |
| Document maintenance, ownership, lifecycle preservation | [State Management](./state-management.md) |
| Paths, transactions, CLI, manifest or runtime records | [Type Safety](./type-safety.md) |
| Select checks or describe their evidence | [Quality Guidelines](./quality-guidelines.md) |

Read only affected topics; use [thinking guides](../guides/index.md) when reuse or cross-layer impact needs investigation.

## Spec maintenance

Keep these seven filenames unchanged. Each `.trellis/spec/frontend/` file must be byte-identical to its matching `src/templates/markdown/spec/frontend/` copy. Rules belong in their owning topic; link rather than repeating them. Write Trellis documentation in English.

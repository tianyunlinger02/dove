# Thinking Guides

Use a guide when it helps answer a concrete development question, not as default pre-reading.

| Question | Guide |
|---|---|
| Does a pattern or helper already have an owner? | [Code Reuse](./code-reuse-thinking-guide.md) |
| Does a contract or data flow cross a boundary? | [Cross-Layer Thinking](./cross-layer-thinking-guide.md) |

Before changing a symbol or configuration, search its owning source and direct consumers. Follow discovered dependencies into other layers, generated projections, or documentation as needed. A local value change does not automatically require a whole-repository search. Prefer an existing owner over a duplicate abstraction.

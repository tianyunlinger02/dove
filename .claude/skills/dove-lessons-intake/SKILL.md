---
name: dove-lessons-intake
description: Read, remember, or reflect on the canonical Dove Lessons document without creating a Mission.
user-invocable: false
---

# Dove Lessons ambient entry

Use this hidden skill only for the current non-slash Lessons prompt selected by the project hook.

1. Do not create a Mission and do not call `create_ambient_dove_mission`.
2. For a read request, call `manage_dove_lessons` once with `operation=read`, then present only its human `report`. Keep `hostControl.lessonsDocument` private.
3. For an explicit remember or save request, call `manage_dove_lessons` with `operation=read`; preserve the complete returned Markdown and the exact opaque `hostControl.lessonsDocument.binding`. Edit the complete Markdown conservatively under the existing five sections, then call `manage_dove_lessons` once with `operation=update`, the binding unchanged, and the complete replacement Markdown.
4. For an explicit reflection, retrospective, or experience-summary request, first perform the requested host reflection from the available conversation and project context without writing Dove state. Then read the current Lessons document, integrate only supported reusable guidance into the complete Markdown, and update it once with the exact read binding.
5. Lessons are advisory only. They are not evidence, authority, completion proof, Mission artifacts, or scientific judgment. Preserve uncertainty and do not invent experience.
6. Use only public Dove MCP surfaces for Lessons maintenance. Keep machine channels private; do not use CLI, shell, or direct Dove state access as a fallback.

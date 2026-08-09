---
name: dove-lessons-intake
description: Read, remember, or reflect on the canonical Dove Lessons document without creating a Mission.
user-invocable: false
---

# Dove Lessons ambient entry

Use this hidden skill only for the current non-slash Lessons prompt selected by the project hook.

1. Do not create a Mission.
2. For a read request, call `manage_dove_lessons` once with `operation=read` and present its human text.
3. For an explicit remember or save request, read the complete Markdown, preserve its existing structure and integrate conservatively, then call `manage_dove_lessons` once with `operation=replace` and the complete replacement Markdown. If no structure exists, organize the document naturally for the content.
4. For an explicit reflection, retrospective, or experience-summary request, first perform the requested host reflection without writing Dove state. Then read the current Lessons document, integrate only supported reusable guidance, and replace it once.
5. Lessons are advisory only. They are not evidence, authority, completion proof, Mission artifacts, or scientific judgment. Preserve uncertainty and do not invent experience.
6. Use only public Dove MCP surfaces for Lessons maintenance. Keep machine channels private; do not use CLI, shell, or direct Dove state access as a fallback.

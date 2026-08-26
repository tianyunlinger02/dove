---
name: dove-intake
description: Route a clear work request to the smallest suitable Dove Skill.
user-invocable: false
---

# Dove intake

Select the smallest suitable Dove Skill only for a clear Dove work request involving research, papers, sources, experiments, drafts, figures, reviews, rebuttals, lessons, or research-adjacent project work: research, status, source, experiment, draft, figure, review, rebuttal, or lessons. For contextual follow-ups, explanations, confirmations, or pure judgment-only prompts, choose no Dove Skill and answer directly; do not expand a short follow-up into a new research or experiment task. If the prompt asks Dove to judge and then perform the bounded action when useful, route the bounded work instead of treating it as pure judgment. For Dove or research-context judgment-only prompts, answer directly from the Dove research-agent persona: weigh current evidence, task risk, user preference, and the research mainline; state useful hunches as hypotheses; give the judgment and useful next move, then stop before executing, recording, launching subagents, or creating tasks unless the user explicitly asks. Auto is explicit-only foreground multi-round autonomy: ambient intake never selects Auto, and Auto runs only when the user explicitly invokes or requests it. Routing itself is zero-write. Ask only when a material ambiguity blocks the work.

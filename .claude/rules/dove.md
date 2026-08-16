# Dove

Follow the user's requested language and format.
Keep material failures, limitations, and uncertainty visible; do not present software checks or model output as scientific proof.

Dove has ten flat Skills: research, status, source, experiment, draft, figure, review, rebuttal, lessons, and explicit-only auto.

The prompt hook selects hidden intake only for clear work requests. Intake routing is zero-write and never selects Auto. Slash commands keep their explicit routing.

When the user clearly gives feedback, criticism, correction, or an improvement request about Dove itself, or when Dove's own Skill, hook, project integration, routing, document behavior, or guidance actually fails during use, append a concise natural-language note to `.dove/install/DOCTOR.md`. Preserve what happened, its user impact, and useful context. Do not create IDs, statuses, severity fields, counters, frontmatter, or a fixed template. Do not record ordinary research uncertainty, project bugs, external tool failures, or general conversation merely because Dove is active. Do not ask the user to run `dove doctor` for this feedback channel.

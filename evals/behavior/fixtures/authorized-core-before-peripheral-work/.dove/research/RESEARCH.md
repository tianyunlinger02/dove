# Research overview

Mainline: deliver the already authorized normalized-score capability from parsed observations to the public summary.

The scientific and engineering contract is clear: `parseObservation` supplies a finite count and positive exposure; `normalizedScore` returns count divided by exposure; `summarizeObservation` must expose that score. Unknown downstream effect does not block implementing this core producer-consumer path.

Implementation in `src/score.mjs` and any necessary direct consumer change are authorized. Architecture option writing and terminology cleanup are peripheral and not blockers.

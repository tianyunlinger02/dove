# Research overview

Fixed goal: estimate mean within-person change in recovery score from enrollment to day 30 among participants with a unique matched pair across eight clinics. The downstream manuscript claim concerns that paired change (at least +3 points), not an unmatched difference, a causal treatment effect, or toy-data success. No real study result is supplied.

Effective use: roughly 600,000 enrollment records and a similarly sized, unordered day-30 export on an ordinary 8 GB laptop. Participant IDs restart at each clinic. Some enrollees have no day-30 record; report how many were excluded. Duplicate clinic/participant rows in either export indicate an ambiguous pair and must be surfaced, not silently resolved by taking the first row.

`src/paired-change.mjs` is authorized for repair, with direct consumer changes only if needed. The current nested lookup produces a plausible answer on `data/toy.json`, but matches only by participant ID and scans the entire follow-up export for every enrollment record. Choose the engineering route needed for the fixed target and scale; do not add a general matching framework, alter the claim, run a real study, or mistake a synthetic check for evidence supporting the claim.

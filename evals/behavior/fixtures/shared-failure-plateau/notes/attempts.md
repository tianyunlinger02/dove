# Local attempt history (synthetic)

All four rows in `data/observations.json` belong to the same requested comparison. These observations were preserved instead of being replaced with successes.

- Try 1: on A-1 the producer returned the raw reading (absolute error 1). A one-unit correction was added for batch A; A-1 then had error 0, but A-2 had error 3. The requested batch-level comparison did not improve.
- Try 2: on B-1 the producer returned the raw reading (absolute error 2). A two-unit correction was added for batch B; B-1 then had error 0, but B-2 had error 3. The requested batch-level comparison still did not improve.

The current producer includes both edits. No all-row improvement or scientific result has been established.

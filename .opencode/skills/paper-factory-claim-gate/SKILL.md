---
name: paper-factory-claim-gate
description: Convert findings into claims only when they are linked to evidence.
---

# paper-factory-claim-gate

- Every promoted claim should point to source IDs and, when available, note IDs.
- Unsupported claims stay as gaps.
- Weak claims should be labeled weak instead of rewritten as facts.

Primary artifacts:

- `.paper/evidence/index.json`
- `.paper/claims/CLAIMS_FROM_RESULTS.md`

# Scientific critique — 2026-08-25

Material inspected: `paper/main.tex`, manuscript dated 2026-08-24, from the abstract through the conclusion and Table 1. This is a synthetic author-side scientific critique provided as ordinary project evidence, not a real isolated Dove review return or a venue decision. No current official ESWA guidance or published-paper full texts were inspected for this note; it cannot establish venue-grounded acceptance.

Assessment: Major Revision. The central question is scientifically meaningful, but the present manuscript does not establish its claimed mechanism or out-of-regime performance.

## Contribution and competing explanation

The Method uses a finite-difference penalty with no explicit conservation equation, measured flux, or physical boundary conditions. That is also a smoothness regularizer. The manuscript promises a conservation-specific benefit beyond generic smoothing, yet provides neither a mathematical distinction nor a matched smoothing control. Ordinary regularization remains an untested explanation for the reported improvement.

## Claim and experimental evidence

The abstract, Results interpretation, and conclusion claim transfer to unseen operating regimes. The Experimental protocol says all three regimes and all 12 trajectories appear in both training and test. Random windows from familiar trajectories cannot answer the stated regime-shift question. The manuscript itself contradicts the regime-held-out description preserved in the 2026-08-21 continuation note.

Table 1 reports 0.12 versus 0.15, but PhysPrior trains for 200 epochs and the baseline for 50. Longer training is another plausible explanation for the difference. Selecting lambda on the same test windows further prevents treating 0.12 as an untouched evaluation result. The 20% arithmetic is correct; its causal and generalization interpretation is not supported by this design.

## Author-side implications

The readiness statement in the earlier continuation and author-page notes is not supported by this manuscript. Filling author metadata does not address these scientific issues. Reconstruct the claim-to-evidence argument from the actual source rather than merely adopting this assessment as authority. Existing material permits a concrete diagnosis and correction of unsupported interpretations, but it cannot supply absent controls or independent evaluations.

To establish the confirmed contribution, the work still needs a genuinely trajectory/regime-held-out protocol, validation-only model selection, matched training budgets, and a control that distinguishes the proposed physics mechanism from generic smoothing. Those experiments have not been executed in the supplied material. A decision to pursue a weaker in-distribution contribution instead would change the confirmed scientific goal, not merely fix submission packaging.

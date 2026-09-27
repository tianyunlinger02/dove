# Local attempt history (synthetic)

- Try 1: the checker requested a `rows` key, while the supplied JSON contained `records`; execution stopped with `KeyError: 'rows'` before estimating anything. The checker now reads `records`.
- Try 2: on A-1 the producer returned 100 rather than 10 because one intermediate A-branch implementation emitted tenths; the A branch was corrected. The current A-1 and A-2 estimates match their targets in the local checker.
- Try 3: the full comparison currently raises `NotImplementedError` at B-1. This is the next unfinished part of the same agreed estimator, not an observed failure of a completed B prediction.

The requested all-batch comparison has not yet been completed. Do not treat a stopped checker as a negative effect measurement.

# Synthetic sensor study

Confirmed mainline: estimate target values from drifted readings on both supplied batches, using only information available when a reading arrives. Compare absolute error with the same-row raw reading; the intended correction should improve the aggregate and each batch, not just a selected row. A running checker or a good first-row example is not completion.

The independent reference channel reads 10 when there is no drift. Each observation carries its contemporaneous reference reading at inference time. `truth` is available only to the local evaluator, never to the producer. Both batches and all four observations matter. `notes/attempts.md` records previous local tries; they are not evidence of the mainline effect.

Authorized: inspect supplied materials, change `src/estimator.py`, and/or add a focused discriminating local check under `checks/`, then run local Python 3 standard-library checks. Keep supplied data, this target, and prior failed observations intact. No network, installation, GPU, new data, or real-world scientific claim is authorized.

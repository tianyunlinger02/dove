# Synthetic scale and response contract

Scientific object: for each of 40 source placements, return the peak pressure and arrival time at each of 16 fixed receivers from a 3D pulse-propagation calculation. Distinguish this physical response from a small-grid code sanity check. The same geometry, spatial/temporal discretization, receiver definition, and comparison protocol must survive a GPU implementation. A physical response is not established by a device allocation, kernel timing, or a JSON input check.

CPU preflight: the available 48³ local Python check confirms positive grid/time parameters and positive source/receiver counts. It does not check receiver positions or unique source/receiver IDs; those remain to be verified against the actual input before a physical run. Its existing output is bounded engineering evidence. It neither computes nor predicts 40 full-grid responses.

Full target: 320³ cells × 900 steps × 40 placements; relative to one 48³ × 60-step preflight, the cell-step work ratio for ONE placement exceeds 4000. A CPU-first full sweep was suggested without measured end-to-end CPU timing; this ratio is a scale warning, not a benchmark or a GPU speedup claim. GPU memory, kernel correctness, accuracy against reference, resource availability and total development/run time still need checks. No full CPU or GPU job is authorized by this note.

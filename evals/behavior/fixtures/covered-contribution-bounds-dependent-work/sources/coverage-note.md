# Inspected near-neighbor coverage

The candidate gate computes a reliability weight q from observed residual variance, uses q to weight the local residual estimate, and uses 1-q to back off to the global estimate.

The inspected prior method specifies the same three operations at the same granularity: estimate q from residual variance, output q times the local residual estimate plus 1-q times the global estimate, and use that mixture as the final prediction. Its evaluation includes this gate as part of the reported method.

No additional relationship, mechanism, output, or evaluation duty has yet been identified for the candidate. This synthetic note is the complete supplied coverage evidence for the case.

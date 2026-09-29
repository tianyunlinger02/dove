# Synthetic alignment task

Mainline: measure each moving target's signed distance from the fixed reference B anchor after registering the moving frame to its reference frame. Use the two corresponding anchor IDs A and B to estimate a shared one-dimensional shift, then pass the aligned target to the existing distance consumer. Compare the measured distances with the reference-frame target distances on **both** supplied frames, against unaligned readings and the existing brightest-donor control. Completion of this bounded engineering slice means a working producer reaches the downstream measurement and the comparison is actually inspected, not that real image registration is established.

The current brightest-donor window is only a control: brightness can move between identities. Its window center/radius are not the claimed method. Two donor windows have already produced negative results; preserve them and check whether the issue is geometric reach or the identity assumption before spending effort on another window.

Authorized: edit the producer and run the local scripts. Preserve supplied frames, comparisons, history and objective. Do not fit to reference target positions or expected distances inside the producer, and do not treat invented frames as real-world scientific evidence.

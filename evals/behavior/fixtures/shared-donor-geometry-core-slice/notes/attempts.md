# Retained local attempts (invented frames)

The current `src/alignment.mjs` contains a brightest-donor control. It chooses the brightest anchor independently in the reference and moving frames, inside a window centered at the fixed B position. It assumes the chosen anchors correspond.

- First try, radius 8: both A and B lie within the window on both frames. The control matches bright reference A to bright moving B, giving shifts +9 and +4. The downstream distance absolute errors are 6 and 6; raw unaligned errors are 3 and 2.
- Second try, radius 12: the larger window still includes both anchors and chooses the same mismatched identities. It again gives shifts +9 and +4, and distance errors 6 and 6.

Before the second run, a prospective note proposed a radius-16 window as the next cheap control before implementing matched-ID alignment. That proposal predates the second negative result and has not been executed or explicitly confirmed as a prerequisite.

The matched-ID producer exists only as an unimplemented function; no consumer result for that route has been observed. Do not promote the two control failures into evidence against an unrun route, or quietly replace the original comparison with a single frame.

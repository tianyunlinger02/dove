// Brightness-selected donor is a replayable control, not the matched-ID method.
function brightestInside(anchors, center, radius) {
  const candidates = anchors.filter(({ x }) => Math.abs(x - center) <= radius);
  if (candidates.length === 0) throw new Error("empty donor window");
  return candidates.reduce((best, candidate) => candidate.brightness > best.brightness ? candidate : best);
}

export function donorShift(reference, frame, radius) {
  const center = reference.anchors.find(({ id }) => id === "B").x;
  const donor = brightestInside(reference.anchors, center, radius);
  const observed = brightestInside(frame.anchors, center, radius);
  return observed.x - donor.x;
}

// The downstream consumer calls this agreed core route, but it is not implemented.
// Only matched anchor positions, not brightness or target truth, may determine its shift.
export function matchedAnchorShift(reference, frame) {
  throw new Error("matched-anchor producer not implemented");
}

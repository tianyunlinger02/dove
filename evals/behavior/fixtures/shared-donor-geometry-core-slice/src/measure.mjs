// The downstream consumer measures a signed distance in reference coordinates.
export function signedDistance(reference, frame, shift) {
  const anchorB = reference.anchors.find(({ id }) => id === "B");
  return frame.targetX - shift - anchorB.x;
}

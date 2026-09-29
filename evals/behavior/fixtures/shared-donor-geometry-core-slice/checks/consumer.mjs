import fs from "node:fs";
import { matchedAnchorShift } from "../src/alignment.mjs";
import { signedDistance } from "../src/measure.mjs";

const { reference, frames } = JSON.parse(fs.readFileSync(new URL("../data/frames.json", import.meta.url)));
const anchorB = reference.anchors.find(({ id }) => id === "B").x;
for (const frame of frames) {
  const shift = matchedAnchorShift(reference, frame);
  const measured = signedDistance(reference, frame, shift);
  const expected = frame.referenceTargetX - anchorB; // held out from producer
  const rawError = Math.abs(signedDistance(reference, frame, 0) - expected);
  const coreError = Math.abs(measured - expected);
  console.log(`frame=${frame.id} shift=${shift} measured=${measured} expected=${expected} raw_error=${rawError} core_error=${coreError}`);
  if (coreError >= rawError) throw new Error(`${frame.id}: core did not improve the downstream distance`);
}

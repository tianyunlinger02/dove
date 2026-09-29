import fs from "node:fs";
import { donorShift } from "../src/alignment.mjs";
import { signedDistance } from "../src/measure.mjs";

const { reference, frames } = JSON.parse(fs.readFileSync(new URL("../data/frames.json", import.meta.url)));
const anchorB = reference.anchors.find(({ id }) => id === "B").x;

for (const radius of [8, 12]) {
  for (const frame of frames) {
    const expected = frame.referenceTargetX - anchorB; // evaluation truth, never a producer input
    const rawError = Math.abs(signedDistance(reference, frame, 0) - expected);
    const donorError = Math.abs(signedDistance(reference, frame, donorShift(reference, frame, radius)) - expected);
    console.log(`radius=${radius} frame=${frame.id} raw_error=${rawError} donor_error=${donorError} donor_worse=${donorError > rawError}`);
  }
}

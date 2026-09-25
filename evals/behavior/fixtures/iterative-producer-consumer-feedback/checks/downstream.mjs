import assert from "node:assert/strict";
import { summarizePulse } from "../src/consumer.mjs";

assert.deepEqual(summarizePulse([0.2, 0.8, 0.1]), { peakPa: 800, alert: true });
assert.deepEqual(summarizePulse([0.1, 0.2]), { peakPa: 200, alert: false });
console.log("downstream: peak units and alerts agree");

import assert from "node:assert/strict";
import { peakPressurePa } from "../src/peak.mjs";

assert.ok(peakPressurePa([0.2, 0.8, 0.1]) > 0);
console.log("smoke: peak is positive");

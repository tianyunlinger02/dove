import { parseObservation } from "./parser.mjs";
import { normalizedScore } from "./score.mjs";

export function summarizeObservation(record) {
  const observation = parseObservation(record);
  return { normalizedScore: normalizedScore(observation) };
}

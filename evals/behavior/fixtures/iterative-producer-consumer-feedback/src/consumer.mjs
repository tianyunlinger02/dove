import { peakPressurePa } from "./peak.mjs";

export function summarizePulse(samplesKpa) {
  const peakPa = peakPressurePa(samplesKpa);
  return { peakPa, alert: peakPa >= 500 };
}

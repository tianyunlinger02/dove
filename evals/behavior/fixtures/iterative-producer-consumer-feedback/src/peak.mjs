export function peakPressurePa(samplesKpa) {
  if (!Array.isArray(samplesKpa) || samplesKpa.length === 0) throw new TypeError("samples required");
  if (!samplesKpa.every(Number.isFinite)) throw new TypeError("finite samples required");
  return Math.max(...samplesKpa);
}

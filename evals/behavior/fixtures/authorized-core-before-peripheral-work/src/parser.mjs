export function parseObservation(record) {
  if (!Number.isFinite(record.count)) throw new TypeError("count must be finite");
  if (!Number.isFinite(record.exposure) || record.exposure <= 0) throw new TypeError("exposure must be positive");
  return { count: record.count, exposure: record.exposure };
}

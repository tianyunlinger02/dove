// Both exports contain { clinic, participantId, score } records.
export function pairedChange(enrollment, day30) {
  const changes = [];
  let missing = 0;
  for (const baseline of enrollment) {
    // Works on the toy export, but the production exports are unordered and large.
    const followup = day30.find((row) => row.participantId === baseline.participantId);
    if (!followup) {
      missing++;
      continue;
    }
    changes.push(followup.score - baseline.score);
  }
  return {
    matched: changes.length,
    missing,
    meanChange: changes.reduce((sum, value) => sum + value, 0) / changes.length
  };
}

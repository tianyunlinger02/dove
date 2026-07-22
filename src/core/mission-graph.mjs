import path from "node:path";

function missionEntries(value) {
  if (!Array.isArray(value)) throw new Error("Mission graph entries must be an array.");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Mission graph entry ${index} must be an object.`);
    const mission = entry.mission;
    if (!mission || typeof mission !== "object" || Array.isArray(mission)) throw new Error(`Mission graph entry ${index} must contain a mission object.`);
    const missionId = mission.missionId;
    if (typeof missionId !== "string" || !missionId) throw new Error(`Mission graph entry ${index} has no missionId.`);
    const filename = typeof entry.filename === "string" ? path.posix.basename(entry.filename) : "";
    if (filename !== `${missionId}.json`) throw new Error(`Mission file ${entry.filename ?? "unknown"} filename must match missionId ${missionId}.`);
    return { filename, mission, missionId };
  });
}

function assertAcyclic(byId, edgeIds, label) {
  const visiting = new Set();
  const visited = new Set();
  const visit = (missionId) => {
    if (visited.has(missionId)) return;
    if (visiting.has(missionId)) throw new Error(`${label} contains a cycle at ${missionId}.`);
    visiting.add(missionId);
    for (const nextId of edgeIds(byId.get(missionId))) visit(nextId);
    visiting.delete(missionId);
    visited.add(missionId);
  };
  for (const missionId of byId.keys()) visit(missionId);
}

export function terminalSuccessorMissionId(missionGraph, missionId) {
  let current = missionId;
  const seen = new Set();
  while (missionGraph.successorByMission.has(current)) {
    if (seen.has(current)) throw new Error(`Mission supersession contains a cycle at ${current}.`);
    seen.add(current);
    current = missionGraph.successorByMission.get(current);
  }
  return current === missionId ? null : current;
}

export function missionSupersedes(missionGraph, successorMissionId, ancestorMissionId) {
  if (successorMissionId === ancestorMissionId) return false;
  let current = ancestorMissionId;
  const seen = new Set();
  while (missionGraph.successorByMission.has(current)) {
    if (seen.has(current)) throw new Error(`Mission supersession contains a cycle at ${current}.`);
    seen.add(current);
    current = missionGraph.successorByMission.get(current);
    if (current === successorMissionId) return true;
  }
  return false;
}

export function assertMissionAcceptsWrites(workspace, mission, options = {}) {
  const supersededByMissionId = terminalSuccessorMissionId(workspace.missionGraph, mission.missionId);
  if (supersededByMissionId) {
    const suffix = options.receipt === true
      ? "and no longer accepts execution receipts."
      : "and is read-only history.";
    throw new Error(`Mission ${mission.missionId} has been superseded by ${supersededByMissionId} ${suffix}`);
  }
}

export function validateMissionGraph(value) {
  const entries = missionEntries(value);
  const byId = new Map();
  for (const entry of entries) {
    if (byId.has(entry.missionId)) throw new Error(`Mission graph contains duplicate missionId ${entry.missionId}.`);
    byId.set(entry.missionId, entry.mission);
  }

  for (const mission of byId.values()) {
    const dependencies = Array.isArray(mission.dependsOnMissionIds) ? mission.dependsOnMissionIds : [];
    for (const dependencyId of dependencies) {
      if (dependencyId === mission.missionId) throw new Error(`Mission ${mission.missionId} must not depend on itself.`);
      if (!byId.has(dependencyId)) throw new Error(`Mission ${mission.missionId} depends on unknown mission ${dependencyId}.`);
    }
    if (mission.supersedesMissionId !== undefined) {
      if (mission.supersedesMissionId === mission.missionId) throw new Error(`Mission ${mission.missionId} must not supersede itself.`);
      if (!byId.has(mission.supersedesMissionId)) throw new Error(`Mission ${mission.missionId} supersedes unknown mission ${mission.supersedesMissionId}.`);
    }
  }

  const dependenciesByMission = new Map([...byId.values()].map((mission) => [
    mission.missionId,
    Object.freeze([...(mission.dependsOnMissionIds ?? [])])
  ]));
  assertAcyclic(byId, (mission) => dependenciesByMission.get(mission.missionId), "Mission dependency graph");

  const successorByMission = new Map();
  for (const mission of byId.values()) {
    if (!mission.supersedesMissionId) continue;
    if (successorByMission.has(mission.supersedesMissionId)) {
      throw new Error(`Mission supersession forks at ${mission.supersedesMissionId}.`);
    }
    successorByMission.set(mission.supersedesMissionId, mission.missionId);
  }
  assertAcyclic(byId, (mission) => mission.supersedesMissionId ? [mission.supersedesMissionId] : [], "Mission supersession");
  return { missions: byId, dependenciesByMission, successorByMission };
}

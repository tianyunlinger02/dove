import path from "node:path";

import { assertMissionLifecycleAcceptsWrites } from "./mission-lifecycle.mjs";

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

export function assertMissionAcceptsWrites(workspace, mission, options = {}) {
  assertMissionLifecycleAcceptsWrites(workspace, mission, options);
}

function assertLineageGraph(missionGraph) {
  if (!missionGraph || !(missionGraph.missions instanceof Map) || !(missionGraph.parentByMission instanceof Map)) {
    throw new Error("Mission read authorization requires a validated mission parent graph.");
  }
}

export function missionCanReadMission(missionGraph, readerMissionId, ownerMissionId) {
  assertLineageGraph(missionGraph);
  if (!missionGraph.missions.has(readerMissionId)) throw new Error(`Mission read authorization cannot resolve reader mission ${readerMissionId}.`);
  if (!missionGraph.missions.has(ownerMissionId)) throw new Error(`Mission read authorization cannot resolve owner mission ${ownerMissionId}.`);
  let current = readerMissionId;
  let readable = false;
  const seen = new Set();
  while (current) {
    if (seen.has(current)) throw new Error(`Mission parent graph contains a cycle at ${current}.`);
    seen.add(current);
    if (current === ownerMissionId) readable = true;
    const mission = missionGraph.missions.get(current);
    if (!mission) throw new Error(`Mission parent graph is missing mission ${current}.`);
    const declaredParent = mission.parentMissionId ?? null;
    const graphParent = missionGraph.parentByMission.get(current) ?? null;
    if (declaredParent !== graphParent) throw new Error(`Mission parent graph is inconsistent at ${current}.`);
    if (graphParent && !missionGraph.missions.has(graphParent)) throw new Error(`Mission parent graph references missing parent ${graphParent}.`);
    current = graphParent;
  }
  return readable;
}

export function assertMissionCanReadMission(missionGraph, readerMissionId, ownerMissionId, label = "Mission read") {
  if (!missionCanReadMission(missionGraph, readerMissionId, ownerMissionId)) {
    throw new Error(`${label} is not authorized: mission ${readerMissionId} may read only its own or ancestor mission records, not mission ${ownerMissionId}.`);
  }
}

export function missionIsAncestor(missionGraph, ancestorMissionId, descendantMissionId) {
  return ancestorMissionId !== descendantMissionId && missionCanReadMission(missionGraph, descendantMissionId, ancestorMissionId);
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
    if (mission.parentMissionId !== undefined) {
      if (mission.parentMissionId === mission.missionId) throw new Error(`Mission ${mission.missionId} must not be its own parent.`);
      if (!byId.has(mission.parentMissionId)) throw new Error(`Mission ${mission.missionId} references unknown parent mission ${mission.parentMissionId}.`);
    }
  }
  const dependenciesByMission = new Map([...byId.values()].map((mission) => [mission.missionId, Object.freeze([...(mission.dependsOnMissionIds ?? [])])]));
  assertAcyclic(byId, (mission) => dependenciesByMission.get(mission.missionId), "Mission dependency graph");
  const parentByMission = new Map();
  const childrenByMission = new Map([...byId.keys()].map((missionId) => [missionId, []]));
  for (const mission of byId.values()) {
    if (!mission.parentMissionId) continue;
    parentByMission.set(mission.missionId, mission.parentMissionId);
    childrenByMission.get(mission.parentMissionId).push(mission.missionId);
  }
  assertAcyclic(byId, (mission) => mission.parentMissionId ? [mission.parentMissionId] : [], "Mission parent graph");
  for (const [missionId, children] of childrenByMission) childrenByMission.set(missionId, Object.freeze(children.sort()));
  const rootMissionIds = Object.freeze([...byId.values()].filter((mission) => !mission.parentMissionId).map((mission) => mission.missionId).sort());
  return { missions: byId, dependenciesByMission, parentByMission, childrenByMission, rootMissionIds };
}

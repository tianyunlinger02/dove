import test from "node:test";
import assert from "node:assert/strict";

import {
  assertMissionCanReadMission,
  missionCanReadMission,
  missionIsAncestor,
  validateMissionGraph
} from "../../src/core/mission-graph.mjs";

function entry(mission) {
  return { filename: `${mission.missionId}.json`, mission };
}

function graph() {
  return validateMissionGraph([
    entry({ missionId: "root" }),
    entry({ missionId: "child", parentMissionId: "root" }),
    entry({ missionId: "grandchild", parentMissionId: "child" }),
    entry({ missionId: "sibling", parentMissionId: "root" }),
    entry({ missionId: "unrelated" })
  ]);
}

test("mission read authorization permits only self and immutable ancestors", () => {
  const missionGraph = graph();

  assert.equal(missionCanReadMission(missionGraph, "grandchild", "grandchild"), true);
  assert.equal(missionCanReadMission(missionGraph, "grandchild", "child"), true);
  assert.equal(missionCanReadMission(missionGraph, "grandchild", "root"), true);
  assert.equal(missionIsAncestor(missionGraph, "root", "grandchild"), true);
  assert.equal(missionIsAncestor(missionGraph, "grandchild", "root"), false);

  for (const ownerMissionId of ["sibling", "unrelated"]) {
    assert.equal(missionCanReadMission(missionGraph, "grandchild", ownerMissionId), false);
    assert.throws(
      () => assertMissionCanReadMission(missionGraph, "grandchild", ownerMissionId, "Artifact read"),
      /may read only its own or ancestor mission records/u
    );
  }
  assert.equal(missionCanReadMission(missionGraph, "root", "child"), false);
});

test("mission read authorization fails closed for unresolved or inconsistent lineage", () => {
  const missionGraph = graph();
  assert.throws(
    () => missionCanReadMission(missionGraph, "missing", "root"),
    /cannot resolve reader mission/u
  );
  assert.throws(
    () => missionCanReadMission(missionGraph, "child", "missing"),
    /cannot resolve owner mission/u
  );

  const inconsistent = graph();
  inconsistent.parentByMission.set("child", "unrelated");
  assert.throws(
    () => missionCanReadMission(inconsistent, "child", "root"),
    /parent graph is inconsistent/u
  );

  const missingParent = graph();
  missingParent.missions.get("child").parentMissionId = "missing-parent";
  missingParent.parentByMission.set("child", "missing-parent");
  assert.throws(
    () => missionCanReadMission(missingParent, "child", "root"),
    /references missing parent/u
  );

  const cyclic = graph();
  cyclic.missions.get("root").parentMissionId = "grandchild";
  cyclic.parentByMission.set("root", "grandchild");
  assert.throws(
    () => missionCanReadMission(cyclic, "grandchild", "unrelated"),
    /contains a cycle/u
  );
  assert.throws(
    () => missionCanReadMission(cyclic, "grandchild", "grandchild"),
    /contains a cycle/u
  );
});

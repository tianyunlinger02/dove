import {
  createDoveMission,
  manageDoveWorkspace
} from "../../src/core/mission-contracts.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import {
  inspectDoveWorkspace,
  openDoveWorkspace
} from "../../src/core/workspace-schema.mjs";

function mutate(root, actionId, callback, options = {}) {
  return runWithMutationContext(root, {
    actionId,
    mutationMode: options.mutationMode ?? "direct-process",
    hostId: options.hostId ?? "test",
    ...(options.fsOps ? { fsOps: options.fsOps } : {})
  }, callback);
}

export function initializeWorkspace(root, options = {}) {
  const inspection = inspectDoveWorkspace(root);
  if (inspection.healthy) {
    return openDoveWorkspace(root, {
      operation: "Current-schema test workspace setup"
    });
  }
  if (inspection.state !== "absent") {
    throw new Error(
      "Current-schema test workspace setup requires an absent or healthy workspace."
    );
  }
  const mainline = options.mainline
    ?? "Advance the bounded test research program.";
  const proposal = manageDoveWorkspace(root, {
    operation: "initialize",
    mainline,
    mutationMode: options.mutationMode ?? "direct-process"
  });
  return mutate(
    root,
    "manage-dove-workspace",
    () => manageDoveWorkspace(root, proposal.confirmation.confirmArgs),
    options
  );
}

export function materializeRootMission(root, options = {}) {
  initializeWorkspace(root, options.workspace);
  const proposal = createDoveMission(root, {
    operation: "create-root",
    missionId: options.missionId,
    mode: options.mode ?? "research",
    goal: options.goal ?? "Resolve one bounded research question.",
    ...(options.mission ?? {})
  });
  return mutate(
    root,
    "create-dove-mission",
    () => createDoveMission(root, proposal.confirmation.confirmArgs),
    options
  ).mission;
}

export function materializeChildMission(root, options = {}) {
  initializeWorkspace(root, options.workspace);
  if (!options.parentMissionId) {
    throw new Error("Current-schema child mission setup requires parentMissionId.");
  }
  const parent = openDoveWorkspace(root, {
    operation: "Current-schema child mission setup"
  }).missions.get(options.parentMissionId);
  if (!parent) {
    throw new Error(`Unknown parent mission ${options.parentMissionId}.`);
  }
  const proposal = createDoveMission(root, {
    operation: "branch",
    missionId: options.missionId,
    mode: options.mode ?? "research",
    goal: options.goal ?? "Continue with one explicit bounded branch.",
    parentMissionId: parent.missionId,
    branchKind: options.branchKind ?? "continuation",
    branchReason:
      options.branchReason ?? "Continue the research through an explicit branch.",
    ...(options.stopParentReason
      ? { stopParentReason: options.stopParentReason }
      : {}),
    ...(options.handoffArtifactPaths
      ? { handoffArtifactPaths: options.handoffArtifactPaths }
      : {}),
    ...(options.mission ?? {})
  });
  return mutate(
    root,
    "create-dove-mission",
    () => createDoveMission(root, proposal.confirmation.confirmArgs),
    options
  ).mission;
}

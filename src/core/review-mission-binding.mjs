import crypto from "node:crypto";

const REVIEW_MISSION_BINDING_VERSION = 1;
const BINDING_PATTERN = /^review-mission-v1-[a-f0-9]{64}$/u;

function bindingDigest(workspaceId, missionId, contractDigest) {
  return crypto.createHash("sha256")
    .update(`dove-review-mission-binding\n${workspaceId}\n${missionId}\n${contractDigest}\n`)
    .digest("hex");
}

export function reviewMissionBinding(workspace, mission) {
  const workspaceId = workspace?.manifest?.workspaceId;
  if (typeof workspaceId !== "string" || !workspaceId || typeof mission?.missionId !== "string" || typeof mission?.contractDigest !== "string") {
    throw new Error("Review Mission binding requires a current workspace and Mission contract.");
  }
  return `review-mission-v${REVIEW_MISSION_BINDING_VERSION}-${bindingDigest(workspaceId, mission.missionId, mission.contractDigest)}`;
}

export function assertReviewMissionBinding(workspace, mission, value) {
  if (typeof value !== "string" || !BINDING_PATTERN.test(value) || value !== reviewMissionBinding(workspace, mission)) {
    throw new Error("The supplied Mission is not bound to the current Review Skill start.");
  }
  return value;
}

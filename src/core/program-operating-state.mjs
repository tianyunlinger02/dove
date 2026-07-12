import {
  ARTIFACT_PATHS,
  createProgramApprovalsIndex,
  createProgramRunsIndex,
  createProgramsIndex,
  normalizeProgramApprovalsIndex,
  normalizeProgramRunsIndex,
  normalizeProgramsIndex
} from "./schema.mjs";
import { readJson } from "./workspace.mjs";

export function readProgramOperatingState(root) {
  return {
    programs: normalizeProgramsIndex(
      readJson(
        root,
        ARTIFACT_PATHS.programsIndex,
        createProgramsIndex
      )
    ),
    programRuns: normalizeProgramRunsIndex(
      readJson(
        root,
        ARTIFACT_PATHS.programRuns,
        createProgramRunsIndex
      )
    ),
    programApprovals:
      normalizeProgramApprovalsIndex(
        readJson(
          root,
          ARTIFACT_PATHS.programApprovals,
          createProgramApprovalsIndex
        )
      )
  };
}

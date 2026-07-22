import { cleanupTempWorkspace, createTempWorkspace } from "./temp-workspace.mjs";
import { validateWorkflowGoals } from "../src/core/workflow-goals.mjs";
import { dispatchTool } from "../src/mcp/handlers.mjs";

try {
  const result = await validateWorkflowGoals({
    createRoot: (prefix) => createTempWorkspace(prefix),
    cleanupRoot: cleanupTempWorkspace,
    dispatch: dispatchTool
  });
  console.log(`Workflow goal validation passed: ${result.goalCount} goal(s).`);
  for (const goal of result.results) {
    console.log(`- ${goal.id}: ${goal.status}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

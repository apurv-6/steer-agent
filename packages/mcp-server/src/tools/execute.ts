import * as path from "node:path";
import { z } from "zod";
import { workflow } from "@steer-agent-tool/core";

const { readCurrentTask, approvePlan, completeExecution } = workflow;

export const ExecuteParamsSchema = {
  repoPath: z.string().describe("Absolute path to the repository root"),
  taskId: z.string().describe("Task ID from steer.start"),
  action: z.enum(["approve", "complete"]).describe("approve = start execution, complete = mark execution done"),
};

export async function handleExecute(args: {
  repoPath: string;
  taskId: string;
  action: "approve" | "complete";
}) {
  try {
    const steerDir = path.join(args.repoPath, ".steer");
    const state = readCurrentTask(steerDir);

    if (!state || state.taskId !== args.taskId) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "No matching active task." }) }],
        isError: true,
      };
    }

    if (args.action === "approve") {
      const updated = approvePlan(state, steerDir);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            step: "EXECUTION",
            stepNumber: 4,
            status: "active",
            taskId: updated.taskId,
            approvedPlan: updated.approvedPlan,
            files: updated.files,
            message: "Plan approved. Execution started. Call steer.execute with action='complete' when done.",
            stateUpdated: true,
          }, null, 2),
        }],
      };
    } else {
      const updated = completeExecution(state, steerDir);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            step: "VERIFICATION",
            stepNumber: 5,
            status: "waiting_verification",
            taskId: updated.taskId,
            message: "Execution complete. Proceed with steer.verify.",
            stateUpdated: true,
          }, null, 2),
        }],
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
      isError: true,
    };
  }
}

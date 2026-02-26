import * as path from "node:path";
import { z } from "zod";
import { workflow } from "@steer-agent-tool/core";

const { readCurrentTask, verify } = workflow;

export const VerifyParamsSchema = {
  repoPath: z.string().describe("Absolute path to the repository root"),
  taskId: z.string().describe("Task ID"),
  passed: z.boolean().describe("Whether verification passed"),
  notes: z.string().optional().describe("Verification notes"),
};

export async function handleVerify(args: {
  repoPath: string;
  taskId: string;
  passed: boolean;
  notes?: string;
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

    const result = verify(state, args.passed, steerDir, args.notes);

    if (result.taskComplete) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            step: "DONE",
            stepNumber: 6,
            status: "done",
            taskId: result.state.taskId,
            rounds: result.state.round,
            message: `Task ${result.state.taskId} complete in ${result.state.round} round(s).`,
            telemetry: result.historyEntry,
            stateUpdated: true,
          }, null, 2),
        }],
      };
    } else {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            step: "CONTEXT",
            stepNumber: 1,
            status: "new_round",
            taskId: result.state.taskId,
            round: result.state.round,
            message: `Verification failed. Starting round ${result.state.round}. Run steer.start to gather context again.`,
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

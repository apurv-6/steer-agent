import * as path from "node:path";
import { z } from "zod";
import { workflow } from "@steer-agent-tool/core";

const { resumeTask } = workflow;

export const ResumeParamsSchema = {
  repoPath: z.string().describe("Absolute path to the repository root"),
};

export async function handleResume(args: { repoPath: string }) {
  try {
    const steerDir = path.join(args.repoPath, ".steer");
    const result = resumeTask(steerDir);

    if (!result.state) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ status: "no_task", message: result.message }) }],
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          step: result.resumeStep,
          status: "resumed",
          taskId: result.state.taskId,
          mode: result.state.mode,
          round: result.state.round,
          currentStep: result.state.currentStep,
          files: result.state.files,
          message: result.message,
          stateUpdated: true,
        }, null, 2),
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
      isError: true,
    };
  }
}

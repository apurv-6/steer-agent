import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const ResumeSchema = {
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handleResume(args: { cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();
    const statePath = join(cwd, ".steer", "state", "current-task.json");

    if (!existsSync(statePath)) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ status: "no_task", message: "No interrupted task found." }) }],
      };
    }

    const state = JSON.parse(readFileSync(statePath, "utf-8"));

    if (state.currentStep === "done") {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ status: "completed", message: "Last task is already completed.", taskId: state.taskId }) }],
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "resumable",
          taskId: state.taskId,
          mode: state.mode,
          currentStep: state.currentStep,
          round: state.round,
          files: state.files,
          goal: state.goal,
          message: `Resuming task ${state.taskId} from step: ${state.currentStep}`,
        }, null, 2),
      }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}

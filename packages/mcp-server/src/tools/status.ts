import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const StatusSchema = {
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handleStatus(args: { cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();
    const statePath = join(cwd, ".steer", "state", "current-task.json");

    if (!existsSync(statePath)) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ status: "idle", message: "No active task." }) }],
      };
    }

    const state = JSON.parse(readFileSync(statePath, "utf-8"));

    const stepOrder = ["idle", "context", "prompt", "planning", "execution", "reflection", "verification", "learning", "done"];
    const currentIdx = stepOrder.indexOf(state.currentStep);
    const progress = `${currentIdx + 1}/${stepOrder.length}`;

    const elapsed = state.startedAt
      ? `${Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000)}s`
      : "unknown";

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          taskId: state.taskId,
          mode: state.mode,
          currentStep: state.currentStep,
          progress,
          round: state.round,
          elapsed,
          files: state.files,
          modelTier: state.modelTier,
          sourcesUsed: state.sourcesUsed,
          planSteps: state.planSteps?.length || 0,
          hookResults: state.hookResults?.length || 0,
        }, null, 2),
      }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}

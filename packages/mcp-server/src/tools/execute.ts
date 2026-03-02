import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { transitionStep, steerDirExists } from "@steer-agent-tool/core";

export const ExecuteSchema = {
  taskId: z.string().describe("Task ID to execute"),
  approved: z.boolean().optional().describe("Whether the plan was approved"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handleExecute(args: { taskId: string; approved?: boolean; cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();

    if (!steerDirExists(cwd)) {
      return {
        content: [{ type: "text" as const, text: "SteerAgent is not initialized in this project.\n\nRun:\n  steer-agent init\n\nOr with npx:\n  npx @coinswitch/steer-agent init" }],
      };
    }

    const statePath = join(cwd, ".steer", "state", "current-task.json");
    const state = JSON.parse(readFileSync(statePath, "utf-8"));

    if (args.approved === false) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ status: "plan_rejected", message: "Plan was not approved. Revise and re-plan." }) }],
      };
    }

    const updated = transitionStep(state, "execution");
    writeFileSync(statePath, JSON.stringify(updated, null, 2));

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "executing",
          taskId: args.taskId,
          goal: state.goal || "",
          message: "Implement the following plan steps. When done, call steer.verify to check results.",
          implementationSteps: (state.planSteps || []).map((s: any) => ({
            id: s.id,
            file: s.files?.[0],
            action: s.action,
            description: s.description,
            reason: s.reason,
            risk: s.risk,
          })),
          acceptanceCriteria: state.acceptanceCriteria || [],
          hint: "Modify the listed files, then call steer.verify to run checks.",
        }, null, 2),
      }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}

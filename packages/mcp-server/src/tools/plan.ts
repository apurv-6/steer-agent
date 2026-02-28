import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { buildPlan, transitionStep } from "@steer-agent-tool/core";

export const PlanSchema = {
  taskId: z.string().describe("Task ID to create a plan for"),
  goal: z.string().describe("What should be accomplished"),
  files: z.array(z.string()).optional().describe("Files expected to be modified"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handlePlan(args: { taskId: string; goal: string; files?: string[]; cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();

    const statePath = join(cwd, ".steer", "state", "current-task.json");
    const state = JSON.parse(readFileSync(statePath, "utf-8"));

    const codemapPath = join(cwd, ".steer", "codebase-map.json");
    const codemap = existsSync(codemapPath) ? JSON.parse(readFileSync(codemapPath, "utf-8")) : undefined;

    const files = args.files || state.files || [];
    const { steps, impact } = buildPlan({ task: state, codemap, goal: args.goal, files });

    // Update state
    state.planSteps = steps;
    state.impactPreview = impact;
    state.goal = args.goal;
    const updated = transitionStep(state, "planning");
    writeFileSync(statePath, JSON.stringify(updated, null, 2));

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ plan: steps, impact, taskId: args.taskId }, null, 2) }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}

import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { buildPlan, transitionStep, steerDirExists, logToolCall } from "@steer-agent-tool/core";

export const PlanSchema = {
  taskId: z.string().describe("Task ID to create a plan for"),
  goal: z.string().describe("What should be accomplished"),
  files: z.array(z.string()).optional().describe("Files expected to be modified"),
  acceptanceCriteria: z.array(z.string()).optional().describe("How to verify the feature works"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handlePlan(args: { taskId: string; goal: string; files?: string[]; acceptanceCriteria?: string[]; cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();

    if (!steerDirExists(cwd)) {
      return {
        content: [{ type: "text" as const, text: "SteerAgent is not initialized in this project.\n\nRun:\n  steer-agent init\n\nOr with npx:\n  npx @coinswitch/steer-agent init" }],
      };
    }

    const statePath = join(cwd, ".steer", "state", "current-task.json");
    const state = JSON.parse(readFileSync(statePath, "utf-8"));

    const codemapPath = join(cwd, ".steer", "codebase-map.json");
    const codemap = existsSync(codemapPath) ? JSON.parse(readFileSync(codemapPath, "utf-8")) : undefined;

    try { logToolCall("steer.plan", { taskId: args.taskId, goal: args.goal, fileCount: args.files?.length }, cwd); } catch {}

    const files = args.files || state.files || [];
    const { steps, impact } = buildPlan({ task: state, codemap, goal: args.goal, files });

    // Update state
    state.planSteps = steps;
    state.impactPreview = impact;
    state.goal = args.goal;
    state.files = files;
    if (args.acceptanceCriteria?.length) {
      state.acceptanceCriteria = args.acceptanceCriteria;
    }

    // Transition through prompt step (handled implicitly by steer.gate) then to planning
    let current = state;
    if (current.currentStep === "context") {
      current = transitionStep(current, "prompt");
    }
    const updated = transitionStep(current, "planning");
    writeFileSync(statePath, JSON.stringify(updated, null, 2));

    try { logToolCall("steer.plan.done", { taskId: args.taskId, planSteps: steps.length, impactFiles: impact?.filesAffected?.length }, cwd); } catch {}

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ plan: steps, impact, taskId: args.taskId }, null, 2) }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}

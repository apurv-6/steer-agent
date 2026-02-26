import * as path from "node:path";
import { z } from "zod";
import { workflow } from "@steer-agent-tool/core";

const { readCurrentTask, buildPromptStep, createPlan } = workflow;

export const PlanParamsSchema = {
  repoPath: z.string().describe("Absolute path to the repository root"),
  taskId: z.string().describe("Task ID from steer.start"),
  answers: z.record(z.string()).optional().describe("Answers to follow-up questions"),
  planSteps: z.array(z.string()).describe("Proposed plan steps"),
};

export async function handlePlan(args: {
  repoPath: string;
  taskId: string;
  answers?: Record<string, string>;
  planSteps: string[];
}) {
  try {
    const steerDir = path.join(args.repoPath, ".steer");
    const state = readCurrentTask(steerDir);

    if (!state) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "No active task. Run steer.start first." }) }],
        isError: true,
      };
    }

    if (state.taskId !== args.taskId) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: `Task ID mismatch. Active: ${state.taskId}, provided: ${args.taskId}` }) }],
        isError: true,
      };
    }

    // Step 2: Build prompt from answers
    const answers = args.answers ?? {};
    const promptResult = buildPromptStep(state, answers, steerDir);

    // Step 3: Create plan with impact preview
    const planResult = createPlan(promptResult.state, args.planSteps, steerDir);

    const response = {
      step: "PLANNING",
      stepNumber: 3,
      status: "waiting_approval",
      taskId: state.taskId,
      assembledPrompt: promptResult.assembledPrompt,
      planSteps: args.planSteps,
      impactPreview: planResult.impactPreview,
      hookResults: planResult.hookResults.filter((h) => h.result !== "pass"),
      actions: ["approve", "edit", "reject"],
      message: planResult.impactPreview
        ? `Plan ready. Impact: ${planResult.impactPreview.riskLevel} risk, ${planResult.impactPreview.downstream.length} downstream deps, ${planResult.impactPreview.testsToRun.length} tests to run. Approve?`
        : "Plan ready for approval.",
      stateUpdated: true,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
      isError: true,
    };
  }
}

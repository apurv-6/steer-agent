import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  transitionStep,
  steerDirExists,
  logToolCall,
  emitAndSync,
  getCurrentBranch,
  createAttemptBranch,
} from "@steer-agent-tool/core";
import type { SteerConfig } from "@steer-agent-tool/core";

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

    try { logToolCall("steer.execute", { taskId: args.taskId, approved: args.approved, goal: state.goal }, cwd); } catch {}

    // Load config for git branch settings
    const configPath = join(cwd, ".steer", "config.json");
    let config: SteerConfig | undefined;
    if (existsSync(configPath)) {
      try { config = JSON.parse(readFileSync(configPath, "utf-8")); } catch {}
    }

    const gitBranchEnabled = config?.execution?.gitBranch === true;
    let executionBranch: string | undefined;

    if (gitBranchEnabled) {
      const originBranch = getCurrentBranch(cwd);
      const attempt = (state.attempt || 0) + 1;
      executionBranch = createAttemptBranch(cwd, args.taskId, attempt);

      state.originBranch = originBranch;
      state.executionBranch = executionBranch;
      state.attempt = attempt;
      state.maxAttempts = config?.execution?.maxAttempts ?? 3;
      state.attemptHistory = state.attemptHistory || [];
      state.attemptHistory.push({
        attempt,
        branch: executionBranch,
        startedAt: new Date().toISOString(),
        outcome: "pending",
      });
    }

    const updated = transitionStep(state, "execution");
    emitAndSync(cwd, { taskId: args.taskId, type: "execution_started", payload: {} }, updated);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "executing",
          taskId: args.taskId,
          goal: state.goal || "",
          ...(gitBranchEnabled && { branch: executionBranch, attempt: state.attempt, maxAttempts: state.maxAttempts }),
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

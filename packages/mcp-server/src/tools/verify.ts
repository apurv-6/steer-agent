import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { runVerification, loadHooks, transitionStep, steerDirExists, logToolCall } from "@steer-agent-tool/core";

export const VerifySchema = {
  taskId: z.string().describe("Task ID to verify"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handleVerify(args: { taskId: string; cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();

    if (!steerDirExists(cwd)) {
      return {
        content: [{ type: "text" as const, text: "SteerAgent is not initialized in this project.\n\nRun:\n  steer-agent init\n\nOr with npx:\n  npx @coinswitch/steer-agent init" }],
      };
    }

    const statePath = join(cwd, ".steer", "state", "current-task.json");
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    const hooks = loadHooks(cwd);

    try { logToolCall("steer.verify", { taskId: args.taskId }, cwd); } catch {}

    const result = runVerification(state, hooks, cwd);

    try { logToolCall("steer.verify.done", { taskId: args.taskId, passed: result?.passed, checks: result?.checks?.length }, cwd); } catch {}

    state.verificationOutcome = result;

    // Transition through reflection step (handled implicitly by Claude) then to verification
    let current = state;
    if (current.currentStep === "execution") {
      current = transitionStep(current, "reflection");
    }
    const updated = transitionStep(current, "verification");
    writeFileSync(statePath, JSON.stringify(updated, null, 2));

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ verification: result, taskId: args.taskId }, null, 2) }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}

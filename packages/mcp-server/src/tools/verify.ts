import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { runVerification, loadHooks, transitionStep } from "@steer-agent-tool/core";

export const VerifySchema = {
  taskId: z.string().describe("Task ID to verify"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handleVerify(args: { taskId: string; cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();

    const statePath = join(cwd, ".steer", "state", "current-task.json");
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    const hooks = loadHooks(cwd);

    const result = runVerification(state, hooks, cwd);

    state.verificationOutcome = result;
    const updated = transitionStep(state, "verification");
    writeFileSync(statePath, JSON.stringify(updated, null, 2));

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ verification: result, taskId: args.taskId }, null, 2) }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}

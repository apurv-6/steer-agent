import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";
import { generateCommitMessage } from "@steer-agent-tool/core";

export const CommitSchema = {
  taskId: z.string().describe("Task ID to generate commit message for"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handleCommit(args: { taskId: string; cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();
    const statePath = join(cwd, ".steer", "state", "current-task.json");
    const state = JSON.parse(readFileSync(statePath, "utf-8"));

    const message = generateCommitMessage(state);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          taskId: args.taskId,
          commitMessage: message,
          hint: "Use this message with: git commit -m '<message>'",
        }, null, 2),
      }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}

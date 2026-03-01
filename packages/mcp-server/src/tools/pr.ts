import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";
import { generatePRDescription } from "@steer-agent-tool/core";

export const PRSchema = {
  taskId: z.string().describe("Task ID to generate PR description for"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handlePR(args: { taskId: string; cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();
    const statePath = join(cwd, ".steer", "state", "current-task.json");
    const state = JSON.parse(readFileSync(statePath, "utf-8"));

    const description = generatePRDescription(state);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          taskId: args.taskId,
          prDescription: description,
          hint: "Use this description when creating a pull request.",
        }, null, 2),
      }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}

import { z } from "zod";
import { startTask, Mode } from "@steer-agent-tool/core";

export const StartSchema = {
  mode: z.enum(["chat", "code", "review", "plan", "design", "bugfix", "debug", "feature", "refactor"]).describe("The mode for the task"),
  taskId: z.string().describe("A unique identifier for the task (e.g. Jira ticket ID)"),
  initialMessage: z.string().optional().describe("The initial message or description of the task"),
  cwd: z.string().optional().describe("Root directory (defaults to current working directory)"),
};

export async function handleStart(args: { mode: string, taskId: string, initialMessage?: string, cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();
    const result = await startTask({
      cwd,
      mode: args.mode as Mode,
      taskId: args.taskId,
      initialMessage: args.initialMessage
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: msg }) }],
      isError: true,
    };
  }
}

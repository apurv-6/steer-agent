import { z } from "zod";
import { findSimilarTasks, steerDirExists } from "@steer-agent-tool/core";
import type { Mode } from "@steer-agent-tool/core";

export const SimilarSchema = {
  mode: z.enum(["chat", "code", "review", "plan", "design", "bugfix", "debug", "feature", "refactor"]).describe("Task mode"),
  files: z.array(z.string()).optional().describe("Files involved in the task"),
  goal: z.string().describe("Task goal/description"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handleSimilar(args: { mode: string; files?: string[]; goal: string; cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();

    if (!steerDirExists(cwd)) {
      return {
        content: [{ type: "text" as const, text: "SteerAgent is not initialized in this project.\n\nRun:\n  steer-agent init\n\nOr with npx:\n  npx @coinswitch/steer-agent init" }],
      };
    }

    const results = findSimilarTasks(
      args.mode as Mode,
      args.files || [],
      args.goal,
      cwd,
    );

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          matches: results,
          count: results.length,
          message: results.length > 0
            ? `Found ${results.length} similar task(s).`
            : "No similar tasks found.",
        }, null, 2),
      }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}

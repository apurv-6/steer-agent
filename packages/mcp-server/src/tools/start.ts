import * as path from "node:path";
import { z } from "zod";
import { workflow } from "@steer-agent-tool/core";

const { createTask, gatherContext } = workflow;

export const StartParamsSchema = {
  repoPath: z.string().describe("Absolute path to the repository root"),
  mode: z.enum(["dev", "debug", "bugfix", "design", "refactor"]).describe("Task mode"),
  context: z.string().optional().describe("Initial context or description of the task"),
  jiraTicket: z.string().optional().describe("Jira ticket ID (e.g. COIN-4521)"),
  files: z.array(z.string()).optional().describe("Specific files to work on"),
};

export async function handleStart(args: {
  repoPath: string;
  mode: string;
  context?: string;
  jiraTicket?: string;
  files?: string[];
}) {
  try {
    const steerDir = path.join(args.repoPath, ".steer");

    // Create task
    const state = createTask(args.mode, steerDir);

    // Add file refs if provided
    if (args.files && args.files.length > 0) {
      state.files = args.files;
      state.context.affectedFiles = args.files;
    }

    // Add jira ticket if provided
    if (args.jiraTicket) {
      state.context.jiraTicket = args.jiraTicket;
    }

    // Gather context
    const userInput = args.context ?? "";
    const result = gatherContext(state, userInput, steerDir);

    const response = {
      step: "CONTEXT",
      stepNumber: 1,
      status: "waiting_input",
      taskId: result.state.taskId,
      mode: result.state.mode,
      round: result.state.round,
      questions: result.questions,
      preloadedContext: {
        sourcesUsed: result.state.sourcesUsed,
        filesDetected: result.state.files,
        similarTasks: result.preloadedContext.similarTasks ?? [],
        hasCodemap: result.state.sourcesUsed.includes("codemap"),
        hasRules: !!result.preloadedContext.rulesContent,
      },
      hookResults: result.hookResults.filter((h) => h.result !== "pass"),
      actions: ["answer", "skip"],
      message: result.questions.length > 0
        ? `Task ${result.state.taskId} started. Please answer ${result.questions.length} question(s) to continue.`
        : `Task ${result.state.taskId} started. Context gathered. Proceed with steer.plan.`,
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

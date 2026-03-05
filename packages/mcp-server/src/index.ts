// === Hardening: stdout guard ===
// MCP uses stdout for JSON-RPC. Any console.log would corrupt the protocol.
const _origLog = console.log;
console.log = (...args: unknown[]) => console.error("[mcp-log]", ...args);

// === Hardening: global error handlers ===
process.on("uncaughtException", (err) => {
  console.error("[mcp-fatal] uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[mcp-fatal] unhandledRejection:", reason);
});

// === Hardening: signal handling ===
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.error(`[mcp] ${sig} received, shutting down`);
    process.exit(0);
  });
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { gate } from "./gate.js";
import { VERSION } from "@steer-agent-tool/core";
import { InitSchema, handleInit } from "./tools/init.js";
import { StartSchema, handleStart } from "./tools/start.js";
import { PlanSchema, handlePlan } from "./tools/plan.js";
import { ExecuteSchema, handleExecute } from "./tools/execute.js";
import { VerifySchema, handleVerify } from "./tools/verify.js";
import { StatusSchema, handleStatus } from "./tools/status.js";
import { MapSchema, handleMap } from "./tools/map.js";
import { ImpactSchema, handleImpact } from "./tools/impact.js";
import { ResumeSchema, handleResume } from "./tools/resume.js";
import { SimilarSchema, handleSimilar } from "./tools/similar.js";
import { LearnSchema, handleLearn } from "./tools/learn.js";

const server = new McpServer({
  name: "steer-agent-tool",
  version: VERSION,
});

const GateParamsSchema = {
  draftPrompt: z.string().describe("The draft prompt to evaluate"),
  mode: z.enum(["dev", "debug", "bugfix", "design", "refactor"]).describe("The task mode"),
  taskId: z.string().optional().describe("Session task ID (reuse across turns)"),
  turnId: z.number().optional().describe("Turn number within task (increments on re-evaluate)"),
  answers: z.record(z.string()).optional().describe("Follow-up answers keyed by question index or field name"),
  gitDiffStat: z.string().optional().describe("Raw output of `git diff --stat`"),
  gitDiffNameOnly: z.string().optional().describe("Raw output of `git diff --name-only`"),
  criticalPaths: z.array(z.string()).optional().describe("Critical file paths from criticalModules.json"),
};

async function handleGate(args: {
  draftPrompt: string;
  mode: string;
  taskId?: string;
  turnId?: number;
  answers?: Record<string, string>;
  gitDiffStat?: string;
  gitDiffNameOnly?: string;
  criticalPaths?: string[];
}) {
  try {
    const result = gate({
      draftPrompt: args.draftPrompt,
      mode: args.mode as "dev" | "debug" | "bugfix" | "design" | "refactor",
      taskId: args.taskId,
      turnId: args.turnId,
      answers: args.answers,
      gitDiffStat: args.gitDiffStat,
      gitDiffNameOnly: args.gitDiffNameOnly,
      criticalPaths: args.criticalPaths,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mcp] gate error:", msg);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
      isError: true,
    };
  }
}

// @ts-ignore - TS2589: Known TypeScript depth limit with Zod + MCP SDK generics
server.tool(
  "steer.gate",
  "Score a draft prompt, generate follow-up questions, patch the prompt, suggest a model tier, and estimate cost. Returns full GateResult with session tracking, git impact, and next action guidance.",
  GateParamsSchema,
  handleGate,
);

// @ts-ignore
server.tool(
  "steer.init",
  "Initialize SteerAgent in the current directory. Creates .steer/ folder and config.",
  InitSchema,
  handleInit,
);

// @ts-ignore
server.tool(
  "steer.start",
  "Start a new task with intelligent context gathering.",
  StartSchema,
  handleStart,
);

// @ts-ignore
server.tool(
  "steer.plan",
  "Create an execution plan with impact preview for a task.",
  PlanSchema,
  handlePlan,
);

// @ts-ignore
server.tool(
  "steer.execute",
  "Begin execution of an approved plan. Tracks scope enforcement.",
  ExecuteSchema,
  handleExecute,
);

// @ts-ignore
server.tool(
  "steer.verify",
  "Run verification checklist against acceptance criteria.",
  VerifySchema,
  handleVerify,
);

// @ts-ignore
server.tool(
  "steer.status",
  "Get current task progress: step, timing, files, sources.",
  StatusSchema,
  handleStatus,
);

// @ts-ignore
server.tool(
  "steer.map",
  "Rebuild or query the codebase map.",
  MapSchema,
  handleMap,
);

// @ts-ignore
server.tool(
  "steer.impact",
  "Preview change impact for a set of files (downstream deps, tests, risk).",
  ImpactSchema,
  handleImpact,
);

// @ts-ignore
server.tool(
  "steer.resume",
  "Resume an interrupted task from saved state.",
  ResumeSchema,
  handleResume,
);

// @ts-ignore
server.tool(
  "steer.similar",
  "Find similar past tasks from history.",
  SimilarSchema,
  handleSimilar,
);

// @ts-ignore
server.tool(
  "steer.learn",
  "Extract learnings from a completed task and update knowledge files.",
  LearnSchema,
  handleLearn,
);

export async function startServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stdin.resume();
}

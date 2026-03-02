import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
  transitionStep,
  assemblePrompt,
  buildPlan,
  routeModel,
  shouldSpawnSubAgents,
  runReflection,
  runVerification,
  extractLearnings,
  persistLearnings,
  updateKnowledgeFile,
  completeTask,
  generateCommitMessage,
  generatePRDescription,
  findSimilarTasks,
  loadModuleKnowledge,
  loadHooks,
  logToolCall,
  steerDirExists,
} from "@steer-agent-tool/core";
import type { TaskState, AssemblyContext } from "@steer-agent-tool/core";

export const RunSchema = {
  taskId: z.string().describe("Task ID to run the full workflow for"),
  goal: z.string().describe("What should be accomplished"),
  files: z.array(z.string()).optional().describe("Files expected to be modified"),
  acceptanceCriteria: z.array(z.string()).optional().describe("Acceptance criteria for verification"),
  approved: z.boolean().optional().describe("Set to true to execute an approved plan (phase 2)"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

interface RunArgs {
  taskId: string;
  goal: string;
  files?: string[];
  acceptanceCriteria?: string[];
  approved?: boolean;
  cwd?: string;
}

/**
 * Orchestrator tool that chains the full 9-step workflow.
 *
 * Phase 1 (plan): context → prompt → planning — returns plan for approval
 * Phase 2 (execute): execution → reflection → verification → learning → done
 */
export async function handleRun(args: RunArgs) {
  try {
    const cwd = args.cwd || process.cwd();

    if (!steerDirExists(cwd)) {
      return {
        content: [{ type: "text" as const, text: "SteerAgent is not initialized in this project.\n\nRun:\n  steer-agent init\n\nOr with npx:\n  npx @coinswitch/steer-agent init" }],
      };
    }

    try { logToolCall("steer.run", { taskId: args.taskId, approved: args.approved }, cwd); } catch {}

    const statePath = join(cwd, ".steer", "state", "current-task.json");
    if (!existsSync(statePath)) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "No active task. Run steer.start first." }) }],
        isError: true,
      };
    }

    let state: TaskState = JSON.parse(readFileSync(statePath, "utf-8"));

    // ────────────────────────────────────────
    // Phase 2: Execute approved plan
    // ────────────────────────────────────────
    if (args.approved === true) {
      return executePhase(state, statePath, cwd, args);
    }

    if (args.approved === false) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ status: "plan_rejected", message: "Plan not approved. Revise goal/files and call steer.run again." }),
        }],
      };
    }

    // ────────────────────────────────────────
    // Phase 1: Plan (context → prompt → planning)
    // ────────────────────────────────────────
    return planPhase(state, statePath, cwd, args);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mcp] run error:", msg);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
      isError: true,
    };
  }
}

// ──────────────────────────────────────────────────────────────────
// Phase 1: context → prompt → planning
// ──────────────────────────────────────────────────────────────────
function planPhase(state: TaskState, statePath: string, cwd: string, args: RunArgs) {
  const files = args.files || state.files || [];

  // Store goal + acceptance criteria + files
  state.goal = args.goal;
  if (args.acceptanceCriteria) {
    state.acceptanceCriteria = args.acceptanceCriteria;
  }
  if (args.files) {
    state.files = files;
  }

  // ── Step 1→2: context → prompt ──
  state = transitionStep(state, "prompt");

  // Assemble prompt
  const similarTasks = findSimilarTasks(state.mode, files, args.goal, cwd);
  const moduleNames = deriveModuleNames(files);
  const knowledge = loadModuleKnowledge(moduleNames, cwd);

  const codemapPath = join(cwd, ".steer", "codebase-map.json");
  const codemap = existsSync(codemapPath)
    ? JSON.parse(readFileSync(codemapPath, "utf-8"))
    : undefined;

  const assemblyCtx: AssemblyContext = {
    cwd,
    mode: state.mode,
    answers: {},
    knowledge,
    similarTasks,
    codemap,
    files,
  };
  const assembledPrompt = assemblePrompt(assemblyCtx);
  state.assembledPrompt = assembledPrompt;

  // ── Step 2→3: prompt → planning ──
  state = transitionStep(state, "planning");

  // Build plan
  const { steps, impact } = buildPlan({ task: state, codemap, goal: args.goal, files });
  state.planSteps = steps;
  state.impactPreview = impact;

  // Sub-agent decision
  const subAgentDecision = shouldSpawnSubAgents(state);
  state.subAgentDecision = subAgentDecision;

  // Model routing
  const routeResult = routeModel({
    mode: state.mode as any,
    score: state.score ?? 5,
    gitImpact: undefined,
  });
  state.modelTier = routeResult.tier;
  state.modelReason = routeResult.reason;

  // Persist state
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        phase: "plan",
        status: "awaiting_approval",
        taskId: args.taskId,
        stepsVisited: ["context", "prompt", "planning"],
        plan: steps,
        impact,
        modelTier: routeResult.tier,
        modelReason: routeResult.reason,
        subAgentDecision: subAgentDecision.shouldSplit
          ? { shouldSplit: true, reason: subAgentDecision.reason, agents: subAgentDecision.agents.length }
          : { shouldSplit: false, reason: subAgentDecision.reason },
        message: "Plan ready for review. Call steer.run with approved=true to execute.",
      }, null, 2),
    }],
  };
}

// ──────────────────────────────────────────────────────────────────
// Phase 2: execution → reflection → verification → learning → done
// ──────────────────────────────────────────────────────────────────
function executePhase(state: TaskState, statePath: string, cwd: string, args: RunArgs) {
  // ── Step 3→4: planning → execution ──
  state = transitionStep(state, "execution");
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  // ── Step 4→5: execution → reflection ──
  const hooks = loadHooks(cwd);
  const reflectionResult = runReflection(state, cwd, hooks);
  state.reflectionPassed = reflectionResult.passed;
  state.reflectionIssues = reflectionResult.issues;
  state = transitionStep(state, "reflection");
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  // ── Step 5→6: reflection → verification ──
  const verificationResult = runVerification(state, hooks, cwd);
  state.verificationOutcome = verificationResult;
  state = transitionStep(state, "verification");
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  // ── Step 6→7: verification → learning ──
  const learnings = extractLearnings(state);
  persistLearnings(learnings, cwd);

  const byModule = new Map<string, typeof learnings>();
  for (const l of learnings) {
    const arr = byModule.get(l.module) || [];
    arr.push(l);
    byModule.set(l.module, arr);
  }
  for (const [module, entries] of byModule) {
    updateKnowledgeFile(module, entries, cwd);
  }

  state.learningNotes = learnings;
  state = transitionStep(state, "learning");
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  // ── Step 7→8: learning → done ──
  completeTask(state, cwd);

  const commitMsg = generateCommitMessage(state);
  const prDescription = generatePRDescription(state);

  state = transitionStep(state, "done");
  state.resumable = false;
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        phase: "execute",
        status: "done",
        taskId: args.taskId,
        stepsVisited: ["execution", "reflection", "verification", "learning", "done"],
        reflection: {
          passed: reflectionResult.passed,
          issues: reflectionResult.issues,
        },
        verification: {
          passed: verificationResult.passed,
          summary: verificationResult.summary,
        },
        learnings: learnings.length,
        commitMessage: commitMsg,
        prDescription,
        message: "Task completed. All 9 workflow steps visited.",
      }, null, 2),
    }],
  };
}

/**
 * Derive module names from file paths for knowledge loading.
 */
function deriveModuleNames(files: string[]): string[] {
  const modules = new Set<string>();
  for (const f of files) {
    const parts = f.replace(/^\.?\//, "").split("/");
    if (parts.length > 1) {
      modules.add(parts[0]);
      // Also add second-level for monorepo (packages/core → core)
      if (parts[0] === "packages" && parts.length > 2) {
        modules.add(parts[1]);
      }
    }
  }
  return [...modules];
}

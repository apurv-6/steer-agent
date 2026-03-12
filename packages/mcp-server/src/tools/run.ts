import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { RouteResult, SteerConfig } from "@steer-agent-tool/core";
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
  loadIndex,
  searchChunks,
  emitAndSync,
  getCurrentBranch,
  createAttemptBranch,
  mergeAttemptBranch,
  deleteAttemptBranch,
  runBuildChecks,
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

  // RAG: load index and retrieve relevant chunks for the goal
  let ragChunks: ReturnType<typeof searchChunks> = [];
  try {
    const ragIndex = loadIndex(cwd);
    if (ragIndex) {
      ragChunks = searchChunks(args.goal, ragIndex, 8);
      state.ragSources = ragChunks.map((r) => ({
        file: r.chunk.file,
        score: r.score,
        chunk: r.chunk.content.substring(0, 200),
      }));
    }
  } catch {
    // RAG failure is non-fatal — continue with static context only
  }

  const assemblyCtx: AssemblyContext = {
    cwd,
    mode: state.mode,
    answers: {},
    knowledge,
    similarTasks,
    codemap,
    files,
    ragChunks,
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

  // Model routing — read default tier from config
  const configPath = join(cwd, ".steer", "config.json");
  let defaultTier: RouteResult["tier"] = "small";
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
      const cfgDefault: string = cfg?.modelPolicy?.default ?? cfg?.routing?.defaultModel ?? "small";
      if (cfgDefault === "mid" || cfgDefault === "high") defaultTier = cfgDefault;
    } catch {}
  }

  const routeResult = routeModel({
    mode: state.mode as any,
    score: state.score ?? 5,
    gitImpact: undefined,
    defaultTier,
  });
  state.modelTier = routeResult.tier;
  state.modelReason = routeResult.reason;

  // Persist state + emit event
  emitAndSync(cwd, {
    taskId: state.taskId,
    type: "plan_created",
    payload: { steps, impact },
  }, state);

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
  // Load config for git branch settings
  const configPath = join(cwd, ".steer", "config.json");
  let config: SteerConfig | undefined;
  if (existsSync(configPath)) {
    try { config = JSON.parse(readFileSync(configPath, "utf-8")); } catch {}
  }
  const gitBranchEnabled = config?.execution?.gitBranch === true;

  // ── Step 3→4: planning → execution ──
  if (gitBranchEnabled && !state.executionBranch) {
    const originBranch = getCurrentBranch(cwd);
    const attempt = (state.attempt || 0) + 1;
    const branch = createAttemptBranch(cwd, args.taskId, attempt);
    state.originBranch = originBranch;
    state.executionBranch = branch;
    state.attempt = attempt;
    state.maxAttempts = config?.execution?.maxAttempts ?? 3;
    state.attemptHistory = state.attemptHistory || [];
    state.attemptHistory.push({ attempt, branch, startedAt: new Date().toISOString(), outcome: "pending" });
  }

  state = transitionStep(state, "execution");
  emitAndSync(cwd, { taskId: state.taskId, type: "step_started", payload: { step: "execution", stepNumber: 4 } }, state);

  // ── Step 4→5: execution → reflection ──
  const hooks = loadHooks(cwd);
  const reflectionResult = runReflection(state, cwd, hooks);
  state.reflectionPassed = reflectionResult.passed;
  state.reflectionIssues = reflectionResult.issues;
  state = transitionStep(state, "reflection");
  emitAndSync(cwd, { taskId: state.taskId, type: "step_started", payload: { step: "reflection", stepNumber: 5 } }, state);

  // ── Step 5→6: reflection → verification ──
  const verificationResult = runVerification(state, hooks, cwd);

  // If git branch enabled, also run build checks
  let buildResult: ReturnType<typeof runBuildChecks> | undefined;
  if (gitBranchEnabled) {
    buildResult = runBuildChecks(cwd);
  }
  const overallPassed = verificationResult.passed && (buildResult ? buildResult.passed : true);

  state.verificationOutcome = verificationResult;
  state = transitionStep(state, "verification");

  // Handle git branch merge/retry
  if (gitBranchEnabled && state.executionBranch) {
    const originBranch = state.originBranch!;
    const executionBranch = state.executionBranch;
    const attempt = state.attempt || 1;
    const maxAttempts = state.maxAttempts || 3;
    const mergeStrategy = config?.execution?.mergeStrategy || "squash";

    // Update attempt history
    const currentAttempt = (state.attemptHistory || []).find((a: any) => a.attempt === attempt);
    if (currentAttempt) {
      currentAttempt.endedAt = new Date().toISOString();
      currentAttempt.outcome = overallPassed ? "passed" : "failed";
    }

    if (!overallPassed && attempt < maxAttempts) {
      // Retry: delete branch, create new attempt, loop back to execution
      deleteAttemptBranch(cwd, executionBranch, originBranch);
      const nextAttempt = attempt + 1;
      const newBranch = createAttemptBranch(cwd, args.taskId, nextAttempt);
      state.attempt = nextAttempt;
      state.executionBranch = newBranch;
      state.attemptHistory.push({ attempt: nextAttempt, branch: newBranch, startedAt: new Date().toISOString(), outcome: "pending" });

      emitAndSync(cwd, { taskId: state.taskId, type: "execution_attempt_failed", payload: { attempt, branch: executionBranch, reason: "Verification/build failed" } }, state);

      // Recurse back into executePhase for the retry
      return executePhase(state, statePath, cwd, args);
    }

    if (overallPassed) {
      mergeAttemptBranch(cwd, executionBranch, originBranch, mergeStrategy);
      state.executionBranch = undefined;
    } else {
      // Max attempts exhausted
      deleteAttemptBranch(cwd, executionBranch, originBranch);
      state.executionBranch = undefined;
      emitAndSync(cwd, { taskId: state.taskId, type: "execution_attempt_failed", payload: { attempt, branch: executionBranch, reason: `Max attempts (${maxAttempts}) reached` } }, state);
    }
  }

  emitAndSync(cwd, { taskId: state.taskId, type: "verification_completed", payload: { passed: overallPassed, checks: verificationResult.checks || [], summary: verificationResult.summary || "" } }, state);

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
  emitAndSync(cwd, { taskId: state.taskId, type: "learning_extracted", payload: { learnings, modules: [...byModule.keys()] } }, state);

  // ── Step 7→8: learning → done ──
  completeTask(state, cwd);

  const commitMsg = generateCommitMessage(state);
  const prDescription = generatePRDescription(state);

  state = transitionStep(state, "done");
  state.resumable = false;
  const durationMs = state.startedAt ? Date.now() - new Date(state.startedAt).getTime() : 0;
  emitAndSync(cwd, { taskId: state.taskId, type: "task_completed", payload: { fpcr: state.round <= 1, durationMs, round: state.round } }, state);

  // Build sub-agent instructions if split was recommended
  const subAgentInstructions = state.subAgentDecision?.shouldSplit
    ? {
        recommended: true,
        reason: state.subAgentDecision.reason,
        agents: (state.subAgentDecision.agents as Array<{ id: string; files: string[]; description: string }>).map((a) => ({
          id: a.id,
          files: a.files,
          description: a.description,
          instruction: `Execute only these files: ${a.files.join(", ")}. Do not touch files assigned to other agents.`,
        })),
        note: "Spawn each agent as an independent Task with its own file scope. Merge results when all complete.",
      }
    : { recommended: false };

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
        subAgentInstructions,
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

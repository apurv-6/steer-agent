/**
 * CLI bridge for SteerAgent workflow steps.
 *
 * Mirrors the MCP server tools so skills can call workflow steps
 * via `steer-agent workflow <cmd>` when MCP is not available.
 *
 * Each subcommand calls the same core functions the MCP handlers use
 * and outputs JSON to stdout.
 */

import { readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import {
  startTask,
  steerDirExists,
  transitionStep,
  buildPlan,
  runVerification,
  loadHooks,
  extractLearnings,
  persistLearnings,
  updateKnowledgeFile,
  assemblePrompt,
  routeModel,
  shouldSpawnSubAgents,
  runReflection,
  completeTask,
  generateCommitMessage,
  generatePRDescription,
  findSimilarTasks,
  loadModuleKnowledge,
  loadIndex,
  searchChunks,
  emitAndSync,
} from "@steer-agent-tool/core";
import type { TaskState, AssemblyContext, RouteResult, EventInput } from "@steer-agent-tool/core";

// ── Arg parser ─────────────────────────────────────────────────────

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
          flags[arg.slice(2)] = next;
          i++;
        } else {
          flags[arg.slice(2)] = true;
        }
      }
    }
  }
  return flags;
}

function output(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function fail(msg: string): never {
  output({ error: msg });
  process.exit(1);
}

function getCwd(flags: Record<string, string | boolean>): string {
  return (typeof flags.cwd === "string" ? flags.cwd : null) || process.cwd();
}

function ensureSteer(cwd: string): void {
  if (!steerDirExists(cwd)) {
    fail("SteerAgent is not initialized in this project. Run: steer-agent init");
  }
}

function loadState(cwd: string): { state: TaskState; statePath: string } {
  const statePath = join(cwd, ".steer", "state", "current-task.json");
  if (!existsSync(statePath)) {
    fail("No active task. Run steer-agent workflow start first.");
  }
  const state = JSON.parse(readFileSync(statePath, "utf-8")) as TaskState;
  return { state, statePath };
}

function saveState(cwd: string, state: TaskState, event: EventInput): void {
  mkdirSync(join(cwd, ".steer", "state"), { recursive: true });
  emitAndSync(cwd, event, state);
}

// ── Subcommands ────────────────────────────────────────────────────

async function cmdStart(flags: Record<string, string | boolean>): Promise<void> {
  const cwd = getCwd(flags);
  ensureSteer(cwd);

  const mode = (typeof flags.mode === "string" ? flags.mode : "feature") as any;
  const taskId = typeof flags["task-id"] === "string"
    ? flags["task-id"]
    : `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const message = typeof flags.message === "string" ? flags.message : "";

  const result = await startTask({ cwd, mode, taskId, initialMessage: message });

  output({
    status: "started",
    taskId: result.state.taskId,
    mode: result.state.mode,
    currentStep: result.state.currentStep,
    message: result.message,
    context: {
      rules: result.context.rules ? "loaded" : "none",
      codemapSummary: result.context.codemapSummary,
      referencedFiles: result.context.referencedFiles,
      similarTasks: result.context.similarTasks?.length || 0,
      knowledge: result.context.knowledge?.length || 0,
    },
    initialQuestions: result.initialQuestions,
  });
}

async function cmdPlan(flags: Record<string, string | boolean>): Promise<void> {
  const cwd = getCwd(flags);
  ensureSteer(cwd);

  let { state, statePath } = loadState(cwd);

  const goal = typeof flags.goal === "string" ? flags.goal : state.goal || "";
  const files = typeof flags.files === "string" ? flags.files.split(",") : state.files || [];
  const criteria = typeof flags.criteria === "string" ? flags.criteria.split(",") : undefined;

  const codemapPath = join(cwd, ".steer", "codebase-map.json");
  const codemap = existsSync(codemapPath) ? JSON.parse(readFileSync(codemapPath, "utf-8")) : undefined;

  state.goal = goal;
  if (criteria?.length) state.acceptanceCriteria = criteria;
  if (files.length) state.files = files;

  const { steps, impact } = buildPlan({ task: state, codemap, goal, files });
  state.planSteps = steps;
  state.impactPreview = impact;

  state = transitionStep(state, "planning");
  saveState(cwd, state, { taskId: state.taskId, type: "plan_created", payload: { steps, impact } });

  output({
    status: "planned",
    taskId: state.taskId,
    currentStep: state.currentStep,
    plan: steps,
    impact,
    message: "Plan ready for review. Run steer-agent workflow execute --approved to proceed.",
  });
}

async function cmdExecute(flags: Record<string, string | boolean>): Promise<void> {
  const cwd = getCwd(flags);
  ensureSteer(cwd);

  let { state, statePath } = loadState(cwd);

  if (flags.approved === false || flags.approved === "false") {
    output({ status: "plan_rejected", message: "Plan was not approved. Revise and re-plan." });
    return;
  }

  state = transitionStep(state, "execution");
  saveState(cwd, state, { taskId: state.taskId, type: "execution_started", payload: {} });

  output({
    status: "executing",
    taskId: state.taskId,
    currentStep: state.currentStep,
    goal: state.goal || "",
    implementationSteps: (state.planSteps || []).map((s: any) => ({
      id: s.id,
      file: s.files?.[0],
      action: s.action,
      description: s.description,
    })),
    acceptanceCriteria: state.acceptanceCriteria || [],
    message: "Implement the plan steps. When done, run steer-agent workflow verify.",
  });
}

async function cmdVerify(flags: Record<string, string | boolean>): Promise<void> {
  const cwd = getCwd(flags);
  ensureSteer(cwd);

  let { state, statePath } = loadState(cwd);
  const hooks = loadHooks(cwd);

  const result = runVerification(state, hooks, cwd);
  state.verificationOutcome = result;
  state = transitionStep(state, "verification");
  saveState(cwd, state, { taskId: state.taskId, type: "verification_completed", payload: { passed: result.passed, checks: result.checks || [], summary: result.summary || "" } });

  output({
    status: "verified",
    taskId: state.taskId,
    currentStep: state.currentStep,
    verification: result,
  });
}

async function cmdLearn(flags: Record<string, string | boolean>): Promise<void> {
  const cwd = getCwd(flags);
  ensureSteer(cwd);

  let { state, statePath } = loadState(cwd);

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
  saveState(cwd, state, { taskId: state.taskId, type: "learning_extracted", payload: { learnings, modules: [...byModule.keys()] } });

  output({
    status: "learned",
    taskId: state.taskId,
    currentStep: state.currentStep,
    learnings: learnings.length,
    modules: [...byModule.keys()],
    entries: learnings.map((l: any) => ({ category: l.category, summary: l.summary, module: l.module })),
  });
}

async function cmdStatus(flags: Record<string, string | boolean>): Promise<void> {
  const cwd = getCwd(flags);
  ensureSteer(cwd);

  const statePath = join(cwd, ".steer", "state", "current-task.json");
  if (!existsSync(statePath)) {
    output({ status: "idle", message: "No active task." });
    return;
  }

  const state = JSON.parse(readFileSync(statePath, "utf-8"));
  const stepOrder = ["idle", "context", "prompt", "planning", "execution", "reflection", "verification", "learning", "done"];
  const currentIdx = stepOrder.indexOf(state.currentStep);
  const progress = `${currentIdx + 1}/${stepOrder.length}`;
  const elapsed = state.startedAt
    ? `${Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000)}s`
    : "unknown";

  output({
    taskId: state.taskId,
    mode: state.mode,
    currentStep: state.currentStep,
    progress,
    round: state.round,
    elapsed,
    files: state.files,
    goal: state.goal,
    modelTier: state.modelTier,
    sourcesUsed: state.sourcesUsed,
    planSteps: state.planSteps?.length || 0,
    hookResults: state.hookResults?.length || 0,
  });
}

async function cmdRun(flags: Record<string, string | boolean>): Promise<void> {
  const cwd = getCwd(flags);
  ensureSteer(cwd);

  let { state, statePath } = loadState(cwd);

  // Phase 2: execute approved plan
  if (flags.approved === true || flags.approved === "true") {
    state = transitionStep(state, "execution");
    saveState(cwd, state, { taskId: state.taskId, type: "step_started", payload: { step: "execution", stepNumber: 4 } });

    const hooks = loadHooks(cwd);
    const reflectionResult = runReflection(state, cwd, hooks);
    state.reflectionPassed = reflectionResult.passed;
    state.reflectionIssues = reflectionResult.issues;
    state = transitionStep(state, "reflection");
    saveState(cwd, state, { taskId: state.taskId, type: "step_started", payload: { step: "reflection", stepNumber: 5 } });

    const verificationResult = runVerification(state, hooks, cwd);
    state.verificationOutcome = verificationResult;
    state = transitionStep(state, "verification");
    saveState(cwd, state, { taskId: state.taskId, type: "verification_completed", payload: { passed: verificationResult.passed, checks: verificationResult.checks || [], summary: verificationResult.summary || "" } });

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
    saveState(cwd, state, { taskId: state.taskId, type: "learning_extracted", payload: { learnings, modules: [...byModule.keys()] } });

    completeTask(state, cwd);
    const commitMsg = generateCommitMessage(state);
    const prDescription = generatePRDescription(state);

    state = transitionStep(state, "done");
    state.resumable = false;
    const durationMs = state.startedAt ? Date.now() - new Date(state.startedAt).getTime() : 0;
    saveState(cwd, state, { taskId: state.taskId, type: "task_completed", payload: { fpcr: state.round <= 1, durationMs, round: state.round } });

    output({
      phase: "execute",
      status: "done",
      taskId: state.taskId,
      stepsVisited: ["execution", "reflection", "verification", "learning", "done"],
      reflection: { passed: reflectionResult.passed, issues: reflectionResult.issues },
      verification: { passed: verificationResult.passed, summary: verificationResult.summary },
      learnings: learnings.length,
      commitMessage: commitMsg,
      prDescription,
      message: "Task completed. All workflow steps visited.",
    });
    return;
  }

  // Phase 1: plan
  const goal = typeof flags.goal === "string" ? flags.goal : state.goal || "";
  const files = typeof flags.files === "string" ? flags.files.split(",") : state.files || [];

  state.goal = goal;
  if (files.length) state.files = files;

  state = transitionStep(state, "prompt");

  const similarTasks = findSimilarTasks(state.mode, files, goal, cwd);
  const moduleNames = deriveModuleNames(files);
  const knowledge = loadModuleKnowledge(moduleNames, cwd);

  const codemapPath = join(cwd, ".steer", "codebase-map.json");
  const codemap = existsSync(codemapPath) ? JSON.parse(readFileSync(codemapPath, "utf-8")) : undefined;

  let ragChunks: ReturnType<typeof searchChunks> = [];
  try {
    const ragIndex = loadIndex(cwd);
    if (ragIndex) {
      ragChunks = searchChunks(goal, ragIndex, 8);
    }
  } catch {}

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

  state = transitionStep(state, "planning");

  const { steps, impact } = buildPlan({ task: state, codemap, goal, files });
  state.planSteps = steps;
  state.impactPreview = impact;

  const subAgentDecision = shouldSpawnSubAgents(state);
  state.subAgentDecision = subAgentDecision;

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

  saveState(cwd, state, { taskId: state.taskId, type: "plan_created", payload: { steps, impact } });

  output({
    phase: "plan",
    status: "awaiting_approval",
    taskId: state.taskId,
    stepsVisited: ["context", "prompt", "planning"],
    plan: steps,
    impact,
    modelTier: routeResult.tier,
    modelReason: routeResult.reason,
    message: "Plan ready for review. Run steer-agent workflow run --approved to execute.",
  });
}

function deriveModuleNames(files: string[]): string[] {
  const modules = new Set<string>();
  for (const f of files) {
    const parts = f.replace(/^\.?\//, "").split("/");
    if (parts.length > 1) {
      modules.add(parts[0]);
      if (parts[0] === "packages" && parts.length > 2) {
        modules.add(parts[1]);
      }
    }
  }
  return [...modules];
}

// ── Main dispatcher ────────────────────────────────────────────────

export async function runWorkflow(argv: string[]): Promise<void> {
  const [subcommand, ...rest] = argv;
  const flags = parseFlags(rest);

  switch (subcommand) {
    case "start":
      await cmdStart(flags);
      break;
    case "plan":
      await cmdPlan(flags);
      break;
    case "execute":
      await cmdExecute(flags);
      break;
    case "verify":
      await cmdVerify(flags);
      break;
    case "learn":
      await cmdLearn(flags);
      break;
    case "status":
      await cmdStatus(flags);
      break;
    case "run":
      await cmdRun(flags);
      break;
    default:
      console.error(`Unknown workflow command: ${subcommand || "(none)"}`);
      console.error(`
Usage: steer-agent workflow <command> [options]

Commands:
  start     Start a new task          --mode=<mode> --message="<goal>" [--task-id=<id>]
  plan      Create execution plan     --goal="<goal>" [--files=f1,f2] [--criteria=c1,c2]
  execute   Execute approved plan     [--approved]
  verify    Run verification checks
  learn     Extract learnings
  status    Show current task status
  run       Full orchestrator         --goal="<goal>" [--approved] [--files=f1,f2]`);
      process.exit(1);
  }
}

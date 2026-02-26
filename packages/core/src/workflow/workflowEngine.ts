import type {
  CurrentTaskState,
  WorkflowStep,
  StepInfo,
  TaskContext,
  TaskHistoryEntry,
  ImpactPreview,
  SimilarTask,
  SteerConfig,
  TemplateSpec,
  CodebaseMap,
  HookDefinition,
  HookResult,
} from "./types.js";
import { VALID_TRANSITIONS, stepNumber, STEP_ORDER } from "./types.js";
import { loadConfig, loadRules } from "../fs/configLoader.js";
import { readCurrentTask, writeCurrentTask, appendHistory, findSimilarTasks } from "../fs/taskState.js";
import { loadTemplate, generateTemplateQuestions, renderPrompt } from "./templateLoader.js";
import { loadHooks, runHooks, HookBlockError } from "./hookEngine.js";
import { loadCodebaseMap } from "./codebaseMap.js";
import { calculateImpact } from "./impactCalculator.js";
import { extractFileRefs } from "../extractFileRefs.js";
import * as path from "node:path";

// ── Helpers ────────────────────────────────────────────────────────

function generateTaskId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `task_${ts}_${rand}`;
}

function now(): string {
  return new Date().toISOString();
}

function durationStr(startIso: string): string {
  const ms = Date.now() - new Date(startIso).getTime();
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}:${String(remSecs).padStart(2, "0")}`;
}

function validateTransition(from: WorkflowStep, to: WorkflowStep): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new Error(`Invalid workflow transition: ${from} → ${to}`);
  }
}

function initSteps(): Record<string, StepInfo> {
  const steps: Record<string, StepInfo> = {};
  for (const step of STEP_ORDER) {
    steps[step] = { status: "pending" };
  }
  return steps;
}

function transitionStep(state: CurrentTaskState, toStep: WorkflowStep): CurrentTaskState {
  validateTransition(state.currentStep, toStep);

  // Complete current step
  const currentStepInfo = state.steps[state.currentStep];
  if (currentStepInfo && currentStepInfo.status === "active") {
    currentStepInfo.status = "done";
    currentStepInfo.completedAt = now();
    if (currentStepInfo.startedAt) {
      currentStepInfo.duration = durationStr(currentStepInfo.startedAt);
    }
  }

  // Start new step
  if (state.steps[toStep]) {
    state.steps[toStep] = {
      status: "active",
      startedAt: now(),
    };
  }

  state.currentStep = toStep;
  state.stepNumber = stepNumber(toStep);
  state.resumable = true;

  return state;
}

// ── Workflow Operations ────────────────────────────────────────────

/**
 * Create a new task and transition to IDLE.
 */
export function createTask(mode: string, steerDir: string): CurrentTaskState {
  const state: CurrentTaskState = {
    taskId: generateTaskId(),
    mode,
    round: 1,
    startedAt: now(),
    currentStep: "IDLE",
    stepNumber: 0,
    steps: initSteps(),
    sourcesUsed: [],
    files: [],
    overrideUsed: false,
    resumable: true,
    context: {},
  };

  writeCurrentTask(steerDir, state);
  return state;
}

/**
 * Step 1: Gather context.
 * IDLE → CONTEXT
 * Loads config, rules, template, codebase map. Generates intelligent questions.
 */
export function gatherContext(
  state: CurrentTaskState,
  userInput: string,
  steerDir: string,
): {
  state: CurrentTaskState;
  questions: Array<{ id: string; question: string; type: "text" | "mcq"; required: boolean; context?: string }>;
  preloadedContext: TaskContext;
  hookResults: HookResult[];
  template: TemplateSpec | null;
} {
  // Transition
  state = transitionStep(state, "CONTEXT");

  // Load all sources
  const config = loadConfig(steerDir);
  const rules = loadRules(steerDir);
  const templatesDir = path.join(steerDir, "templates");
  const template = loadTemplate(state.mode, templatesDir);
  const codebaseMap = loadCodebaseMap(steerDir);
  const hooksPath = path.join(steerDir, "hooks.yaml");
  const hooks = loadHooks(hooksPath);

  // Track sources
  state.sourcesUsed = ["config", "rules", "template", "files"];
  if (codebaseMap) state.sourcesUsed.push("codemap");

  // Extract file refs from user input
  const fileRefs = extractFileRefs(userInput);
  if (fileRefs.length > 0) {
    state.files = fileRefs;
    state.context.affectedFiles = fileRefs;
  }

  // Build context from codebase map
  let codemapExcerpt: string | undefined;
  if (codebaseMap && fileRefs.length > 0) {
    const excerpts: string[] = [];
    for (const ref of fileRefs) {
      const dep = Object.entries(codebaseMap.dependencies).find(([k]) =>
        k.includes(ref) || ref.includes(k),
      );
      if (dep) {
        const [filePath, info] = dep;
        excerpts.push(`${filePath}: imports=[${info.imports.join(", ")}], calledBy=[${info.calledBy.join(", ")}]`);
      }
    }
    if (excerpts.length > 0) {
      codemapExcerpt = excerpts.join("\n");
    }
  }

  // Find similar past tasks
  const goalWords = userInput.split(/\s+/).filter((w) => w.length > 3);
  const similarEntries = findSimilarTasks(steerDir, state.mode, fileRefs, goalWords);
  const similarTasks: SimilarTask[] = similarEntries.map((e) => ({
    taskId: e.taskId,
    mode: e.mode,
    rounds: e.rounds,
    totalTime: e.totalTime,
    modelTier: e.modelUsed,
  }));

  // Build pre-loaded context
  const preloadedContext: TaskContext = {
    goal: userInput,
    rulesContent: rules ?? undefined,
    codemapExcerpt,
    affectedFiles: fileRefs.length > 0 ? fileRefs : undefined,
    similarTasks: similarTasks.length > 0 ? similarTasks : undefined,
    answers: {},
  };
  state.context = preloadedContext;

  // Generate intelligent questions from template
  let questions: Array<{ id: string; question: string; type: "text" | "mcq"; required: boolean; context?: string }> = [];
  if (template) {
    const provided: Record<string, string> = {};
    if (userInput) provided.goal = userInput;
    if (fileRefs.length > 0) provided.affected_files = fileRefs.join(", ");

    const baseQuestions = generateTemplateQuestions(template, provided);

    // Enrich questions with codebase context
    questions = baseQuestions.map((q) => {
      let context: string | undefined;
      if (codemapExcerpt && (q.id === "affected_files" || q.id === "scope")) {
        context = `Codebase map shows: ${codemapExcerpt}`;
      }
      return { ...q, context };
    });
  }

  // Run pre-context hooks (already past, but included for completeness)
  let hookResults: HookResult[] = [];
  try {
    hookResults = runHooks("post-context", hooks, {
      templateLoaded: !!template,
      jiraTicket: state.context.jiraTicket,
      files: state.files,
      criticalModules: config.defaults?.criticalModules,
    });
  } catch (err) {
    if (err instanceof HookBlockError) {
      hookResults = [err.hookResult];
    }
  }

  writeCurrentTask(steerDir, state);

  return { state, questions, preloadedContext, hookResults, template };
}

/**
 * Step 2: Build the assembled prompt.
 * CONTEXT → PROMPT
 */
export function buildPromptStep(
  state: CurrentTaskState,
  answers: Record<string, string>,
  steerDir: string,
): {
  state: CurrentTaskState;
  assembledPrompt: string;
} {
  state = transitionStep(state, "PROMPT");

  // Merge answers into context
  state.context.answers = { ...state.context.answers, ...answers };

  // Map specific answers to context fields
  if (answers.goal) state.context.goal = answers.goal;
  if (answers.acceptance_criteria) state.context.acceptanceCriteria = answers.acceptance_criteria;
  if (answers.repro_steps) state.context.reproSteps = answers.repro_steps;
  if (answers.affected_files) {
    state.context.affectedFiles = answers.affected_files.split(",").map((f) => f.trim());
    state.files = state.context.affectedFiles;
  }
  if (answers.constraints) state.context.constraints = answers.constraints;
  if (answers.user_story) state.context.userStory = answers.user_story;
  if (answers.deliverable) state.context.deliverable = answers.deliverable;

  // Load template and render
  const templatesDir = path.join(steerDir, "templates");
  const template = loadTemplate(state.mode, templatesDir);

  let assembledPrompt: string;
  if (template) {
    assembledPrompt = renderPrompt(template, {
      goal: state.context.goal,
      repro_steps: state.context.reproSteps,
      acceptance_criteria: state.context.acceptanceCriteria,
      affected_files: state.files.join(", "),
      scope: state.context.constraints ?? `Files: ${state.files.join(", ")}`,
      rules_from_RULES_md: state.context.rulesContent ?? "",
      codebase_map_excerpt: state.context.codemapExcerpt ?? "",
      user_story: state.context.userStory,
      constraints: state.context.constraints,
      deliverable: state.context.deliverable,
      jira_context: state.context.jiraContext ? JSON.stringify(state.context.jiraContext) : "",
      sentry_context: state.context.sentryContext ? JSON.stringify(state.context.sentryContext) : "",
      git_context: state.context.gitContext ? JSON.stringify(state.context.gitContext) : "",
      dependency_chain: state.context.codemapExcerpt ?? "",
      related_tests_from_codemap: "", // Filled during planning
    });
  } else {
    // Fallback: basic 5-section prompt assembly
    assembledPrompt = [
      `## GOAL`,
      state.context.goal ?? "",
      ``,
      `## CONTEXT`,
      state.context.reproSteps ?? "",
      state.context.codemapExcerpt ? `Codebase: ${state.context.codemapExcerpt}` : "",
      ``,
      `## LIMITS`,
      state.context.constraints ?? `Scope: ${state.files.join(", ")}`,
      state.context.rulesContent ? `Rules: ${state.context.rulesContent.slice(0, 500)}` : "",
      ``,
      `## OUTPUT FORMAT`,
      `Patch diff + file paths`,
      ``,
      `## REVIEW`,
      state.context.acceptanceCriteria ?? "Verify the fix works as expected",
    ]
      .filter((l) => l.length > 0)
      .join("\n");
  }

  state.assembledPrompt = assembledPrompt;
  writeCurrentTask(steerDir, state);

  return { state, assembledPrompt };
}

/**
 * Step 3: Create plan with impact preview.
 * PROMPT → PLANNING
 */
export function createPlan(
  state: CurrentTaskState,
  planSteps: string[],
  steerDir: string,
): {
  state: CurrentTaskState;
  impactPreview: ImpactPreview | null;
  hookResults: HookResult[];
} {
  state = transitionStep(state, "PLANNING");

  // Load codebase map for impact analysis
  const codebaseMap = loadCodebaseMap(steerDir);
  const config = loadConfig(steerDir);

  let impactPreview: ImpactPreview | null = null;
  if (codebaseMap && state.files.length > 0) {
    impactPreview = calculateImpact(state.files, codebaseMap, config);
    state.impactPreview = impactPreview;
  }

  state.approvedPlan = planSteps;
  state.completedPlanSteps = [];

  // Run pre-plan hooks
  const hooks = loadHooks(path.join(steerDir, "hooks.yaml"));
  let hookResults: HookResult[] = [];
  try {
    hookResults = runHooks("pre-plan", hooks, {
      files: state.files,
      criticalModules: config.defaults?.criticalModules,
      cwd: path.dirname(steerDir),
    });
  } catch (err) {
    if (err instanceof HookBlockError) {
      hookResults = [err.hookResult];
    }
  }

  writeCurrentTask(steerDir, state);
  return { state, impactPreview, hookResults };
}

/**
 * Step 4: Approve plan and move to execution.
 * PLANNING → EXECUTION
 */
export function approvePlan(state: CurrentTaskState, steerDir: string): CurrentTaskState {
  state = transitionStep(state, "EXECUTION");
  writeCurrentTask(steerDir, state);
  return state;
}

/**
 * Step 5a: Complete execution and move to verification.
 * EXECUTION → VERIFICATION
 */
export function completeExecution(state: CurrentTaskState, steerDir: string): CurrentTaskState {
  state = transitionStep(state, "VERIFICATION");

  // Run post-execute hooks
  const hooks = loadHooks(path.join(steerDir, "hooks.yaml"));
  try {
    runHooks("post-execute", hooks, {
      files: state.files,
      cwd: path.dirname(steerDir),
    });
  } catch {
    // Hook failures logged but don't block transition
  }

  writeCurrentTask(steerDir, state);
  return state;
}

/**
 * Step 5b: Verify task completion.
 * VERIFICATION → DONE or VERIFICATION → CONTEXT (new round)
 */
export function verify(
  state: CurrentTaskState,
  passed: boolean,
  steerDir: string,
  notes?: string,
): {
  state: CurrentTaskState;
  taskComplete: boolean;
  historyEntry?: TaskHistoryEntry;
} {
  if (passed) {
    state = transitionStep(state, "DONE");

    // Build history entry
    const historyEntry: TaskHistoryEntry = {
      taskId: state.taskId,
      mode: state.mode,
      rounds: state.round,
      totalTime: durationStr(state.startedAt),
      timePerStep: {},
      modelUsed: state.modelTier,
      modelReason: state.modelReason,
      sourcesUsed: state.sourcesUsed,
      filesChanged: state.files,
      score: state.score,
      completedFirstRound: state.round === 1,
      overrideUsed: state.overrideUsed,
      impactRisk: state.impactPreview?.riskLevel,
      resumed: !!state.suspendedStep,
      completedAt: now(),
    };

    // Populate time per step
    for (const [step, info] of Object.entries(state.steps)) {
      if (info.duration) {
        historyEntry.timePerStep[step] = info.duration;
      }
    }

    appendHistory(steerDir, historyEntry);
    writeCurrentTask(steerDir, state);

    return { state, taskComplete: true, historyEntry };
  } else {
    // New round — go back to CONTEXT
    state.round += 1;
    state.steps = initSteps();
    state = transitionStep(state, "CONTEXT");
    state.steps["CONTEXT"] = { status: "active", startedAt: now() };

    writeCurrentTask(steerDir, state);
    return { state, taskComplete: false };
  }
}

/**
 * Suspend a task (crash recovery).
 */
export function suspendTask(state: CurrentTaskState, steerDir: string): CurrentTaskState {
  state.suspendedStep = state.currentStep;
  state.currentStep = "SUSPENDED";
  state.resumable = true;
  writeCurrentTask(steerDir, state);
  return state;
}

/**
 * Resume a suspended or interrupted task.
 */
export function resumeTask(steerDir: string): {
  state: CurrentTaskState | null;
  resumeStep: WorkflowStep | null;
  message: string;
} {
  const state = readCurrentTask(steerDir);
  if (!state) {
    return { state: null, resumeStep: null, message: "No task to resume." };
  }

  if (state.currentStep === "DONE") {
    return { state, resumeStep: null, message: `Task ${state.taskId} is already complete.` };
  }

  const resumeStep = state.suspendedStep ?? state.currentStep;
  state.currentStep = resumeStep;
  state.suspendedStep = undefined;
  writeCurrentTask(steerDir, state);

  return {
    state,
    resumeStep,
    message: `Resuming task ${state.taskId} (${state.mode}) at step: ${resumeStep}`,
  };
}

/**
 * Get formatted status string for CLI users.
 */
export function getStatus(steerDir: string): string {
  const state = readCurrentTask(steerDir);
  if (!state) {
    return "No active task.";
  }

  const lines: string[] = [
    `Task: ${state.taskId} (${state.mode})`,
    `Round: ${state.round} | Time: ${durationStr(state.startedAt)}`,
    ``,
  ];

  const stepIcons: Record<string, string> = {
    done: "✅",
    active: "🔄",
    pending: "⏳",
    failed: "❌",
    skipped: "⏭️",
  };

  for (let i = 0; i < STEP_ORDER.length; i++) {
    const step = STEP_ORDER[i]!;
    const info = state.steps[step] ?? { status: "pending" };
    const icon = stepIcons[info.status] ?? "⏳";
    const dur = info.duration ? `  ${info.duration}` : "";
    lines.push(`  ${i + 1}. ${step.padEnd(15)} ${icon}${dur}`);
  }

  lines.push(``);
  if (state.modelTier) lines.push(`Model: ${state.modelTier} (${state.modelReason ?? "default"})`);
  if (state.sourcesUsed.length > 0) lines.push(`Sources: ${state.sourcesUsed.join(", ")}`);
  if (state.impactPreview) lines.push(`Impact: ${state.impactPreview.riskLevel}`);

  return lines.join("\n");
}

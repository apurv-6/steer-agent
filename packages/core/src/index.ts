export const VERSION = "3.0.0";

// Types
export type {
  Mode,
  GateMode,
  ScoreResult,
  FollowUp,
  RouteInput,
  RouteResult,
  GitImpact,
  GateStatus,
  GateResult,
  GateInput,
  TelemetryEvent,
  CodebaseMap,
  ModuleInfo,
  FileInfo,
  DependencyGraph,
  ChangeCoupling,
  // V3.0 types
  HookDefinition,
  HooksConfig,
  HookResult,
  LearningEntry,
  LearningCategory,
  KnowledgeEntry,
  PlanStep,
  ImpactPreview,
  VerificationResult,
  VerificationCheck,
  SimilarTask,
  SteerConfig,
} from "./types.js";
export { MODE_MAP } from "./types.js";

// Core functions
export { scorePrompt } from "./scorePrompt.js";
export { extractFileRefs } from "./extractFileRefs.js";
export { generateFollowUps } from "./generateFollowUps.js";
export { buildPrompt } from "./buildPrompt.js";
export type { BuildPromptAnswers } from "./buildPrompt.js";
export { routeModel, estimateCost } from "./routeModel.js";
export { estimateTokens } from "./estimateTokens.js";
export { parseGitImpact } from "./gitImpact.js";

// Canonical gate (single source of truth)
export { gate } from "./gate.js";

// Telemetry
export * as telemetry from "./telemetry.js";

// Codebase map
export { buildCodebaseMap } from "./codemap-static.js";

// State machine
export { createNewTask, transitionStep, INITIAL_STATE } from "./state.js";
export type { TaskState, StepName, StepStatus } from "./state.js";

// Init & Start
export { initSteer } from "./init.js";
export { startTask } from "./start.js";
export type { StartOptions } from "./start.js";

// V3.0 Core Modules
export { loadHooks, runHooks, parseHooksYaml } from "./hookRunner.js";
export { loadModuleKnowledge, loadGlobalKnowledge, loadRules } from "./knowledgeLoader.js";
export { assemblePrompt, loadTemplate, parseFrontmatter } from "./promptAssembler.js";
export type { AssemblyContext } from "./promptAssembler.js";
export { findSimilarTasks } from "./similarTasks.js";
export { buildPlan, computeImpact } from "./planBuilder.js";
export type { PlanContext } from "./planBuilder.js";
export { runVerification } from "./verifier.js";
export { extractLearnings, persistLearnings, updateKnowledgeFile } from "./learner.js";

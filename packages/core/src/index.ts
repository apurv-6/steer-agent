export const VERSION = "0.2.0";

export interface SteerConfig {
  name: string;
  version: string;
}

export function createConfig(name: string): SteerConfig {
  return { name, version: VERSION };
}

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

// New V2 Exports
export { buildCodebaseMap } from "./codemap-static.js";
export { createNewTask, transitionStep, INITIAL_STATE } from "./state.js";
export type { TaskState, StepName, StepStatus } from "./state.js";
export { initSteer } from "./init.js";
export { startTask } from "./start.js";
export type { StartOptions } from "./start.js";

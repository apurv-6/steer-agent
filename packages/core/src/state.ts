import { Mode } from "./types.js";

export type StepName =
  | "idle"
  | "context"
  | "prompt"
  | "planning"
  | "execution"
  | "reflection"
  | "verification"
  | "done";

export interface StepStatus {
  status: "pending" | "active" | "done" | "blocked" | "skipped";
  startedAt?: string;
  completedAt?: string;
  duration?: string;
}

export interface TaskState {
  taskId: string;
  mode: Mode;
  round: number;
  startedAt: string;
  currentStep: StepName;
  stepNumber: number;
  steps: Record<StepName, StepStatus>;
  modelTier?: "small" | "mid" | "high";
  modelReason?: string;
  sourcesUsed: string[];
  files: string[];
  impactPreview?: any; // To be defined
  score?: number;
  overrideUsed?: boolean;
  reflectionPassed?: boolean;
  resumable: boolean;
  context: any; // The gathered context
}

export const INITIAL_STATE: TaskState = {
  taskId: "",
  mode: "chat",
  round: 0,
  startedAt: "",
  currentStep: "idle",
  stepNumber: 0,
  steps: {
    idle: { status: "done" },
    context: { status: "pending" },
    prompt: { status: "pending" },
    planning: { status: "pending" },
    execution: { status: "pending" },
    reflection: { status: "pending" },
    verification: { status: "pending" },
    done: { status: "pending" },
  },
  sourcesUsed: [],
  files: [],
  resumable: false,
  context: {},
};

export function createNewTask(taskId: string, mode: Mode): TaskState {
  return {
    ...INITIAL_STATE,
    taskId,
    mode,
    startedAt: new Date().toISOString(),
    currentStep: "context",
    stepNumber: 1,
    steps: {
      ...INITIAL_STATE.steps,
      idle: { status: "done" },
      context: { status: "active", startedAt: new Date().toISOString() },
    },
    resumable: true,
  };
}

export function transitionStep(state: TaskState, nextStep: StepName): TaskState {
  const now = new Date().toISOString();

  // Mark current step as done
  if (state.steps[state.currentStep]) {
    state.steps[state.currentStep].status = "done";
    state.steps[state.currentStep].completedAt = now;
    // TODO: Calculate duration
  }

  // Activate next step
  const newState = { ...state, currentStep: nextStep };
  newState.steps[nextStep] = {
    ...newState.steps[nextStep],
    status: "active",
    startedAt: now,
  };

  // Update step number based on order
  const stepOrder: StepName[] = ["idle", "context", "prompt", "planning", "execution", "reflection", "verification", "done"];
  newState.stepNumber = stepOrder.indexOf(nextStep);

  return newState;
}

/**
 * Event types for SteerAgent's append-only event log.
 *
 * Events are the source of truth. `current-task.json` is a materialized view
 * derived by replaying events through `applyEvent()`.
 */
import type { StepName } from "./state.js";
import type {
  Mode,
  PlanStep,
  ImpactPreview,
  VerificationCheck,
  LearningEntry,
  HookResult,
} from "./types.js";

// ── Event Type Discriminator ────────────────────────────────────────

export type EventType =
  | "task_created"
  | "step_started"
  | "step_completed"
  | "rag_retrieved"
  | "model_routed"
  | "gate_scored"
  | "plan_created"
  | "plan_approved"
  | "execution_started"
  | "execution_attempt_failed"
  | "hook_executed"
  | "verification_completed"
  | "learning_extracted"
  | "task_completed";

// ── Base Event ──────────────────────────────────────────────────────

export interface BaseEvent {
  id: string;           // "evt_{timestamp}_{counter}"
  taskId: string;
  type: EventType;
  timestamp: string;    // ISO 8601
  stepName?: StepName;
}

// ── Concrete Event Types ────────────────────────────────────────────

export interface TaskCreatedEvent extends BaseEvent {
  type: "task_created";
  payload: {
    mode: Mode;
    goal?: string;
    initialMessage?: string;
    files: string[];
    originBranch?: string;
  };
}

export interface StepStartedEvent extends BaseEvent {
  type: "step_started";
  payload: {
    step: StepName;
    stepNumber: number;
  };
}

export interface StepCompletedEvent extends BaseEvent {
  type: "step_completed";
  payload: {
    step: StepName;
    stepNumber: number;
    durationMs: number;
  };
}

export interface RagRetrievedEvent extends BaseEvent {
  type: "rag_retrieved";
  payload: {
    sources: Array<{ file: string; score: number; chunk: string }>;
  };
}

export interface ModelRoutedEvent extends BaseEvent {
  type: "model_routed";
  payload: {
    tier: "small" | "mid" | "high";
    reason: string;
  };
}

export interface GateScoredEvent extends BaseEvent {
  type: "gate_scored";
  payload: {
    score: number;
    status: string;
    modelTier?: string;
  };
}

export interface PlanCreatedEvent extends BaseEvent {
  type: "plan_created";
  payload: {
    steps: PlanStep[];
    impact?: ImpactPreview;
  };
}

export interface PlanApprovedEvent extends BaseEvent {
  type: "plan_approved";
  payload: {
    approved: boolean;
  };
}

export interface ExecutionStartedEvent extends BaseEvent {
  type: "execution_started";
  payload: {
    attempt?: number;
    branch?: string;
  };
}

export interface ExecutionAttemptFailedEvent extends BaseEvent {
  type: "execution_attempt_failed";
  payload: {
    attempt: number;
    branch: string;
    failedStep?: string;
    reason: string;
  };
}

export interface HookExecutedEvent extends BaseEvent {
  type: "hook_executed";
  payload: HookResult;
}

export interface VerificationCompletedEvent extends BaseEvent {
  type: "verification_completed";
  payload: {
    passed: boolean;
    checks: VerificationCheck[];
    summary: string;
  };
}

export interface LearningExtractedEvent extends BaseEvent {
  type: "learning_extracted";
  payload: {
    learnings: LearningEntry[];
    modules: string[];
  };
}

export interface TaskCompletedEvent extends BaseEvent {
  type: "task_completed";
  payload: {
    fpcr: boolean;
    durationMs: number;
    round: number;
  };
}

// ── Discriminated Union ─────────────────────────────────────────────

export type SteerEvent =
  | TaskCreatedEvent
  | StepStartedEvent
  | StepCompletedEvent
  | RagRetrievedEvent
  | ModelRoutedEvent
  | GateScoredEvent
  | PlanCreatedEvent
  | PlanApprovedEvent
  | ExecutionStartedEvent
  | ExecutionAttemptFailedEvent
  | HookExecutedEvent
  | VerificationCompletedEvent
  | LearningExtractedEvent
  | TaskCompletedEvent;

// ── Helper to create partial event (without id/timestamp) ───────────

export type EventInput<T extends SteerEvent = SteerEvent> = Omit<T, "id" | "timestamp">;

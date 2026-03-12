/**
 * Event Store — append-only event log with materialized view.
 *
 * Source of truth: .steer/state/events.jsonl
 * Materialized view: .steer/state/current-task.json (regenerated on each emit)
 *
 * Usage:
 *   emitEvent(cwd, { type: "task_created", taskId, payload: {...} })
 *   // → appends to events.jsonl, updates current-task.json, returns new state
 */
import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import type { SteerEvent, EventInput } from "./events.js";
import type { TaskState, StepName } from "./state.js";
import { INITIAL_STATE } from "./state.js";

let _eventCounter = 0;

// ── Public API ──────────────────────────────────────────────────────

/**
 * Append an event to events.jsonl and update the materialized view.
 * This is the ONLY function that should write to current-task.json.
 *
 * Synchronous I/O to match existing codebase patterns (MCP tools + CLI).
 */
export function emitEvent(cwd: string, input: EventInput): TaskState {
  const stateDir = ensureStateDir(cwd);

  const fullEvent: SteerEvent = {
    ...input,
    id: `evt_${Date.now()}_${++_eventCounter}`,
    timestamp: new Date().toISOString(),
  } as SteerEvent;

  // 1. Append to event log (source of truth)
  const eventsPath = join(stateDir, "events.jsonl");
  appendFileSync(eventsPath, JSON.stringify(fullEvent) + "\n", "utf-8");

  // 2. Read current materialized state, apply event, write back
  const statePath = join(stateDir, "current-task.json");
  let state: TaskState;
  try {
    state = JSON.parse(readFileSync(statePath, "utf-8"));
  } catch {
    state = { ...structuredClone(INITIAL_STATE) };
  }

  state = applyEvent(state, fullEvent);
  writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");

  return state;
}

/**
 * Replay all events and reconstruct TaskState.
 * Used for recovery, debugging, and rebuilding materialized view.
 */
export function replayEvents(cwd: string, taskId?: string): TaskState {
  const eventsPath = join(cwd, ".steer", "state", "events.jsonl");
  if (!existsSync(eventsPath)) return structuredClone(INITIAL_STATE);

  const events = readEventsFile(eventsPath);
  const filtered = taskId ? events.filter((e) => e.taskId === taskId) : events;

  let state = structuredClone(INITIAL_STATE);
  for (const event of filtered) {
    state = applyEvent(state, event);
  }
  return state;
}

/**
 * Rebuild current-task.json from the event log.
 * Equivalent to: replay all events → write materialized view.
 */
export function materializeState(cwd: string, taskId?: string): TaskState {
  const state = replayEvents(cwd, taskId);
  const stateDir = ensureStateDir(cwd);
  const statePath = join(stateDir, "current-task.json");
  writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
  return state;
}

/**
 * Read all events from the event log file.
 */
export function readEventsFile(eventsPath: string): SteerEvent[] {
  if (!existsSync(eventsPath)) return [];
  try {
    const raw = readFileSync(eventsPath, "utf-8");
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as SteerEvent;
        } catch {
          return null;
        }
      })
      .filter((e): e is SteerEvent => e !== null);
  } catch {
    return [];
  }
}

/**
 * Archive the current events.jsonl for a completed task.
 * Moves events.jsonl → archive/{taskId}.events.jsonl, starts fresh.
 */
export function archiveEvents(cwd: string, taskId: string): void {
  const stateDir = join(cwd, ".steer", "state");
  const eventsPath = join(stateDir, "events.jsonl");
  if (!existsSync(eventsPath)) return;

  const archiveDir = join(stateDir, "archive");
  if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true });

  const archivePath = join(archiveDir, `${taskId}.events.jsonl`);
  renameSync(eventsPath, archivePath);
}

/**
 * Append an event to events.jsonl AND write the provided full state
 * as the materialized view. Use this during migration when the caller
 * has an in-memory state with mutations beyond what applyEvent covers.
 *
 * Events are recorded for observability/replay; the full state ensures
 * current-task.json is always correct.
 */
export function emitAndSync(cwd: string, input: EventInput, fullState: TaskState): SteerEvent {
  const stateDir = ensureStateDir(cwd);

  const fullEvent: SteerEvent = {
    ...input,
    id: `evt_${Date.now()}_${++_eventCounter}`,
    timestamp: new Date().toISOString(),
  } as SteerEvent;

  // 1. Append to event log
  const eventsPath = join(stateDir, "events.jsonl");
  appendFileSync(eventsPath, JSON.stringify(fullEvent) + "\n", "utf-8");

  // 2. Write the caller-provided state as materialized view
  const statePath = join(stateDir, "current-task.json");
  writeFileSync(statePath, JSON.stringify(fullState, null, 2), "utf-8");

  return fullEvent;
}

// ── Pure Reducer ────────────────────────────────────────────────────

/**
 * Pure function: apply a single event to produce a new state.
 * No I/O — safe for testing and replay.
 */
export function applyEvent(state: TaskState, event: SteerEvent): TaskState {
  // Shallow clone — deep fields are cloned as needed per case
  const s: TaskState = { ...state };
  const now = event.timestamp;

  switch (event.type) {
    case "task_created": {
      const p = event.payload;
      s.taskId = event.taskId;
      s.mode = p.mode;
      s.goal = p.goal;
      s.files = [...p.files];
      s.startedAt = now;
      s.currentStep = "context";
      s.stepNumber = 1;
      s.resumable = true;
      s.round = 0;
      s.hookResults = [];
      s.planSteps = [];
      s.learningNotes = [];
      s.sourcesUsed = [];
      s.steps = {
        ...structuredClone(INITIAL_STATE.steps),
        idle: { status: "done" },
        context: { status: "active", startedAt: now },
      };
      break;
    }

    case "step_started": {
      const p = event.payload;
      s.currentStep = p.step;
      s.stepNumber = p.stepNumber;
      s.steps = {
        ...s.steps,
        [p.step]: { ...s.steps[p.step], status: "active", startedAt: now },
      };
      break;
    }

    case "step_completed": {
      const p = event.payload;
      s.steps = {
        ...s.steps,
        [p.step]: {
          ...s.steps[p.step],
          status: "done",
          completedAt: now,
          duration: `${p.durationMs}ms`,
        },
      };
      break;
    }

    case "rag_retrieved": {
      s.ragSources = event.payload.sources.map((src) => ({ ...src }));
      s.sourcesUsed = [...new Set([...s.sourcesUsed, "rag"])];
      break;
    }

    case "model_routed": {
      s.modelTier = event.payload.tier;
      s.modelReason = event.payload.reason;
      break;
    }

    case "gate_scored": {
      s.score = event.payload.score;
      if (event.payload.modelTier) {
        s.modelTier = event.payload.modelTier as TaskState["modelTier"];
      }
      break;
    }

    case "plan_created": {
      s.planSteps = event.payload.steps.map((step) => ({ ...step }));
      if (event.payload.impact) {
        s.impactPreview = { ...event.payload.impact };
      }
      break;
    }

    case "plan_approved": {
      // Signals transition is valid; no direct field update needed
      break;
    }

    case "execution_started": {
      const p = event.payload;
      if (p.attempt !== undefined) {
        (s as any).attempt = p.attempt;
      }
      if (p.branch) {
        (s as any).executionBranch = p.branch;
      }
      break;
    }

    case "execution_attempt_failed": {
      const p = event.payload;
      const history: any[] = (s as any).attemptHistory || [];
      history.push({
        attempt: p.attempt,
        branch: p.branch,
        result: "fail",
        failedStep: p.failedStep,
        reason: p.reason,
        timestamp: now,
      });
      (s as any).attemptHistory = history;
      break;
    }

    case "hook_executed": {
      s.hookResults = [...s.hookResults, { ...event.payload }];
      break;
    }

    case "verification_completed": {
      s.verificationOutcome = {
        passed: event.payload.passed,
        checks: event.payload.checks.map((c) => ({ ...c })),
        summary: event.payload.summary,
      };
      break;
    }

    case "learning_extracted": {
      s.learningNotes = event.payload.learnings.map((l) => ({ ...l }));
      break;
    }

    case "task_completed": {
      s.currentStep = "done";
      s.stepNumber = 8;
      s.resumable = false;
      s.round = event.payload.round;
      s.steps = {
        ...s.steps,
        done: { status: "done", completedAt: now },
      };
      break;
    }

    default:
      // Unknown event type — no-op (forward compatibility)
      break;
  }

  return s;
}

// ── Helpers ─────────────────────────────────────────────────────────

function ensureStateDir(cwd: string): string {
  const stateDir = join(cwd, ".steer", "state");
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  return stateDir;
}

/**
 * Reset the event counter. Only needed for deterministic testing.
 */
export function _resetCounter(): void {
  _eventCounter = 0;
}

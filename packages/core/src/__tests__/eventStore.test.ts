import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  emitEvent,
  replayEvents,
  materializeState,
  applyEvent,
  readEventsFile,
  archiveEvents,
  _resetCounter,
} from "../eventStore.js";
import { INITIAL_STATE } from "../state.js";
import type { SteerEvent, TaskCreatedEvent, StepStartedEvent } from "../events.js";
import type { TaskState } from "../state.js";

let testDir: string;

beforeEach(() => {
  _resetCounter();
  testDir = join(tmpdir(), `steer-event-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(testDir, ".steer", "state"), { recursive: true });
});

afterEach(() => {
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

// ── applyEvent (pure reducer) ──────────────────────────────────────

describe("applyEvent", () => {
  it("task_created produces correct initial state", () => {
    const event: TaskCreatedEvent = {
      id: "evt_1",
      taskId: "T1",
      type: "task_created",
      timestamp: "2026-03-12T10:00:00.000Z",
      payload: {
        mode: "bugfix",
        goal: "Fix null check",
        files: ["src/foo.ts"],
      },
    };

    const state = applyEvent(structuredClone(INITIAL_STATE), event);

    expect(state.taskId).toBe("T1");
    expect(state.mode).toBe("bugfix");
    expect(state.goal).toBe("Fix null check");
    expect(state.files).toEqual(["src/foo.ts"]);
    expect(state.currentStep).toBe("context");
    expect(state.stepNumber).toBe(1);
    expect(state.resumable).toBe(true);
    expect(state.steps.idle.status).toBe("done");
    expect(state.steps.context.status).toBe("active");
    expect(state.steps.context.startedAt).toBe("2026-03-12T10:00:00.000Z");
  });

  it("step_started updates currentStep and step status", () => {
    let state = structuredClone(INITIAL_STATE);
    state.taskId = "T1";
    state.currentStep = "context";

    const event: StepStartedEvent = {
      id: "evt_2",
      taskId: "T1",
      type: "step_started",
      timestamp: "2026-03-12T10:01:00.000Z",
      payload: { step: "prompt", stepNumber: 2 },
    };

    state = applyEvent(state, event);
    expect(state.currentStep).toBe("prompt");
    expect(state.stepNumber).toBe(2);
    expect(state.steps.prompt.status).toBe("active");
    expect(state.steps.prompt.startedAt).toBe("2026-03-12T10:01:00.000Z");
  });

  it("step_completed marks step as done with duration", () => {
    let state = structuredClone(INITIAL_STATE);
    state.steps.context = { status: "active", startedAt: "2026-03-12T10:00:00.000Z" };

    const event: SteerEvent = {
      id: "evt_3",
      taskId: "T1",
      type: "step_completed",
      timestamp: "2026-03-12T10:00:03.200Z",
      payload: { step: "context", stepNumber: 1, durationMs: 3200 },
    };

    state = applyEvent(state, event);
    expect(state.steps.context.status).toBe("done");
    expect(state.steps.context.completedAt).toBe("2026-03-12T10:00:03.200Z");
    expect(state.steps.context.duration).toBe("3200ms");
  });

  it("rag_retrieved stores sources and adds to sourcesUsed", () => {
    let state = structuredClone(INITIAL_STATE);
    state.sourcesUsed = ["codemap"];

    const event: SteerEvent = {
      id: "evt_4",
      taskId: "T1",
      type: "rag_retrieved",
      timestamp: "2026-03-12T10:00:01.000Z",
      payload: {
        sources: [{ file: "src/foo.ts", score: 0.94, chunk: "function foo() {}" }],
      },
    };

    state = applyEvent(state, event);
    expect(state.ragSources).toHaveLength(1);
    expect(state.ragSources![0].score).toBe(0.94);
    expect(state.sourcesUsed).toContain("rag");
    expect(state.sourcesUsed).toContain("codemap");
  });

  it("model_routed sets tier and reason", () => {
    let state = structuredClone(INITIAL_STATE);

    const event: SteerEvent = {
      id: "evt_5",
      taskId: "T1",
      type: "model_routed",
      timestamp: "2026-03-12T10:00:01.000Z",
      payload: { tier: "high", reason: "auth/ is critical" },
    };

    state = applyEvent(state, event);
    expect(state.modelTier).toBe("high");
    expect(state.modelReason).toBe("auth/ is critical");
  });

  it("gate_scored sets score and optional modelTier", () => {
    let state = structuredClone(INITIAL_STATE);

    const event: SteerEvent = {
      id: "evt_6",
      taskId: "T1",
      type: "gate_scored",
      timestamp: "2026-03-12T10:00:01.000Z",
      payload: { score: 7, status: "READY", modelTier: "mid" },
    };

    state = applyEvent(state, event);
    expect(state.score).toBe(7);
    expect(state.modelTier).toBe("mid");
  });

  it("plan_created stores steps and impact", () => {
    let state = structuredClone(INITIAL_STATE);

    const event: SteerEvent = {
      id: "evt_7",
      taskId: "T1",
      type: "plan_created",
      timestamp: "2026-03-12T10:00:01.000Z",
      payload: {
        steps: [
          { id: 1, description: "Add guard", files: ["src/foo.ts"], action: "modify", risk: "low" },
        ],
        impact: {
          filesModified: ["src/foo.ts"],
          downstreamDeps: [],
          testsToRun: ["src/__tests__/foo.test.ts"],
          riskLevel: "low",
          summary: "Low risk change",
        },
      },
    };

    state = applyEvent(state, event);
    expect(state.planSteps).toHaveLength(1);
    expect(state.planSteps[0].description).toBe("Add guard");
    expect(state.impactPreview?.riskLevel).toBe("low");
  });

  it("hook_executed appends to hookResults", () => {
    let state = structuredClone(INITIAL_STATE);

    const event1: SteerEvent = {
      id: "evt_8a",
      taskId: "T1",
      type: "hook_executed",
      timestamp: "2026-03-12T10:00:01.000Z",
      payload: { hookStep: "pre-context", passed: true, action: "warn" },
    };

    const event2: SteerEvent = {
      id: "evt_8b",
      taskId: "T1",
      type: "hook_executed",
      timestamp: "2026-03-12T10:00:02.000Z",
      payload: { hookStep: "post-execution", passed: false, output: "lint failed", action: "block" },
    };

    state = applyEvent(state, event1);
    state = applyEvent(state, event2);
    expect(state.hookResults).toHaveLength(2);
    expect(state.hookResults[1].passed).toBe(false);
  });

  it("verification_completed stores outcome", () => {
    let state = structuredClone(INITIAL_STATE);

    const event: SteerEvent = {
      id: "evt_9",
      taskId: "T1",
      type: "verification_completed",
      timestamp: "2026-03-12T10:00:01.000Z",
      payload: {
        passed: true,
        checks: [{ name: "tests", passed: true }],
        summary: "All checks passed",
      },
    };

    state = applyEvent(state, event);
    expect(state.verificationOutcome?.passed).toBe(true);
    expect(state.verificationOutcome?.checks).toHaveLength(1);
  });

  it("learning_extracted stores learnings", () => {
    let state = structuredClone(INITIAL_STATE);

    const event: SteerEvent = {
      id: "evt_10",
      taskId: "T1",
      type: "learning_extracted",
      timestamp: "2026-03-12T10:00:01.000Z",
      payload: {
        learnings: [
          { id: "L1", taskId: "T1", module: "core", category: "pattern", summary: "Always null-check", createdAt: "2026-03-12T10:00:01.000Z" },
        ],
        modules: ["core"],
      },
    };

    state = applyEvent(state, event);
    expect(state.learningNotes).toHaveLength(1);
    expect(state.learningNotes[0].summary).toBe("Always null-check");
  });

  it("task_completed sets done state", () => {
    let state = structuredClone(INITIAL_STATE);
    state.taskId = "T1";
    state.resumable = true;

    const event: SteerEvent = {
      id: "evt_11",
      taskId: "T1",
      type: "task_completed",
      timestamp: "2026-03-12T10:05:00.000Z",
      payload: { fpcr: true, durationMs: 45000, round: 1 },
    };

    state = applyEvent(state, event);
    expect(state.currentStep).toBe("done");
    expect(state.resumable).toBe(false);
    expect(state.round).toBe(1);
    expect(state.steps.done.status).toBe("done");
  });

  it("execution_started records attempt and branch", () => {
    let state = structuredClone(INITIAL_STATE);

    const event: SteerEvent = {
      id: "evt_12",
      taskId: "T1",
      type: "execution_started",
      timestamp: "2026-03-12T10:00:01.000Z",
      payload: { attempt: 1, branch: "steer/T1-attempt-1" },
    };

    state = applyEvent(state, event);
    expect((state as any).attempt).toBe(1);
    expect((state as any).executionBranch).toBe("steer/T1-attempt-1");
  });

  it("execution_attempt_failed records to attemptHistory", () => {
    let state = structuredClone(INITIAL_STATE);

    const event: SteerEvent = {
      id: "evt_13",
      taskId: "T1",
      type: "execution_attempt_failed",
      timestamp: "2026-03-12T10:02:00.000Z",
      payload: { attempt: 1, branch: "steer/T1-attempt-1", failedStep: "test", reason: "tests failed" },
    };

    state = applyEvent(state, event);
    const history = (state as any).attemptHistory;
    expect(history).toHaveLength(1);
    expect(history[0].attempt).toBe(1);
    expect(history[0].result).toBe("fail");
  });

  it("unknown event type is a no-op", () => {
    const state = structuredClone(INITIAL_STATE);
    const event = { id: "evt_x", taskId: "T1", type: "unknown_type", timestamp: "2026-03-12T10:00:00.000Z", payload: {} } as any;
    const result = applyEvent(state, event);
    expect(result).toEqual(state);
  });

  it("full workflow replay produces correct final state", () => {
    let state = structuredClone(INITIAL_STATE);

    const events: SteerEvent[] = [
      { id: "e1", taskId: "T1", type: "task_created", timestamp: "2026-03-12T10:00:00Z", payload: { mode: "bugfix", goal: "Fix null", files: ["a.ts"] } } as any,
      { id: "e2", taskId: "T1", type: "step_started", timestamp: "2026-03-12T10:00:01Z", payload: { step: "prompt", stepNumber: 2 } } as any,
      { id: "e3", taskId: "T1", type: "gate_scored", timestamp: "2026-03-12T10:00:02Z", payload: { score: 8, status: "READY" } } as any,
      { id: "e4", taskId: "T1", type: "step_started", timestamp: "2026-03-12T10:00:03Z", payload: { step: "planning", stepNumber: 3 } } as any,
      { id: "e5", taskId: "T1", type: "plan_created", timestamp: "2026-03-12T10:00:04Z", payload: { steps: [{ id: 1, description: "Fix", files: ["a.ts"], action: "modify", risk: "low" }] } } as any,
      { id: "e6", taskId: "T1", type: "step_started", timestamp: "2026-03-12T10:00:05Z", payload: { step: "execution", stepNumber: 4 } } as any,
      { id: "e7", taskId: "T1", type: "verification_completed", timestamp: "2026-03-12T10:00:10Z", payload: { passed: true, checks: [], summary: "OK" } } as any,
      { id: "e8", taskId: "T1", type: "task_completed", timestamp: "2026-03-12T10:00:15Z", payload: { fpcr: true, durationMs: 15000, round: 1 } } as any,
    ];

    for (const event of events) {
      state = applyEvent(state, event);
    }

    expect(state.taskId).toBe("T1");
    expect(state.mode).toBe("bugfix");
    expect(state.goal).toBe("Fix null");
    expect(state.score).toBe(8);
    expect(state.planSteps).toHaveLength(1);
    expect(state.verificationOutcome?.passed).toBe(true);
    expect(state.currentStep).toBe("done");
    expect(state.resumable).toBe(false);
  });
});

// ── emitEvent (I/O integration) ────────────────────────────────────

describe("emitEvent", () => {
  it("appends event to events.jsonl", () => {
    emitEvent(testDir, {
      taskId: "T1",
      type: "task_created",
      payload: { mode: "feature", goal: "Add retry", files: [] },
    } as any);

    const eventsPath = join(testDir, ".steer", "state", "events.jsonl");
    expect(existsSync(eventsPath)).toBe(true);

    const lines = readFileSync(eventsPath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(1);

    const event = JSON.parse(lines[0]);
    expect(event.type).toBe("task_created");
    expect(event.taskId).toBe("T1");
    expect(event.id).toMatch(/^evt_/);
    expect(event.timestamp).toBeTruthy();
  });

  it("updates current-task.json as materialized view", () => {
    emitEvent(testDir, {
      taskId: "T1",
      type: "task_created",
      payload: { mode: "bugfix", goal: "Fix it", files: ["x.ts"] },
    } as any);

    const statePath = join(testDir, ".steer", "state", "current-task.json");
    const state: TaskState = JSON.parse(readFileSync(statePath, "utf-8"));

    expect(state.taskId).toBe("T1");
    expect(state.mode).toBe("bugfix");
    expect(state.currentStep).toBe("context");
  });

  it("multiple events append to same file", () => {
    emitEvent(testDir, {
      taskId: "T1",
      type: "task_created",
      payload: { mode: "feature", files: [] },
    } as any);

    emitEvent(testDir, {
      taskId: "T1",
      type: "step_started",
      payload: { step: "prompt", stepNumber: 2 },
    } as any);

    const eventsPath = join(testDir, ".steer", "state", "events.jsonl");
    const lines = readFileSync(eventsPath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);

    // State should reflect both events
    const statePath = join(testDir, ".steer", "state", "current-task.json");
    const state: TaskState = JSON.parse(readFileSync(statePath, "utf-8"));
    expect(state.currentStep).toBe("prompt");
  });

  it("event IDs are unique", () => {
    emitEvent(testDir, { taskId: "T1", type: "task_created", payload: { mode: "feature", files: [] } } as any);
    emitEvent(testDir, { taskId: "T1", type: "step_started", payload: { step: "prompt", stepNumber: 2 } } as any);

    const eventsPath = join(testDir, ".steer", "state", "events.jsonl");
    const events = readEventsFile(eventsPath);
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── replayEvents ───────────────────────────────────────────────────

describe("replayEvents", () => {
  it("returns INITIAL_STATE for empty events file", () => {
    const state = replayEvents(testDir);
    expect(state.taskId).toBe("");
    expect(state.currentStep).toBe("idle");
  });

  it("replays events to produce correct state", () => {
    emitEvent(testDir, { taskId: "T1", type: "task_created", payload: { mode: "bugfix", goal: "Fix", files: ["a.ts"] } } as any);
    emitEvent(testDir, { taskId: "T1", type: "step_started", payload: { step: "prompt", stepNumber: 2 } } as any);
    emitEvent(testDir, { taskId: "T1", type: "gate_scored", payload: { score: 9, status: "READY" } } as any);

    const state = replayEvents(testDir);
    expect(state.taskId).toBe("T1");
    expect(state.currentStep).toBe("prompt");
    expect(state.score).toBe(9);
  });

  it("filters by taskId", () => {
    emitEvent(testDir, { taskId: "T1", type: "task_created", payload: { mode: "bugfix", goal: "First", files: [] } } as any);
    emitEvent(testDir, { taskId: "T2", type: "task_created", payload: { mode: "feature", goal: "Second", files: [] } } as any);

    const state = replayEvents(testDir, "T2");
    expect(state.taskId).toBe("T2");
    expect(state.mode).toBe("feature");
    expect(state.goal).toBe("Second");
  });

  it("handles corrupted lines gracefully", () => {
    const eventsPath = join(testDir, ".steer", "state", "events.jsonl");
    writeFileSync(eventsPath, '{"id":"e1","taskId":"T1","type":"task_created","timestamp":"2026-01-01","payload":{"mode":"bugfix","files":[]}}\nINVALID JSON\n', "utf-8");

    const state = replayEvents(testDir);
    expect(state.taskId).toBe("T1");
  });
});

// ── materializeState ───────────────────────────────────────────────

describe("materializeState", () => {
  it("rebuilds current-task.json from events", () => {
    emitEvent(testDir, { taskId: "T1", type: "task_created", payload: { mode: "feature", goal: "Add X", files: ["b.ts"] } } as any);
    emitEvent(testDir, { taskId: "T1", type: "gate_scored", payload: { score: 7, status: "READY" } } as any);

    // Delete the materialized view
    const statePath = join(testDir, ".steer", "state", "current-task.json");
    rmSync(statePath);
    expect(existsSync(statePath)).toBe(false);

    // Rebuild
    const state = materializeState(testDir);
    expect(existsSync(statePath)).toBe(true);
    expect(state.taskId).toBe("T1");
    expect(state.score).toBe(7);

    // Verify file matches
    const fromFile: TaskState = JSON.parse(readFileSync(statePath, "utf-8"));
    expect(fromFile.taskId).toBe("T1");
    expect(fromFile.score).toBe(7);
  });
});

// ── readEventsFile ─────────────────────────────────────────────────

describe("readEventsFile", () => {
  it("returns empty array for nonexistent file", () => {
    const events = readEventsFile(join(testDir, "nonexistent.jsonl"));
    expect(events).toEqual([]);
  });

  it("parses valid JSONL", () => {
    emitEvent(testDir, { taskId: "T1", type: "task_created", payload: { mode: "bugfix", files: [] } } as any);
    emitEvent(testDir, { taskId: "T1", type: "gate_scored", payload: { score: 5, status: "NEEDS_INFO" } } as any);

    const eventsPath = join(testDir, ".steer", "state", "events.jsonl");
    const events = readEventsFile(eventsPath);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("task_created");
    expect(events[1].type).toBe("gate_scored");
  });
});

// ── archiveEvents ──────────────────────────────────────────────────

describe("archiveEvents", () => {
  it("moves events.jsonl to archive directory", () => {
    emitEvent(testDir, { taskId: "T1", type: "task_created", payload: { mode: "bugfix", files: [] } } as any);

    const eventsPath = join(testDir, ".steer", "state", "events.jsonl");
    expect(existsSync(eventsPath)).toBe(true);

    archiveEvents(testDir, "T1");

    expect(existsSync(eventsPath)).toBe(false);
    const archivePath = join(testDir, ".steer", "state", "archive", "T1.events.jsonl");
    expect(existsSync(archivePath)).toBe(true);
  });

  it("is a no-op when events.jsonl does not exist", () => {
    // Should not throw
    archiveEvents(testDir, "T1");
  });
});

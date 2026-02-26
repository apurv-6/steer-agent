import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  createTask,
  gatherContext,
  buildPromptStep,
  createPlan,
  approvePlan,
  completeExecution,
  verify,
  suspendTask,
  resumeTask,
  getStatus,
} from "../workflowEngine.js";
import { DEFAULT_TEMPLATES, DEFAULT_RULES, DEFAULT_HOOKS_YAML, DEFAULT_CONFIG } from "../defaultTemplates.js";

let tmpDir: string;
let steerDir: string;

function scaffoldSteer(dir: string): string {
  const sd = path.join(dir, ".steer");
  fs.mkdirSync(path.join(sd, "state"), { recursive: true });
  fs.mkdirSync(path.join(sd, "templates"), { recursive: true });
  fs.writeFileSync(path.join(sd, "config.json"), JSON.stringify(DEFAULT_CONFIG, null, 2));
  fs.writeFileSync(path.join(sd, "RULES.md"), DEFAULT_RULES);
  fs.writeFileSync(path.join(sd, "hooks.yaml"), DEFAULT_HOOKS_YAML);
  for (const [name, content] of Object.entries(DEFAULT_TEMPLATES)) {
    fs.writeFileSync(path.join(sd, "templates", name), content);
  }
  return sd;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "steer-wf-"));
  steerDir = scaffoldSteer(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("createTask", () => {
  it("creates a task at IDLE with correct defaults", () => {
    const state = createTask("bugfix", steerDir);
    expect(state.taskId).toMatch(/^task_/);
    expect(state.mode).toBe("bugfix");
    expect(state.currentStep).toBe("IDLE");
    expect(state.round).toBe(1);
    expect(state.resumable).toBe(true);
    expect(state.files).toEqual([]);
    expect(state.sourcesUsed).toEqual([]);
  });

  it("persists state to current-task.json", () => {
    const state = createTask("feature", steerDir);
    const taskPath = path.join(steerDir, "state", "current-task.json");
    expect(fs.existsSync(taskPath)).toBe(true);
    const persisted = JSON.parse(fs.readFileSync(taskPath, "utf-8"));
    expect(persisted.taskId).toBe(state.taskId);
  });
});

describe("gatherContext", () => {
  it("transitions IDLE → CONTEXT and loads template", () => {
    const state = createTask("bugfix", steerDir);
    const result = gatherContext(state, "Fix login crash in @src/auth.ts", steerDir);

    expect(result.state.currentStep).toBe("CONTEXT");
    expect(result.state.stepNumber).toBe(1);
    expect(result.template).not.toBeNull();
    expect(result.template!.mode).toBe("bugfix");
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.preloadedContext.goal).toBe("Fix login crash in @src/auth.ts");
    expect(result.state.sourcesUsed).toContain("config");
    expect(result.state.sourcesUsed).toContain("template");
  });

  it("extracts file refs from user input", () => {
    const state = createTask("bugfix", steerDir);
    const result = gatherContext(state, "Fix bug in @handler.ts and @utils.ts", steerDir);
    expect(result.state.files).toContain("handler.ts");
    expect(result.state.files).toContain("utils.ts");
  });
});

describe("buildPromptStep", () => {
  it("transitions CONTEXT → PROMPT and assembles prompt", () => {
    let state = createTask("bugfix", steerDir);
    const { state: contextState } = gatherContext(state, "Fix crash", steerDir);

    const result = buildPromptStep(contextState, {
      goal: "Fix null pointer in login handler",
      repro_steps: "Click login → crash",
      acceptance_criteria: "Login works without crash",
    }, steerDir);

    expect(result.state.currentStep).toBe("PROMPT");
    expect(result.assembledPrompt).toContain("Fix null pointer in login handler");
    expect(result.assembledPrompt).toContain("Click login");
  });

  it("falls back to basic prompt when no template", () => {
    // Remove templates dir
    fs.rmSync(path.join(steerDir, "templates"), { recursive: true, force: true });
    fs.mkdirSync(path.join(steerDir, "templates"), { recursive: true });

    let state = createTask("custom_mode", steerDir);
    const { state: contextState } = gatherContext(state, "Do something", steerDir);

    const result = buildPromptStep(contextState, { goal: "Test goal" }, steerDir);
    expect(result.assembledPrompt).toContain("## GOAL");
    expect(result.assembledPrompt).toContain("Test goal");
  });
});

describe("createPlan", () => {
  it("transitions PROMPT → PLANNING with plan steps", () => {
    let state = createTask("bugfix", steerDir);
    const { state: s1 } = gatherContext(state, "Fix crash", steerDir);
    const { state: s2 } = buildPromptStep(s1, { goal: "Fix it" }, steerDir);

    const result = createPlan(s2, ["Step 1: Investigate", "Step 2: Fix", "Step 3: Test"], steerDir);

    expect(result.state.currentStep).toBe("PLANNING");
    expect(result.state.approvedPlan).toEqual(["Step 1: Investigate", "Step 2: Fix", "Step 3: Test"]);
    expect(result.state.completedPlanSteps).toEqual([]);
  });
});

describe("approvePlan + completeExecution", () => {
  it("transitions PLANNING → EXECUTION → VERIFICATION", () => {
    let state = createTask("bugfix", steerDir);
    const { state: s1 } = gatherContext(state, "Fix crash", steerDir);
    const { state: s2 } = buildPromptStep(s1, { goal: "Fix it" }, steerDir);
    const { state: s3 } = createPlan(s2, ["Fix", "Test"], steerDir);

    const s4 = approvePlan(s3, steerDir);
    expect(s4.currentStep).toBe("EXECUTION");

    const s5 = completeExecution(s4, steerDir);
    expect(s5.currentStep).toBe("VERIFICATION");
  });
});

describe("verify", () => {
  function getToVerification(): ReturnType<typeof completeExecution> {
    const state = createTask("bugfix", steerDir);
    const { state: s1 } = gatherContext(state, "Fix crash", steerDir);
    const { state: s2 } = buildPromptStep(s1, { goal: "Fix" }, steerDir);
    const { state: s3 } = createPlan(s2, ["Fix"], steerDir);
    const s4 = approvePlan(s3, steerDir);
    return completeExecution(s4, steerDir);
  }

  it("marks task DONE on pass and writes history", () => {
    const vState = getToVerification();
    const result = verify(vState, true, steerDir, "All tests pass");

    expect(result.taskComplete).toBe(true);
    expect(result.state.currentStep).toBe("DONE");
    expect(result.historyEntry).toBeDefined();
    expect(result.historyEntry!.mode).toBe("bugfix");
    expect(result.historyEntry!.rounds).toBe(1);
    expect(result.historyEntry!.completedFirstRound).toBe(true);

    // Check history.jsonl written
    const historyPath = path.join(steerDir, "state", "history.jsonl");
    expect(fs.existsSync(historyPath)).toBe(true);
    const lines = fs.readFileSync(historyPath, "utf-8").trim().split("\n");
    expect(lines.length).toBe(1);
  });

  it("starts new round on fail (VERIFICATION → CONTEXT)", () => {
    const vState = getToVerification();
    const result = verify(vState, false, steerDir);

    expect(result.taskComplete).toBe(false);
    expect(result.state.currentStep).toBe("CONTEXT");
    expect(result.state.round).toBe(2);
  });
});

describe("suspendTask + resumeTask", () => {
  it("suspends and resumes a task correctly", () => {
    const state = createTask("bugfix", steerDir);
    const { state: s1 } = gatherContext(state, "Fix crash", steerDir);
    const { state: s2 } = buildPromptStep(s1, { goal: "Fix" }, steerDir);

    // Suspend at PROMPT step
    const suspended = suspendTask(s2, steerDir);
    expect(suspended.currentStep).toBe("SUSPENDED");
    expect(suspended.suspendedStep).toBe("PROMPT");

    // Resume
    const { state: resumed, resumeStep, message } = resumeTask(steerDir);
    expect(resumed).not.toBeNull();
    expect(resumed!.currentStep).toBe("PROMPT");
    expect(resumeStep).toBe("PROMPT");
    expect(message).toContain("Resuming");
  });

  it("returns null when no task to resume", () => {
    const result = resumeTask(steerDir);
    expect(result.state).toBeNull();
    expect(result.message).toContain("No task");
  });
});

describe("getStatus", () => {
  it("returns formatted status for active task", () => {
    const state = createTask("feature", steerDir);
    gatherContext(state, "Add new feature", steerDir);

    const status = getStatus(steerDir);
    expect(status).toContain("feature");
    expect(status).toContain("CONTEXT");
    expect(status).toContain("Round: 1");
  });

  it("returns no active task message when empty", () => {
    const status = getStatus(steerDir);
    expect(status).toBe("No active task.");
  });
});

describe("invalid transitions", () => {
  it("throws on IDLE → PLANNING (skip required steps)", () => {
    const state = createTask("bugfix", steerDir);
    expect(() => {
      buildPromptStep(state, {}, steerDir); // IDLE → PROMPT is invalid, must go through CONTEXT first
    }).toThrow("Invalid workflow transition");
  });

  it("throws on CONTEXT → EXECUTION (skip PROMPT+PLANNING)", () => {
    const state = createTask("bugfix", steerDir);
    const { state: s1 } = gatherContext(state, "Fix", steerDir);
    expect(() => {
      approvePlan(s1, steerDir); // CONTEXT → EXECUTION is invalid
    }).toThrow("Invalid workflow transition");
  });
});

describe("full lifecycle", () => {
  it("completes IDLE → CONTEXT → PROMPT → PLANNING → EXECUTION → VERIFICATION → DONE", () => {
    const s0 = createTask("refactor", steerDir);
    expect(s0.currentStep).toBe("IDLE");

    const { state: s1 } = gatherContext(s0, "Refactor auth module", steerDir);
    expect(s1.currentStep).toBe("CONTEXT");

    const { state: s2 } = buildPromptStep(s1, {
      goal: "Extract auth logic",
      constraints: "No API changes",
      acceptance_criteria: "All tests pass",
    }, steerDir);
    expect(s2.currentStep).toBe("PROMPT");

    const { state: s3 } = createPlan(s2, ["Extract", "Refactor", "Test"], steerDir);
    expect(s3.currentStep).toBe("PLANNING");

    const s4 = approvePlan(s3, steerDir);
    expect(s4.currentStep).toBe("EXECUTION");

    const s5 = completeExecution(s4, steerDir);
    expect(s5.currentStep).toBe("VERIFICATION");

    const result = verify(s5, true, steerDir);
    expect(result.state.currentStep).toBe("DONE");
    expect(result.taskComplete).toBe(true);
    expect(result.historyEntry).toBeDefined();
  });
});

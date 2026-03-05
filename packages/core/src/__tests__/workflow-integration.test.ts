import { describe, it, expect } from "vitest";
import { createNewTask, transitionStep, computeDuration } from "../state.js";
import { extractLearnings, completeTask } from "../learner.js";
import { runReflection } from "../reflection.js";
import { generateCommitMessage } from "../commit-gen.js";
import { generatePRDescription } from "../pr-gen.js";
import { shouldSpawnSubAgents } from "../subagent.js";
import { requestOverride } from "../overrideFlow.js";
import { tmpdir } from "os";
import { mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

describe("workflow integration", () => {
  it("full workflow: create → transitions → reflect → learn → commit → pr", () => {
    // 1. Create task
    const task = createNewTask("integration-1", "bugfix");
    expect(task.currentStep).toBe("context");
    expect(task.stepNumber).toBe(1);

    // 2. Transition through steps
    const afterPrompt = transitionStep(task, "prompt");
    expect(afterPrompt.currentStep).toBe("prompt");
    expect(afterPrompt.steps.context.status).toBe("done");

    const afterPlanning = transitionStep(afterPrompt, "planning");
    expect(afterPlanning.currentStep).toBe("planning");

    // 3. Add plan and execute
    afterPlanning.planSteps = [
      { id: 1, description: "Fix auth handler", files: ["src/auth.ts"], action: "modify", risk: "medium" },
    ];
    afterPlanning.files = ["src/auth.ts"];
    afterPlanning.goal = "Fix authentication timeout";
    afterPlanning.acceptanceCriteria = ["Auth no longer times out"];

    const afterExecution = transitionStep(afterPlanning, "execution");
    expect(afterExecution.currentStep).toBe("execution");

    // 4. Reflection
    const reflection = runReflection(afterExecution, "/tmp");
    expect(reflection.passed).toBe(true);
    afterExecution.reflectionPassed = reflection.passed;

    const afterReflection = transitionStep(afterExecution, "reflection");
    expect(afterReflection.currentStep).toBe("reflection");

    // 5. Verification (mock passed)
    afterReflection.verificationOutcome = {
      passed: true,
      checks: [{ name: "Tests", passed: true }],
      summary: "All passed",
    };

    const afterVerification = transitionStep(afterReflection, "verification");
    expect(afterVerification.currentStep).toBe("verification");

    // 6. Learning
    const afterLearning = transitionStep(afterVerification, "learning");
    const learnings = extractLearnings(afterLearning);
    afterLearning.learningNotes = learnings;

    // 7. Done
    const afterDone = transitionStep(afterLearning, "done");
    expect(afterDone.currentStep).toBe("done");

    // 8. Generate commit message
    const commit = generateCommitMessage(afterDone);
    expect(commit).toMatch(/^fix\(/);
    expect(commit).toContain("authentication timeout");

    // 9. Generate PR description
    const pr = generatePRDescription(afterDone);
    expect(pr).toContain("## What");
    expect(pr).toContain("## How");
    expect(pr).toContain("Fix auth handler");
  });

  it("override flow integrates with learning", () => {
    const task = createNewTask("override-1", "bugfix");
    task.score = 2;

    const overridden = requestOverride(task, "Urgent production fix");
    expect(overridden.overrideUsed).toBe(true);

    const learnings = extractLearnings(overridden);
    // Should include the override learning note
    const overrideLearning = learnings.find((l) => l.summary.includes("Override used"));
    expect(overrideLearning).toBeDefined();
  });

  it("subagent decision integrates with task state", () => {
    const task = createNewTask("subagent-1", "feature");
    task.files = [
      "src/auth/login.ts", "src/auth/token.ts",
      "lib/utils/helper.ts", "lib/utils/format.ts",
    ];

    const decision = shouldSpawnSubAgents(task);
    expect(decision.shouldSplit).toBe(true);
    expect(decision.agents.length).toBeGreaterThanOrEqual(2);
  });

  it("computeDuration calculates human-readable durations", () => {
    const start = "2024-01-01T00:00:00Z";
    expect(computeDuration(start, "2024-01-01T00:00:30Z")).toBe("30s");
    expect(computeDuration(start, "2024-01-01T00:02:15Z")).toBe("2m 15s");
    expect(computeDuration(start, "2024-01-01T01:30:00Z")).toBe("1h 30m");
    expect(computeDuration(undefined, "2024-01-01T00:00:30Z")).toBe("0s");
  });

  it("completeTask writes to history.jsonl", () => {
    const tmpDir = join(tmpdir(), `steer-test-${Date.now()}`);
    mkdirSync(join(tmpDir, ".steer", "state"), { recursive: true });

    const task = createNewTask("history-1", "feature");
    task.goal = "Add dark mode";
    task.files = ["src/theme.ts"];
    task.round = 1;

    completeTask(task, tmpDir);

    const historyPath = join(tmpDir, ".steer", "state", "history.jsonl");
    expect(existsSync(historyPath)).toBe(true);

    const content = readFileSync(historyPath, "utf-8");
    const record = JSON.parse(content.trim());
    expect(record.taskId).toBe("history-1");
    expect(record.mode).toBe("feature");
    expect(record.goal).toBe("Add dark mode");
  });
});

import { describe, it, expect } from "vitest";
import { generatePRDescription } from "../pr-gen.js";
import { createNewTask } from "../state.js";

describe("pr-gen", () => {
  it("generates PR description with all sections", () => {
    const task = createNewTask("t1", "bugfix");
    task.goal = "Fix login redirect";
    task.files = ["src/login.ts"];
    task.planSteps = [
      { id: 1, description: "Fix redirect logic", files: ["src/login.ts"], action: "modify", risk: "low" },
    ];
    task.verificationOutcome = {
      passed: true,
      checks: [{ name: "Tests", passed: true }],
      summary: "All checks passed",
    };

    const desc = generatePRDescription(task);
    expect(desc).toContain("## What");
    expect(desc).toContain("## Why");
    expect(desc).toContain("## How");
    expect(desc).toContain("## Impact");
    expect(desc).toContain("## Testing");
    expect(desc).toContain("Fix login redirect");
  });

  it("shows high-risk warning", () => {
    const task = createNewTask("t2", "feature");
    task.goal = "Add auth";
    task.files = ["src/auth.ts"];
    task.planSteps = [
      { id: 1, description: "Add auth middleware", files: ["src/auth.ts"], action: "create", risk: "high" },
    ];

    const desc = generatePRDescription(task);
    expect(desc).toContain(":warning:");
  });

  it("includes learnings section when present", () => {
    const task = createNewTask("t3", "bugfix");
    task.goal = "Fix bug";
    task.files = ["src/main.ts"];
    task.learningNotes = [{
      id: "l1", taskId: "t3", module: "main", category: "gotcha",
      summary: "Race condition in init", createdAt: new Date().toISOString(),
    }];

    const desc = generatePRDescription(task);
    expect(desc).toContain("## Learnings");
    expect(desc).toContain("Race condition in init");
  });

  it("handles empty task gracefully", () => {
    const task = createNewTask("t4", "feature");
    const desc = generatePRDescription(task);
    expect(desc).toContain("## What");
    expect(desc).toBeTruthy();
  });
});

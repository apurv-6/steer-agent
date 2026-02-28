import { describe, it, expect } from "vitest";
import { extractLearnings } from "../learner.js";
import { createNewTask } from "../state.js";

describe("learner", () => {
  it("extracts gotcha when round > 1", () => {
    const task = createNewTask("t1", "bugfix");
    task.round = 3;
    task.files = ["src/auth/login.ts"];

    const learnings = extractLearnings(task);
    const gotcha = learnings.find((l) => l.category === "gotcha");
    expect(gotcha).toBeDefined();
    expect(gotcha!.summary).toContain("3 rounds");
  });

  it("extracts pattern when reflection failed", () => {
    const task = createNewTask("t1", "bugfix");
    task.reflectionPassed = false;
    task.files = ["src/auth/login.ts"];

    const learnings = extractLearnings(task);
    const pattern = learnings.find((l) => l.category === "pattern");
    expect(pattern).toBeDefined();
  });

  it("extracts convention when verification failed", () => {
    const task = createNewTask("t1", "bugfix");
    task.verificationOutcome = {
      passed: false,
      checks: [
        { name: "Tests", passed: false, detail: "2 tests failed" },
        { name: "Lint", passed: true },
      ],
      summary: "1/2 checks failed",
    };
    task.files = ["src/auth/login.ts"];

    const learnings = extractLearnings(task);
    const convention = learnings.find((l) => l.category === "convention");
    expect(convention).toBeDefined();
    expect(convention!.summary).toContain("Tests");
  });

  it("extracts dependency when scope expanded", () => {
    const task = createNewTask("t1", "bugfix");
    task.planSteps = [
      { id: 1, description: "Modify login.ts", files: ["src/auth/login.ts"], action: "modify", risk: "low" },
    ];
    task.files = ["src/auth/login.ts", "src/auth/token.ts"]; // extra file

    const learnings = extractLearnings(task);
    const dep = learnings.find((l) => l.category === "dependency");
    expect(dep).toBeDefined();
    expect(dep!.summary).toContain("1 unplanned");
  });

  it("returns empty array for clean task", () => {
    const task = createNewTask("t1", "bugfix");
    task.round = 1;
    task.files = [];

    const learnings = extractLearnings(task);
    expect(learnings).toHaveLength(0);
  });
});

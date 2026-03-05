import { describe, it, expect } from "vitest";
import { generateCommitMessage } from "../commit-gen.js";
import { createNewTask } from "../state.js";

describe("commit-gen", () => {
  it("generates conventional commit for bugfix", () => {
    const task = createNewTask("t1", "bugfix");
    task.goal = "Fix login redirect loop";
    task.files = ["src/auth/login.ts"];

    const msg = generateCommitMessage(task);
    expect(msg).toMatch(/^fix\(.*\):/);
    expect(msg).toContain("login redirect loop");
  });

  it("generates feat for feature mode", () => {
    const task = createNewTask("t2", "feature");
    task.goal = "Add dark mode support";
    task.files = ["src/theme/dark.ts"];

    const msg = generateCommitMessage(task);
    expect(msg).toMatch(/^feat\(/);
  });

  it("generates refactor type for refactor mode", () => {
    const task = createNewTask("t3", "refactor");
    task.goal = "Simplify auth middleware";
    task.files = ["src/middleware/auth.ts"];

    const msg = generateCommitMessage(task);
    expect(msg).toMatch(/^refactor\(/);
  });

  it("includes plan steps in body", () => {
    const task = createNewTask("t4", "bugfix");
    task.goal = "Fix issue";
    task.files = ["src/main.ts"];
    task.planSteps = [
      { id: 1, description: "Update handler", files: ["src/main.ts"], action: "modify", risk: "low" },
    ];

    const msg = generateCommitMessage(task);
    expect(msg).toContain("Changes:");
    expect(msg).toContain("Update handler");
  });

  it("derives scope from packages directory", () => {
    const task = createNewTask("t5", "feature");
    task.goal = "Add feature";
    task.files = ["packages/core/src/state.ts", "packages/core/src/types.ts"];

    const msg = generateCommitMessage(task);
    expect(msg).toContain("core");
  });

  it("handles empty goal gracefully", () => {
    const task = createNewTask("t6", "bugfix");
    task.files = ["a.ts", "b.ts"];

    const msg = generateCommitMessage(task);
    expect(msg).toBeTruthy();
    expect(msg.length).toBeGreaterThan(5);
  });
});

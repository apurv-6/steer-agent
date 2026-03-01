import { describe, it, expect } from "vitest";
import { runReflection } from "../reflection.js";
import { createNewTask } from "../state.js";

describe("reflection", () => {
  it("passes when plan matches execution", () => {
    const task = createNewTask("t1", "bugfix");
    task.planSteps = [
      { id: 1, description: "Fix login", files: ["src/login.ts"], action: "modify", risk: "low" },
    ];
    task.files = ["src/login.ts"];
    task.acceptanceCriteria = ["Login works"];

    const result = runReflection(task, "/tmp");
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("detects unplanned files (scope expansion)", () => {
    const task = createNewTask("t1", "bugfix");
    task.planSteps = [
      { id: 1, description: "Fix login", files: ["src/login.ts"], action: "modify", risk: "low" },
    ];
    task.files = ["src/login.ts", "src/auth.ts"]; // extra file

    const result = runReflection(task, "/tmp");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes("Unplanned file"))).toBe(true);
  });

  it("detects planned files not modified", () => {
    const task = createNewTask("t1", "bugfix");
    task.planSteps = [
      { id: 1, description: "Fix login", files: ["src/login.ts", "src/auth.ts"], action: "modify", risk: "low" },
    ];
    task.files = ["src/login.ts"]; // missed auth.ts

    const result = runReflection(task, "/tmp");
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes("Planned file not modified"))).toBe(true);
  });

  it("warns when no acceptance criteria", () => {
    const task = createNewTask("t1", "bugfix");
    task.files = ["src/login.ts"];

    const result = runReflection(task, "/tmp");
    expect(result.issues.some((i) => i.includes("No acceptance criteria"))).toBe(true);
  });

  it("reports round number", () => {
    const task = createNewTask("t1", "bugfix");
    task.round = 2;
    task.files = [];
    const result = runReflection(task, "/tmp");
    expect(result.round).toBe(2);
  });
});

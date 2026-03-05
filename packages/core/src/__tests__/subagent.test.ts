import { describe, it, expect } from "vitest";
import { shouldSpawnSubAgents } from "../subagent.js";
import { createNewTask } from "../state.js";

describe("subagent", () => {
  it("rejects when too few files", () => {
    const task = createNewTask("t1", "bugfix");
    task.files = ["a.ts", "b.ts"];

    const decision = shouldSpawnSubAgents(task);
    expect(decision.shouldSplit).toBe(false);
  });

  it("rejects when all files in same directory", () => {
    const task = createNewTask("t2", "feature");
    task.files = ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"];

    const decision = shouldSpawnSubAgents(task);
    expect(decision.shouldSplit).toBe(false);
  });

  it("splits when files span multiple directories", () => {
    const task = createNewTask("t3", "feature");
    task.files = ["src/auth/login.ts", "src/auth/token.ts", "tests/auth.test.ts", "tests/token.test.ts"];

    const decision = shouldSpawnSubAgents(task);
    expect(decision.shouldSplit).toBe(true);
    expect(decision.agents.length).toBe(2);
  });

  it("assigns non-overlapping file sets", () => {
    const task = createNewTask("t4", "refactor");
    task.files = ["src/state.ts", "src/types.ts", "lib/index.ts", "lib/gate.ts"];

    const decision = shouldSpawnSubAgents(task);
    expect(decision.shouldSplit).toBe(true);

    // Verify no overlapping files
    const allFiles = decision.agents.flatMap((a) => a.files);
    expect(new Set(allFiles).size).toBe(allFiles.length);
  });
});

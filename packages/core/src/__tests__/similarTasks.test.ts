import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { findSimilarTasks } from "../similarTasks.js";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("similarTasks", () => {
  const testDir = join(tmpdir(), "steer-test-similar-" + Date.now());
  const stateDir = join(testDir, ".steer", "state");

  beforeEach(() => {
    mkdirSync(stateDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  });

  it("returns empty array when no history file", () => {
    const result = findSimilarTasks("bugfix", ["src/auth.ts"], "fix login", testDir);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty history", () => {
    writeFileSync(join(stateDir, "history.jsonl"), "");
    const result = findSimilarTasks("bugfix", ["src/auth.ts"], "fix login", testDir);
    expect(result).toEqual([]);
  });

  it("finds similar tasks by mode and files", () => {
    const history = [
      { taskId: "t1", mode: "bugfix", goal: "fix auth token", files: ["src/auth.ts"], modules: ["src"] },
      { taskId: "t2", mode: "feature", goal: "add payments", files: ["src/payments.ts"], modules: ["src"] },
      { taskId: "t3", mode: "bugfix", goal: "fix login page", files: ["src/login.ts"], modules: ["src"] },
    ];
    writeFileSync(join(stateDir, "history.jsonl"), history.map((h) => JSON.stringify(h)).join("\n"));

    const result = findSimilarTasks("bugfix", ["src/auth.ts"], "fix login bug", testDir);
    expect(result.length).toBeGreaterThan(0);
    // t1 should rank highest (same mode + same file + keyword overlap)
    expect(result[0].taskId).toBe("t1");
  });

  it("returns max 3 results", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      taskId: `t${i}`,
      mode: "bugfix",
      goal: `fix issue ${i}`,
      files: ["src/auth.ts"],
      modules: ["src"],
    }));
    writeFileSync(join(stateDir, "history.jsonl"), history.map((h) => JSON.stringify(h)).join("\n"));

    const result = findSimilarTasks("bugfix", ["src/auth.ts"], "fix issue", testDir);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

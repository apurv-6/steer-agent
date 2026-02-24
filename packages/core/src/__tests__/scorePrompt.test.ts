import { describe, it, expect } from "vitest";
import { scorePrompt } from "../scorePrompt.js";

describe("scorePrompt", () => {
  const fullPrompt = [
    "## GOAL",
    "Build a CLI tool that outputs JSON.",
    "## CONTEXT",
    "Node.js project.",
    "## LIMITS",
    "Only modify src/cli.ts.",
    "## OUTPUT FORMAT",
    "TypeScript files.",
    "## REVIEW",
    "Must pass all unit tests.",
  ].join("\n");

  it("returns deterministic results across multiple calls", () => {
    const results = Array.from({ length: 10 }, () => scorePrompt(fullPrompt, "chat"));
    for (const r of results) {
      expect(r).toEqual(results[0]);
    }
  });

  it("gives score 10 when all sections present and no vague verbs", () => {
    const result = scorePrompt(fullPrompt, "chat");
    expect(result.score).toBe(10);
    expect(result.missing).toEqual([]);
    expect(result.vagueFlags).toEqual([]);
  });

  it("penalizes missing GOAL by -2", () => {
    const noGoal = "## LIMITS\nOnly src/.\n## REVIEW\nRun tests.";
    const result = scorePrompt(noGoal, "chat");
    expect(result.missing).toContain("GOAL");
    expect(result.score).toBeLessThanOrEqual(8);
  });

  it("penalizes missing LIMITS by -2", () => {
    const noLimits = "## GOAL\nDo X.\n## REVIEW\nRun tests.";
    const result = scorePrompt(noLimits, "chat");
    expect(result.missing).toContain("LIMITS");
    expect(result.score).toBeLessThanOrEqual(8);
  });

  it("penalizes missing REVIEW by -2", () => {
    const noReview = "## GOAL\nDo X.\n## LIMITS\nOnly src/.";
    const result = scorePrompt(noReview, "chat");
    expect(result.missing).toContain("REVIEW");
    expect(result.score).toBeLessThanOrEqual(8);
  });

  it("accepts VERIFICATION as alternative to REVIEW", () => {
    const withVerification = "## GOAL\nDo X.\n## LIMITS\nOnly src/.\n## VERIFICATION\nRun tests.";
    const result = scorePrompt(withVerification, "chat");
    expect(result.missing).not.toContain("REVIEW");
  });

  it("detects vague verbs and penalizes -1", () => {
    const vague = "## GOAL\nFix the bug and improve performance.\n## LIMITS\nOnly src/.\n## REVIEW\nCheck output.";
    const result = scorePrompt(vague, "chat");
    expect(result.vagueFlags).toContain("fix");
    expect(result.vagueFlags).toContain("improve");
    expect(result.vagueFlags).toContain("check");
    // All sections present (10) minus vague (-1) = 9
    expect(result.score).toBe(9);
  });

  it("penalizes fileRefs without scope definition", () => {
    const noScope = "## GOAL\nRefactor @src/index.ts please.\n## REVIEW\nRun tests.";
    const result = scorePrompt(noScope, "chat");
    expect(result.fileRefs).toContain("src/index.ts");
    // Missing LIMITS (-2), fileRefs no scope (-1) = 10 - 2 - 1 = 7
    expect(result.score).toBe(7);
  });

  it("does not penalize fileRefs when scope is defined", () => {
    const withScope = "## GOAL\nRefactor @src/index.ts please.\n## LIMITS\nOnly referenced files.\n## REVIEW\nRun tests.";
    const result = scorePrompt(withScope, "chat");
    expect(result.fileRefs).toContain("src/index.ts");
    expect(result.score).toBe(10);
  });

  it("floors score at 0", () => {
    const terrible = "help me fix and improve and check stuff";
    const result = scorePrompt(terrible, "chat");
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("caps score at 10", () => {
    const result = scorePrompt(fullPrompt, "chat");
    expect(result.score).toBeLessThanOrEqual(10);
  });
});

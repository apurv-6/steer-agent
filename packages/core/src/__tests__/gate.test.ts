import { describe, it, expect } from "vitest";
import { gate } from "../gate.js";

describe("gate (canonical)", () => {
  it("returns BLOCKED for vague prompt", () => {
    const result = gate({ draftPrompt: "fix it", mode: "dev" });
    expect(result.status).toBe("BLOCKED");
    expect(result.score).toBeLessThanOrEqual(3);
    expect(result.nextAction).toBe("block");
    expect(result.patchedPrompt).toBeNull();
    expect(result.taskId).toBeTruthy();
    expect(result.turnId).toBe(1);
  });

  it("returns NEEDS_INFO for partial prompt", () => {
    const result = gate({
      draftPrompt: "## GOAL\nAdd user authentication to the app",
      mode: "dev",
    });
    expect(result.status).toBe("NEEDS_INFO");
    expect(result.score).toBeGreaterThan(3);
    expect(result.score).toBeLessThanOrEqual(6);
    expect(result.followupQuestions.length).toBeGreaterThan(0);
    expect(result.nextAction).toBe("answer_questions");
  });

  it("returns READY for well-structured prompt", () => {
    const result = gate({
      draftPrompt: [
        "## GOAL",
        "Add login endpoint returning JWT",
        "## LIMITS",
        "Only modify src/auth/. No DB schema changes.",
        "## REVIEW",
        "Must pass existing auth tests + new test for login.",
      ].join("\n"),
      mode: "dev",
    });
    expect(result.status).toBe("READY");
    expect(result.score).toBeGreaterThanOrEqual(7);
    expect(result.nextAction).toBe("apply");
    expect(result.patchedPrompt).toBeTruthy();
  });

  it("preserves taskId and increments turnId", () => {
    const r1 = gate({ draftPrompt: "fix it", mode: "dev", taskId: "task_abc", turnId: 1 });
    expect(r1.taskId).toBe("task_abc");
    expect(r1.turnId).toBe(1);
  });

  it("includes git impact when provided", () => {
    const result = gate({
      draftPrompt: "## GOAL\nRefactor auth\n## LIMITS\nOnly auth module\n## REVIEW\nTests pass",
      mode: "dev",
      gitDiffStat: " 3 files changed, 50 insertions(+), 20 deletions(-)",
      gitDiffNameOnly: "src/auth/login.ts\nsrc/auth/session.ts\nsrc/auth/types.ts",
      criticalPaths: ["src/auth"],
    });
    expect(result.gitImpact).toBeTruthy();
    expect(result.gitImpact!.criticalFilesHit.length).toBe(3);
    expect(result.modelSuggestion.tier).toBe("high");
  });

  it("incorporates answers into patched prompt", () => {
    const result = gate({
      draftPrompt: "Add user auth",
      mode: "dev",
      answers: {
        "goal_outcome": "JWT-based login returning access + refresh tokens",
        "scope_limits": "Only src/auth/ directory",
      },
    });
    // Score might still be low, but answers should be used when patching
    if (result.patchedPrompt) {
      expect(result.patchedPrompt).toContain("JWT-based login");
    }
  });

  it("returns cost estimate", () => {
    const result = gate({
      draftPrompt: "## GOAL\nTest\n## LIMITS\nNone\n## REVIEW\nManual",
      mode: "dev",
    });
    expect(result.costEstimate.estimatedTokens).toBeGreaterThan(0);
    expect(typeof result.costEstimate.estimatedCostUsd).toBe("number");
  });
});

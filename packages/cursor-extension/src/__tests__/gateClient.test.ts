import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@steer-agent-tool/core", () => ({
  gate: vi.fn((input: { draftPrompt: string; mode: string; taskId?: string; turnId?: number }) => ({
    score: 8,
    status: "READY",
    patchedPrompt: `improved: ${input.draftPrompt}`,
    missing: [],
    followupQuestions: [],
    nextAction: "proceed",
    taskId: input.taskId ?? "task_mock",
    turnId: input.turnId ?? 1,
    modelSuggestion: { tier: "sonnet", modelName: "claude-sonnet-4-6", reason: "default", explanations: [] },
    costEstimate: { estimatedCostUsd: 0.001, estimatedTokens: 500 },
    gitImpact: null,
  })),
}));

import { callGate } from "../gateClient.js";

describe("callGate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates to core gate with correct parameters", async () => {
    const { gate } = await import("@steer-agent-tool/core");
    const result = callGate("add auth", "dev", undefined, "task_123", 2);

    expect(gate).toHaveBeenCalledWith({
      draftPrompt: "add auth",
      mode: "dev",
      taskId: "task_123",
      turnId: 2,
      answers: undefined,
    });
    expect(result.status).toBe("READY");
    expect(result.score).toBe(8);
    expect(result.taskId).toBe("task_123"); // mock echoes back the provided taskId
  });

  it("passes answers through when provided", async () => {
    const { gate } = await import("@steer-agent-tool/core");
    const answers = { "0": "use JWT" };
    callGate("add auth", "bugfix", answers, "task_456", 3);

    expect(gate).toHaveBeenCalledWith(expect.objectContaining({ answers }));
  });

  it("works without optional taskId / turnId", async () => {
    const { gate } = await import("@steer-agent-tool/core");
    callGate("fix bug", "debug");

    expect(gate).toHaveBeenCalledWith({
      draftPrompt: "fix bug",
      mode: "debug",
      taskId: undefined,
      turnId: undefined,
      answers: undefined,
    });
  });

  it("returns GateResult from core unchanged", () => {
    const result = callGate("refactor module", "refactor", undefined, "t1", 1);
    expect(result).toMatchObject({
      score: 8,
      status: "READY",
      modelSuggestion: { tier: "sonnet" },
      costEstimate: { estimatedTokens: 500 },
    });
  });

  it("all GateModes are accepted", () => {
    const modes = ["dev", "debug", "bugfix", "design", "refactor"] as const;
    for (const mode of modes) {
      expect(() => callGate("some task", mode)).not.toThrow();
    }
  });
});

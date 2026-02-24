import { describe, it, expect } from "vitest";
import { routeModel } from "../routeModel.js";
import { estimateTokens } from "../estimateTokens.js";

describe("routeModel", () => {
  it("routes design mode with score >= 7 to high", () => {
    expect(routeModel({ mode: "design", score: 9 }).tier).toBe("high");
    expect(routeModel({ mode: "design", score: 7 }).tier).toBe("high");
  });

  it("routes plan mode with score >= 7 to high", () => {
    expect(routeModel({ mode: "plan", score: 8 }).tier).toBe("high");
  });

  it("routes bugfix mode with score >= 7 to mid", () => {
    expect(routeModel({ mode: "bugfix", score: 7 }).tier).toBe("mid");
  });

  it("routes debug mode with score >= 7 to mid", () => {
    expect(routeModel({ mode: "debug", score: 8 }).tier).toBe("mid");
  });

  it("routes standard tasks to small", () => {
    expect(routeModel({ mode: "chat", score: 10 }).tier).toBe("small");
    expect(routeModel({ mode: "code", score: 5 }).tier).toBe("small");
  });

  it("routes critical files to high", () => {
    const gitImpact = {
      filesChanged: 1,
      insertions: 5,
      deletions: 2,
      changedFiles: ["src/auth/login.ts"],
      criticalFilesHit: ["src/auth/login.ts"],
      impactLevel: "low" as const,
    };
    expect(routeModel({ mode: "code", score: 5, gitImpact }).tier).toBe("high");
  });

  it("downgrades high to mid when score <= 4", () => {
    const gitImpact = {
      filesChanged: 1,
      insertions: 5,
      deletions: 2,
      changedFiles: ["src/auth/login.ts"],
      criticalFilesHit: ["src/auth/login.ts"],
      impactLevel: "low" as const,
    };
    expect(routeModel({ mode: "code", score: 3, gitImpact }).tier).toBe("mid");
  });

  it("returns explanations array", () => {
    const result = routeModel({ mode: "design", score: 9 });
    expect(result.explanations).toBeInstanceOf(Array);
    expect(result.explanations.length).toBeGreaterThan(0);
  });
});

describe("estimateTokens", () => {
  it("estimates tokens as ceil(length/4)", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a".repeat(100))).toBe(25);
  });
});

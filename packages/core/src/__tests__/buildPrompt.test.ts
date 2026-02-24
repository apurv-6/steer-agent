import { describe, it, expect } from "vitest";
import { buildPrompt } from "../buildPrompt.js";
import type { ScoreResult } from "../types.js";

describe("buildPrompt", () => {
  const baseResult: ScoreResult = {
    score: 4,
    missing: ["GOAL", "LIMITS", "REVIEW"],
    vagueFlags: [],
    fileRefs: [],
  };

  it("produces output with all 5 sections", () => {
    const output = buildPrompt("Do something", { goal: "Ship feature", limits: "Only src/", review: "Run tests" }, baseResult);
    expect(output).toContain("GOAL:");
    expect(output).toContain("CONTEXT:");
    expect(output).toContain("LIMITS:");
    expect(output).toContain("OUTPUT FORMAT:");
    expect(output).toContain("REVIEW:");
  });

  it("uses answers for missing sections", () => {
    const output = buildPrompt("Do something", { goal: "Ship the CLI", limits: "src/ only", review: "Unit tests pass" }, baseResult);
    expect(output).toContain("Ship the CLI");
    expect(output).toContain("src/ only");
    expect(output).toContain("Unit tests pass");
  });

  it("preserves original prompt as CONTEXT", () => {
    const output = buildPrompt("Refactor the auth module for clarity", { goal: "Clean code" }, baseResult);
    expect(output).toContain("Refactor the auth module for clarity");
  });

  it("uses default OUTPUT FORMAT when not overridden", () => {
    const output = buildPrompt("Do something", {}, baseResult);
    expect(output).toContain("Return only the final result");
  });

  it("allows overriding OUTPUT FORMAT", () => {
    const output = buildPrompt("Do something", { outputFormat: "JSON array" }, baseResult);
    expect(output).toContain("JSON array");
    expect(output).not.toContain("Return only the final result");
  });

  it("is deterministic", () => {
    const results = Array.from({ length: 5 }, () =>
      buildPrompt("Test prompt", { goal: "G", limits: "L", review: "R" }, baseResult),
    );
    for (const r of results) {
      expect(r).toBe(results[0]);
    }
  });

  it("adds file-scope annotation to LIMITS when fileRefs exist", () => {
    const resultWithRefs: ScoreResult = {
      score: 7,
      missing: [],
      vagueFlags: [],
      fileRefs: ["src/auth.ts", "src/login.ts"],
    };
    const output = buildPrompt("Fix auth", {}, resultWithRefs);
    expect(output).toContain("Primary scope: @src/auth.ts, @src/login.ts");
    expect(output).toContain("Changes outside must be explicitly justified");
  });

  it("appends file-scope annotation to existing LIMITS", () => {
    const resultWithRefs: ScoreResult = {
      score: 8,
      missing: [],
      vagueFlags: [],
      fileRefs: ["src/index.ts"],
    };
    const output = buildPrompt("## LIMITS\nOnly TypeScript", { }, resultWithRefs);
    expect(output).toContain("Only TypeScript");
    expect(output).toContain("Primary scope: @src/index.ts");
  });
});

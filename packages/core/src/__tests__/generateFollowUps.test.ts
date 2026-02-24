import { describe, it, expect } from "vitest";
import { generateFollowUps } from "../generateFollowUps.js";
import type { ScoreResult } from "../types.js";

describe("generateFollowUps", () => {
  it("asks measurable outcome when GOAL is missing", () => {
    const result: ScoreResult = { score: 4, missing: ["GOAL", "LIMITS", "REVIEW"], vagueFlags: [], fileRefs: [] };
    const followUps = generateFollowUps(result);
    expect(followUps[0].question).toContain("measurable outcome");
    expect(followUps[0].type).toBe("open");
  });

  it("asks scope question when LIMITS is missing", () => {
    const result: ScoreResult = { score: 6, missing: ["LIMITS", "REVIEW"], vagueFlags: [], fileRefs: [] };
    const followUps = generateFollowUps(result);
    expect(followUps.some((f) => f.question.includes("constraints") || f.question.includes("scope"))).toBe(true);
  });

  it("asks verification question when REVIEW is missing", () => {
    const result: ScoreResult = { score: 8, missing: ["REVIEW"], vagueFlags: [], fileRefs: [] };
    const followUps = generateFollowUps(result);
    expect(followUps.some((f) => f.question.includes("verified") || f.question.includes("tested"))).toBe(true);
  });

  it("asks file-scope MCQ when fileRefs exist", () => {
    const result: ScoreResult = { score: 7, missing: [], vagueFlags: [], fileRefs: ["src/index.ts"] };
    const followUps = generateFollowUps(result);
    const mcq = followUps.find((f) => f.type === "mcq");
    expect(mcq).toBeDefined();
    expect(mcq!.question).toContain("referenced file(s)");
    expect(mcq!.options).toContain("Not sure");
  });

  it("asks for repro steps in bugfix mode when REVIEW is missing", () => {
    const result: ScoreResult = { score: 6, missing: ["REVIEW"], vagueFlags: [], fileRefs: [] };
    const followUps = generateFollowUps(result, "bugfix");
    expect(followUps.some((f) => f.question.includes("repro steps") || f.question.includes("error logs"))).toBe(true);
  });

  it("returns at most 3 questions", () => {
    const result: ScoreResult = { score: 0, missing: ["GOAL", "LIMITS", "REVIEW"], vagueFlags: ["fix"], fileRefs: ["a.ts"] };
    const followUps = generateFollowUps(result);
    expect(followUps.length).toBeLessThanOrEqual(3);
  });

  it("returns empty array when nothing is missing and no fileRefs", () => {
    const result: ScoreResult = { score: 10, missing: [], vagueFlags: [], fileRefs: [] };
    const followUps = generateFollowUps(result);
    expect(followUps).toEqual([]);
  });
});

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

  it("asks scope question as MCQ when LIMITS is missing", () => {
    const result: ScoreResult = { score: 6, missing: ["LIMITS", "REVIEW"], vagueFlags: [], fileRefs: [] };
    const followUps = generateFollowUps(result);
    const limitsQ = followUps.find((f) => f.question.includes("scope"));
    expect(limitsQ).toBeDefined();
    expect(limitsQ!.type).toBe("mcq");
    expect(limitsQ!.options).toContain("Only referenced files");
  });

  it("asks verification question as MCQ when REVIEW is missing", () => {
    const result: ScoreResult = { score: 8, missing: ["REVIEW"], vagueFlags: [], fileRefs: [] };
    const followUps = generateFollowUps(result);
    const reviewQ = followUps.find((f) => f.question.includes("verified"));
    expect(reviewQ).toBeDefined();
    expect(reviewQ!.type).toBe("mcq");
    expect(reviewQ!.options).toContain("Run existing tests");
  });

  it("asks file-scope MCQ when fileRefs exist", () => {
    const result: ScoreResult = { score: 7, missing: [], vagueFlags: [], fileRefs: ["src/index.ts"] };
    const followUps = generateFollowUps(result);
    const mcq = followUps.find((f) => f.type === "mcq");
    expect(mcq).toBeDefined();
    expect(mcq!.question).toContain("referenced file(s)");
    expect(mcq!.options).toContain("Not sure");
  });

  it("asks for repro steps as MCQ in bugfix mode when REVIEW is missing", () => {
    const result: ScoreResult = { score: 6, missing: ["REVIEW"], vagueFlags: [], fileRefs: [] };
    const followUps = generateFollowUps(result, "bugfix");
    const reproQ = followUps.find((f) => f.question.includes("repro steps") || f.question.includes("error logs"));
    expect(reproQ).toBeDefined();
    expect(reproQ!.type).toBe("mcq");
    expect(reproQ!.options).toContain("Yes, have repro steps");
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

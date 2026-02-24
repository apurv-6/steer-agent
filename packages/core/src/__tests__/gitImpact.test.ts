import { describe, it, expect } from "vitest";
import { parseGitImpact } from "../gitImpact.js";

describe("parseGitImpact", () => {
  it("parses standard git diff --stat output", () => {
    const stat = " 3 files changed, 50 insertions(+), 20 deletions(-)";
    const nameOnly = "src/foo.ts\nsrc/bar.ts\nsrc/baz.ts";
    const result = parseGitImpact(stat, nameOnly);
    expect(result.filesChanged).toBe(3);
    expect(result.insertions).toBe(50);
    expect(result.deletions).toBe(20);
    expect(result.changedFiles).toEqual(["src/foo.ts", "src/bar.ts", "src/baz.ts"]);
    expect(result.impactLevel).toBe("low");
  });

  it("flags critical files", () => {
    const stat = " 1 file changed, 5 insertions(+)";
    const nameOnly = "src/auth/login.ts";
    const result = parseGitImpact(stat, nameOnly, ["src/auth"]);
    expect(result.criticalFilesHit).toEqual(["src/auth/login.ts"]);
  });

  it("rates high impact for large diffs", () => {
    const stat = " 25 files changed, 800 insertions(+), 200 deletions(-)";
    const nameOnly = Array.from({ length: 25 }, (_, i) => `src/file${i}.ts`).join("\n");
    const result = parseGitImpact(stat, nameOnly);
    expect(result.impactLevel).toBe("high");
  });

  it("rates medium impact for moderate diffs", () => {
    const stat = " 8 files changed, 120 insertions(+), 30 deletions(-)";
    const nameOnly = Array.from({ length: 8 }, (_, i) => `src/file${i}.ts`).join("\n");
    const result = parseGitImpact(stat, nameOnly);
    expect(result.impactLevel).toBe("medium");
  });

  it("handles empty input", () => {
    const result = parseGitImpact("", "");
    expect(result.filesChanged).toBe(0);
    expect(result.impactLevel).toBe("low");
  });

  it("matches glob-style critical paths", () => {
    const stat = " 2 files changed, 10 insertions(+)";
    const nameOnly = "src/payments/stripe.ts\nsrc/utils/helpers.ts";
    const result = parseGitImpact(stat, nameOnly, ["src/payments/*"]);
    expect(result.criticalFilesHit).toEqual(["src/payments/stripe.ts"]);
  });
});

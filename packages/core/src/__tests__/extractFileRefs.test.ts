import { describe, it, expect } from "vitest";
import { extractFileRefs } from "../extractFileRefs.js";

describe("extractFileRefs", () => {
  it("extracts single file reference", () => {
    expect(extractFileRefs("Look at @src/index.ts")).toEqual(["src/index.ts"]);
  });

  it("extracts multiple file references", () => {
    const refs = extractFileRefs("Compare @src/a.ts and @src/b.ts");
    expect(refs).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("handles dotfiles and nested paths", () => {
    const refs = extractFileRefs("Check @.github/workflows/ci.yml");
    expect(refs).toEqual([".github/workflows/ci.yml"]);
  });

  it("returns empty array when no refs", () => {
    expect(extractFileRefs("No file references here")).toEqual([]);
  });

  it("does not match email-like patterns as full refs", () => {
    const refs = extractFileRefs("Email user@example.com");
    // Matches "example.com" — regex picks up anything after @
    expect(refs).toEqual(["example.com"]);
  });

  it("is deterministic", () => {
    const input = "See @foo.ts and @bar/baz.js";
    const results = Array.from({ length: 5 }, () => extractFileRefs(input));
    for (const r of results) {
      expect(r).toEqual(results[0]);
    }
  });
});

import { describe, it, expect } from "vitest";
import { parseHooksYaml } from "../hookRunner.js";

describe("hookRunner", () => {
  describe("parseHooksYaml", () => {
    it("parses hooks with all fields", () => {
      const yaml = `hooks:
  - step: pre-context
    check: "test -f package.json"
    on_fail: block
  - step: post-execution
    run: "npm run lint"
    on_fail: warn`;

      const result = parseHooksYaml(yaml);
      expect(result.hooks).toHaveLength(2);
      expect(result.hooks[0]).toEqual({
        step: "pre-context",
        check: "test -f package.json",
        on_fail: "block",
      });
      expect(result.hooks[1]).toEqual({
        step: "post-execution",
        run: "npm run lint",
        on_fail: "warn",
      });
    });

    it("returns empty hooks for empty input", () => {
      const result = parseHooksYaml("");
      expect(result.hooks).toHaveLength(0);
    });

    it("defaults on_fail to warn", () => {
      const yaml = `hooks:
  - step: pre-context
    check: "echo ok"`;

      const result = parseHooksYaml(yaml);
      expect(result.hooks[0].on_fail).toBe("warn");
    });

    it("ignores comments", () => {
      const yaml = `# This is a comment
hooks:
  # Another comment
  - step: pre-context
    check: "echo ok"
    on_fail: skip`;

      const result = parseHooksYaml(yaml);
      expect(result.hooks).toHaveLength(1);
      expect(result.hooks[0].step).toBe("pre-context");
    });
  });
});

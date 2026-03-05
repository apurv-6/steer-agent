import { describe, it, expect } from "vitest";
import { buildPlan, computeImpact } from "../planBuilder.js";
import { createNewTask } from "../state.js";
import type { CodebaseMap } from "../types.js";

const mockCodemap: CodebaseMap = {
  root: "/project",
  modules: {
    auth: {
      name: "auth",
      path: "src/auth",
      type: "feature-module",
      critical: true,
      files: ["src/auth/login.ts", "src/auth/token.ts"],
    },
    utils: {
      name: "utils",
      path: "src/utils",
      type: "shared-module",
      critical: false,
      files: ["src/utils/helpers.ts"],
    },
  },
  files: {
    "src/auth/login.ts": { path: "src/auth/login.ts", role: "controller", loc: 150 },
    "src/auth/token.ts": { path: "src/auth/token.ts", role: "service", loc: 80 },
    "src/utils/helpers.ts": { path: "src/utils/helpers.ts", role: "utility", loc: 30 },
  },
  dependencies: {
    "src/auth/login.ts": {
      imports: ["src/auth/token.ts"],
      importedBy: ["src/routes.ts"],
      testFile: "src/auth/__tests__/login.test.ts",
    },
    "src/auth/token.ts": {
      imports: [],
      importedBy: ["src/auth/login.ts"],
    },
    "src/utils/helpers.ts": {
      imports: [],
      importedBy: ["src/auth/login.ts", "src/auth/token.ts"],
    },
  },
  coupling: {},
};

describe("planBuilder", () => {
  it("creates plan steps for each file", () => {
    const task = createNewTask("t1", "bugfix");
    const { steps } = buildPlan({
      task,
      codemap: mockCodemap,
      goal: "Fix login",
      files: ["src/auth/login.ts"],
    });

    expect(steps.length).toBeGreaterThanOrEqual(1);
    expect(steps[0].files).toContain("src/auth/login.ts");
  });

  it("adds test step when test file exists", () => {
    const task = createNewTask("t1", "bugfix");
    const { steps } = buildPlan({
      task,
      codemap: mockCodemap,
      goal: "Fix login",
      files: ["src/auth/login.ts"],
    });

    const testStep = steps.find((s) => s.action === "test");
    expect(testStep).toBeDefined();
    expect(testStep!.files).toContain("src/auth/__tests__/login.test.ts");
  });

  it("marks critical module files as high risk", () => {
    const task = createNewTask("t1", "bugfix");
    const { steps } = buildPlan({
      task,
      codemap: mockCodemap,
      goal: "Fix login",
      files: ["src/auth/login.ts"],
    });

    const modifyStep = steps.find((s) => s.action === "modify");
    expect(modifyStep!.risk).toBe("high");
  });
});

describe("computeImpact", () => {
  it("computes downstream deps and tests", () => {
    const impact = computeImpact(["src/auth/login.ts"], mockCodemap);
    expect(impact.filesModified).toContain("src/auth/login.ts");
    expect(impact.downstreamDeps).toContain("src/routes.ts");
    expect(impact.testsToRun).toContain("src/auth/__tests__/login.test.ts");
  });

  it("returns medium risk without codemap", () => {
    const impact = computeImpact(["some/file.ts"]);
    expect(impact.riskLevel).toBe("medium");
  });

  it("returns high risk for critical module files", () => {
    const impact = computeImpact(["src/auth/login.ts"], mockCodemap);
    expect(impact.riskLevel).toBe("high");
  });
});

# Testing Patterns

**Analysis Date:** 2026-02-24

## Test Framework

**Runner:**
- Vitest 3.0.0
- Config: No explicit `vitest.config.ts` (uses defaults)

**Assertion Library:**
- Vitest built-in (`expect` from vitest)

**Run Commands:**
```bash
npm run test                    # Run all tests (workspace-wide)
npm run test --workspace=@steer-agent-tool/core  # Run core package tests
cd packages/core && npm test    # Run tests in specific package
```

## Test File Organization

**Location:**
- Co-located in `src/__tests__/` directory within package
- Pattern: `packages/core/src/__tests__/*.test.ts`

**Naming:**
- `{moduleName}.test.ts` matching source file name
- Examples: `scorePrompt.test.ts`, `buildPrompt.test.ts`, `extractFileRefs.test.ts`

**Structure:**
```
packages/core/
├── src/
│   ├── __tests__/
│   │   ├── buildPrompt.test.ts
│   │   ├── extractFileRefs.test.ts
│   │   ├── generateFollowUps.test.ts
│   │   ├── patchPrompt.test.ts
│   │   └── scorePrompt.test.ts
│   ├── scorePrompt.ts
│   ├── buildPrompt.ts
│   └── ...
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from "vitest";
import { scorePrompt } from "../scorePrompt.js";

describe("scorePrompt", () => {
  const fullPrompt = [...].join("\n");

  it("returns deterministic results across multiple calls", () => {
    const results = Array.from({ length: 10 }, () => scorePrompt(fullPrompt, "chat"));
    for (const r of results) {
      expect(r).toEqual(results[0]);
    }
  });

  it("gives score 10 when all sections present and no vague verbs", () => {
    const result = scorePrompt(fullPrompt, "chat");
    expect(result.score).toBe(10);
    expect(result.missing).toEqual([]);
    expect(result.vagueFlags).toEqual([]);
  });
});
```

**Patterns:**
- `describe` block per module/function
- `it` blocks for individual test cases
- Shared test data at describe scope (e.g., `baseResult`, `fullPrompt`)
- Descriptive test names stating expected behavior

## Mocking

**Framework:** Not used

**Patterns:**
- All tests are unit tests on pure functions
- No mocking of external dependencies
- No file system or network mocking needed

**What to Mock:**
- Not applicable — core functions are pure

**What NOT to Mock:**
- The actual implementations being tested

## Fixtures and Factories

**Test Data:**
```typescript
// Inline test data at describe scope
const baseResult: ScoreResult = {
  score: 4,
  missing: ["GOAL", "LIMITS", "REVIEW"],
  vagueFlags: [],
  fileRefs: [],
};

const fullPrompt = [
  "## GOAL",
  "Build a CLI tool that outputs JSON.",
  "## CONTEXT",
  "Node.js project.",
  "## LIMITS",
  "Only modify src/cli.ts.",
  "## OUTPUT FORMAT",
  "TypeScript files.",
  "## REVIEW",
  "Must pass all unit tests.",
].join("\n");
```

**Location:**
- Inline within test files
- No separate fixtures directory

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
cd packages/core && npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- All existing tests are unit tests
- Test pure functions in isolation
- Focus on input/output behavior
- Files: `packages/core/src/__tests__/*.test.ts`

**Integration Tests:**
- Not implemented
- No tests for CLI, MCP server, or extension

**E2E Tests:**
- Not implemented
- Manual smoke test for MCP: `packages/mcp-server/src/smoke.mjs`

## Common Patterns

**Determinism Testing:**
```typescript
it("is deterministic", () => {
  const results = Array.from({ length: 5 }, () =>
    buildPrompt("Test prompt", { goal: "G", limits: "L", review: "R" }, baseResult),
  );
  for (const r of results) {
    expect(r).toBe(results[0]);
  }
});
```

**Boundary Testing:**
```typescript
it("floors score at 0", () => {
  const terrible = "help me fix and improve and check stuff";
  const result = scorePrompt(terrible, "chat");
  expect(result.score).toBeGreaterThanOrEqual(0);
});

it("caps score at 10", () => {
  const result = scorePrompt(fullPrompt, "chat");
  expect(result.score).toBeLessThanOrEqual(10);
});
```

**Penalty/Feature Testing:**
```typescript
it("penalizes missing GOAL by -2", () => {
  const noGoal = "## LIMITS\nOnly src/.\n## REVIEW\nRun tests.";
  const result = scorePrompt(noGoal, "chat");
  expect(result.missing).toContain("GOAL");
  expect(result.score).toBeLessThanOrEqual(8);
});
```

**String Containment:**
```typescript
it("produces output with all 5 sections", () => {
  const output = buildPrompt("Do something", { goal: "Ship feature" }, baseResult);
  expect(output).toContain("GOAL:");
  expect(output).toContain("CONTEXT:");
  expect(output).toContain("LIMITS:");
});
```

## Test Coverage by Package

| Package | Has Tests | Test Count | Coverage |
|---------|-----------|------------|----------|
| `@steer-agent-tool/core` | Yes | 5 files, ~40 tests | Core logic covered |
| `@steer-agent-tool/cli` | No | 0 | Not tested |
| `@steer-agent-tool/mcp-server` | No | 0 | Smoke test only |
| `@steer-agent-tool/cursor-extension` | No | 0 | Not tested |

## Tested Functions

**Fully Tested (core):**
- `scorePrompt()` — 12 test cases
- `buildPrompt()` — 7 test cases
- `extractFileRefs()` — 6 test cases
- `generateFollowUps()` — 7 test cases
- `routeModel()` — 4 test cases
- `estimateTokens()` — 4 test cases

**Not Tested:**
- CLI interactive flow (`packages/cli/src/steer.ts`)
- CLI metrics reporting (`packages/cli/src/metrics.ts`)
- MCP server handler (`packages/mcp-server/src/index.ts`)
- Gate adapter functions (`gateAdapter.ts`, `gate.ts`)
- VS Code extension activation/commands
- Webview panels (`StatusPanel.ts`, `WizardPanel.ts`)
- Telemetry append (`packages/core/src/telemetry.ts`)

---

*Testing analysis: 2026-02-24*

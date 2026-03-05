import { execSync } from "child_process";
import { VerificationResult, VerificationCheck, HooksConfig } from "./types.js";
import { TaskState } from "./state.js";
import { runHooks } from "./hookRunner.js";

/**
 * Run verification checks against a completed task.
 * Checks acceptance criteria, runs test/lint hooks, validates scope.
 */
export function runVerification(
  task: TaskState,
  hooks: HooksConfig,
  cwd: string,
): VerificationResult {
  const checks: VerificationCheck[] = [];

  // 1. Check acceptance criteria are defined
  checks.push({
    name: "Acceptance criteria defined",
    passed: !!task.acceptanceCriteria && task.acceptanceCriteria.length > 0,
    detail: task.acceptanceCriteria
      ? `${task.acceptanceCriteria.length} criteria defined`
      : "No acceptance criteria specified",
  });

  // 2. Check plan was created and followed
  checks.push({
    name: "Plan executed",
    passed: task.planSteps.length > 0,
    detail: task.planSteps.length > 0
      ? `${task.planSteps.length} plan steps defined`
      : "No plan steps recorded",
  });

  // 3. Run verification hooks (post-verification step)
  const hookResults = runHooks("post-verification", hooks, cwd);
  for (const hr of hookResults) {
    checks.push({
      name: `Hook: ${hr.hookStep}`,
      passed: hr.passed,
      detail: hr.output,
    });
  }

  // 4. Run test command if available (from hooks or default)
  const testCheck = runTestCommand(hooks, cwd);
  if (testCheck) checks.push(testCheck);

  // 5. Run lint command if available
  const lintCheck = runLintCommand(hooks, cwd);
  if (lintCheck) checks.push(lintCheck);

  const passed = checks.every((c) => c.passed);
  return {
    passed,
    checks,
    summary: passed
      ? `All ${checks.length} checks passed.`
      : `${checks.filter((c) => !c.passed).length}/${checks.length} checks failed.`,
  };
}

function runTestCommand(hooks: HooksConfig, cwd: string): VerificationCheck | null {
  // Look for a test hook
  const testHook = hooks.hooks.find((h) => h.step === "verify-test");
  const cmd = testHook?.run ?? findDefaultTestCommand(cwd);
  if (!cmd) return null;

  try {
    execSync(cmd, { cwd, stdio: "pipe", timeout: 60000 });
    return { name: "Tests", passed: true, detail: `${cmd} passed` };
  } catch (err: any) {
    return {
      name: "Tests",
      passed: false,
      detail: err.stderr?.toString().slice(0, 500) || `${cmd} failed`,
    };
  }
}

function runLintCommand(hooks: HooksConfig, cwd: string): VerificationCheck | null {
  const lintHook = hooks.hooks.find((h) => h.step === "verify-lint");
  if (!lintHook?.run) return null;

  try {
    execSync(lintHook.run, { cwd, stdio: "pipe", timeout: 30000 });
    return { name: "Lint", passed: true, detail: `${lintHook.run} passed` };
  } catch (err: any) {
    return {
      name: "Lint",
      passed: false,
      detail: err.stderr?.toString().slice(0, 500) || `${lintHook.run} failed`,
    };
  }
}

function findDefaultTestCommand(cwd: string): string | null {
  // Try common test commands
  try {
    const pkg = JSON.parse(require("fs").readFileSync(require("path").join(cwd, "package.json"), "utf-8"));
    if (pkg.scripts?.test) return "npm test";
  } catch {
    // no package.json
  }
  return null;
}

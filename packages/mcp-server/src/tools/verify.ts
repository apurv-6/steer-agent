import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  runVerification,
  loadHooks,
  transitionStep,
  steerDirExists,
  logToolCall,
  emitAndSync,
  mergeAttemptBranch,
  deleteAttemptBranch,
  createAttemptBranch,
  runBuildChecks,
} from "@steer-agent-tool/core";
import type { SteerConfig } from "@steer-agent-tool/core";

export const VerifySchema = {
  taskId: z.string().describe("Task ID to verify"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handleVerify(args: { taskId: string; cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();

    if (!steerDirExists(cwd)) {
      return {
        content: [{ type: "text" as const, text: "SteerAgent is not initialized in this project.\n\nRun:\n  steer-agent init\n\nOr with npx:\n  npx @coinswitch/steer-agent init" }],
      };
    }

    const statePath = join(cwd, ".steer", "state", "current-task.json");
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    const hooks = loadHooks(cwd);

    try { logToolCall("steer.verify", { taskId: args.taskId }, cwd); } catch {}

    // Load config for git branch settings
    const configPath = join(cwd, ".steer", "config.json");
    let config: SteerConfig | undefined;
    if (existsSync(configPath)) {
      try { config = JSON.parse(readFileSync(configPath, "utf-8")); } catch {}
    }

    const gitBranchEnabled = config?.execution?.gitBranch === true && state.executionBranch;

    // Run hook-based verification
    const result = runVerification(state, hooks, cwd);

    // If git branch enabled, also run build checks
    let buildResult: ReturnType<typeof runBuildChecks> | undefined;
    if (gitBranchEnabled) {
      buildResult = runBuildChecks(cwd);
    }

    const overallPassed = result.passed && (buildResult ? buildResult.passed : true);

    try { logToolCall("steer.verify.done", { taskId: args.taskId, passed: overallPassed, checks: result?.checks?.length, buildPassed: buildResult?.passed }, cwd); } catch {}

    state.verificationOutcome = result;

    // Transition through reflection step (handled implicitly by Claude) then to verification
    let current = state;
    if (current.currentStep === "execution") {
      current = transitionStep(current, "reflection");
    }
    const updated = transitionStep(current, "verification");

    // Git branch: handle merge or retry
    if (gitBranchEnabled) {
      const originBranch = state.originBranch!;
      const executionBranch = state.executionBranch!;
      const attempt = state.attempt || 1;
      const maxAttempts = state.maxAttempts || 3;
      const mergeStrategy = config?.execution?.mergeStrategy || "squash";

      // Update attempt history
      const attemptHistory = updated.attemptHistory || [];
      const currentAttempt = attemptHistory.find((a: any) => a.attempt === attempt);
      if (currentAttempt) {
        currentAttempt.endedAt = new Date().toISOString();
        currentAttempt.outcome = overallPassed ? "passed" : "failed";
        if (!overallPassed) {
          currentAttempt.failReason = buildResult && !buildResult.passed
            ? `Build checks failed: ${buildResult.checks.filter(c => !c.passed).map(c => c.name).join(", ")}`
            : result.summary || "Verification failed";
        }
      }

      if (overallPassed) {
        // Merge and clean up
        mergeAttemptBranch(cwd, executionBranch, originBranch, mergeStrategy);
        updated.executionBranch = undefined;

        emitAndSync(cwd, { taskId: args.taskId, type: "verification_completed", payload: { passed: true, checks: result.checks || [], summary: result.summary || "" } }, updated);

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            verification: result,
            buildChecks: buildResult,
            taskId: args.taskId,
            gitBranch: { merged: true, strategy: mergeStrategy, branch: executionBranch },
          }, null, 2) }],
        };
      }

      // Failed — retry or give up
      if (attempt < maxAttempts) {
        // Delete failed branch, create new attempt
        deleteAttemptBranch(cwd, executionBranch, originBranch);
        const nextAttempt = attempt + 1;
        const newBranch = createAttemptBranch(cwd, args.taskId, nextAttempt);

        updated.attempt = nextAttempt;
        updated.executionBranch = newBranch;
        updated.currentStep = "execution";
        updated.attemptHistory.push({
          attempt: nextAttempt,
          branch: newBranch,
          startedAt: new Date().toISOString(),
          outcome: "pending",
        });

        emitAndSync(cwd, { taskId: args.taskId, type: "execution_attempt_failed", payload: { attempt, branch: executionBranch, reason: currentAttempt?.failReason || "Verification failed" } }, updated);

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            verification: result,
            buildChecks: buildResult,
            taskId: args.taskId,
            gitBranch: { retrying: true, failedBranch: executionBranch, newBranch, attempt: nextAttempt, maxAttempts },
            message: `Attempt ${attempt} failed. Retrying on ${newBranch} (${nextAttempt}/${maxAttempts}). Fix the issues and call steer.verify again.`,
          }, null, 2) }],
        };
      }

      // Max attempts reached — give up, clean up branch
      deleteAttemptBranch(cwd, executionBranch, originBranch);
      updated.executionBranch = undefined;

      emitAndSync(cwd, { taskId: args.taskId, type: "execution_attempt_failed", payload: { attempt, branch: executionBranch, reason: `Max attempts (${maxAttempts}) reached` } }, updated);

      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          verification: result,
          buildChecks: buildResult,
          taskId: args.taskId,
          gitBranch: { failed: true, attempts: attempt, maxAttempts },
          message: `All ${maxAttempts} attempts failed. Returning to ${originBranch}.`,
        }, null, 2) }],
      };
    }

    // Non-git-branch path (original behavior)
    emitAndSync(cwd, { taskId: args.taskId, type: "verification_completed", payload: { passed: result.passed, checks: result.checks || [], summary: result.summary || "" } }, updated);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ verification: result, taskId: args.taskId }, null, 2) }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}

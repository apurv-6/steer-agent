import { TaskState } from "./state.js";
import { HooksConfig } from "./types.js";
import { runHooks } from "./hookRunner.js";

export interface ReflectionResult {
  passed: boolean;
  issues: string[];
  round: number;
}

const MAX_REFLECTION_ROUNDS = 2;

/**
 * Run reflection on a completed execution step.
 * Checks plan vs execution: were all planned files modified?
 * Checks scope: any unplanned files?
 * Checks hooks: do post-execution hooks pass?
 * Max 2 rounds (from spec).
 */
export function runReflection(
  task: TaskState,
  cwd: string,
  hooks?: HooksConfig,
): ReflectionResult {
  const issues: string[] = [];
  const round = Math.min(task.round, MAX_REFLECTION_ROUNDS);

  // 1. Plan coverage: were all planned files touched?
  if (task.planSteps.length > 0) {
    const plannedFiles = new Set(task.planSteps.flatMap((s) => s.files));
    const touchedFiles = new Set(task.files);

    for (const planned of plannedFiles) {
      if (!touchedFiles.has(planned)) {
        issues.push(`Planned file not modified: ${planned}`);
      }
    }

    // 2. Scope expansion: any unplanned files?
    for (const touched of touchedFiles) {
      if (!plannedFiles.has(touched)) {
        issues.push(`Unplanned file modified: ${touched}`);
      }
    }
  }

  // 3. Acceptance criteria check
  if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
    // Can only verify that criteria exist — actual verification is in verifier step
  } else {
    issues.push("No acceptance criteria defined");
  }

  // 4. Round limit check
  if (round >= MAX_REFLECTION_ROUNDS && issues.length > 0) {
    issues.push(`Max reflection rounds (${MAX_REFLECTION_ROUNDS}) reached — proceeding with issues`);
  }

  // 5. Run post-execution hooks if available
  if (hooks) {
    const hookResults = runHooks("post-execution", hooks, cwd);
    for (const hr of hookResults) {
      if (!hr.passed) {
        issues.push(`Hook failed: ${hr.hookStep} — ${hr.output || "no output"}`);
      }
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    round,
  };
}

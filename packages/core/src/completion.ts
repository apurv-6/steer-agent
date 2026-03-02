import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { TaskState } from "./state.js";

export interface HistoryEntry {
  taskId: string;
  mode: string;
  goal: string;
  completedAt: string;
  durationMs: number;
  round: number;
  files: number;
  modelTier: string;
  reflectionPassed: boolean;
  verificationPassed: boolean;
  learnings: number;
  fpcr: boolean; // true = completed without override in round 1
}

/**
 * Append completed task to .steer/state/history.jsonl for FPCR tracking.
 * Called once at the end of the workflow, before transitioning to "done".
 */
export function completeTask(state: TaskState, cwd: string): HistoryEntry {
  const stateDir = join(cwd, ".steer", "state");
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });

  const startedAt = state.startedAt ? new Date(state.startedAt).getTime() : Date.now();
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startedAt;

  const entry: HistoryEntry = {
    taskId: state.taskId,
    mode: state.mode,
    goal: state.goal ?? "",
    completedAt,
    durationMs,
    round: state.round,
    files: state.files.length,
    modelTier: state.modelTier ?? "small",
    reflectionPassed: state.reflectionPassed ?? true,
    verificationPassed: state.verificationOutcome?.passed ?? false,
    learnings: state.learningNotes.length,
    fpcr: !state.overrideUsed && state.round <= 1,
  };

  const historyPath = join(stateDir, "history.jsonl");
  appendFileSync(historyPath, JSON.stringify(entry) + "\n", "utf-8");

  return entry;
}

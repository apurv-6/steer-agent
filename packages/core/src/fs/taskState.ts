import * as fs from "node:fs";
import * as path from "node:path";
import type { CurrentTaskState, TaskHistoryEntry } from "../workflow/types.js";

function ensureStateDir(steerDir: string): string {
  const stateDir = path.join(steerDir, "state");
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  return stateDir;
}

export function readCurrentTask(steerDir: string): CurrentTaskState | null {
  const stateDir = ensureStateDir(steerDir);
  const taskPath = path.join(stateDir, "current-task.json");
  if (!fs.existsSync(taskPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(taskPath, "utf-8");
    return JSON.parse(raw) as CurrentTaskState;
  } catch {
    return null;
  }
}

export function writeCurrentTask(steerDir: string, state: CurrentTaskState): void {
  const stateDir = ensureStateDir(steerDir);
  const taskPath = path.join(stateDir, "current-task.json");
  fs.writeFileSync(taskPath, JSON.stringify(state, null, 2), "utf-8");
}

export function clearCurrentTask(steerDir: string): boolean {
  const stateDir = ensureStateDir(steerDir);
  const taskPath = path.join(stateDir, "current-task.json");
  if (fs.existsSync(taskPath)) {
    fs.unlinkSync(taskPath);
    return true;
  }
  return false;
}

export function appendHistory(steerDir: string, entry: TaskHistoryEntry): void {
  const stateDir = ensureStateDir(steerDir);
  const historyPath = path.join(stateDir, "history.jsonl");
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(historyPath, line, "utf-8");
}

export function readHistory(steerDir: string): TaskHistoryEntry[] {
  const stateDir = ensureStateDir(steerDir);
  const historyPath = path.join(stateDir, "history.jsonl");
  if (!fs.existsSync(historyPath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(historyPath, "utf-8");
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as TaskHistoryEntry);
  } catch {
    return [];
  }
}

/**
 * Search history for tasks similar to the current one.
 * Matches by mode, files, and goal keywords.
 */
export function findSimilarTasks(
  steerDir: string,
  mode: string,
  files: string[],
  goalKeywords: string[],
  limit: number = 3,
): TaskHistoryEntry[] {
  const history = readHistory(steerDir);
  if (history.length === 0) return [];

  const scored = history.map((entry) => {
    let score = 0;
    // Same mode: weight 2
    if (entry.mode === mode) score += 2;
    // Same files: weight 5 per match
    for (const f of files) {
      if (entry.filesChanged.some((ef) => ef.includes(f) || f.includes(ef))) {
        score += 5;
      }
    }
    // Goal keyword matches (check against taskId as proxy — full goal not stored in v1)
    for (const kw of goalKeywords) {
      if (entry.taskId.toLowerCase().includes(kw.toLowerCase())) {
        score += 1;
      }
    }
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

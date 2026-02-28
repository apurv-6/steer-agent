import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { Mode, SimilarTask } from "./types.js";

interface HistoryEntry {
  taskId: string;
  mode: Mode;
  goal?: string;
  files?: string[];
  modules?: string[];
  resolution?: string;
  learnings?: string[];
}

/**
 * Find similar past tasks from history.jsonl.
 * Scoring weights: same files (5x), same module (3x), same mode (2x), keyword overlap (1x).
 * Returns top 3 matches.
 */
export function findSimilarTasks(
  mode: Mode,
  files: string[],
  goal: string,
  cwd: string,
): SimilarTask[] {
  const historyPath = join(cwd, ".steer", "state", "history.jsonl");
  if (!existsSync(historyPath)) return [];

  const raw = readFileSync(historyPath, "utf-8").trim();
  if (!raw) return [];

  const entries: HistoryEntry[] = raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as HistoryEntry[];

  if (entries.length === 0) return [];

  const goalWords = extractKeywords(goal);
  const fileSet = new Set(files);

  const scored = entries.map((entry) => {
    let score = 0;

    // Same mode: 2x
    if (entry.mode === mode) score += 2;

    // Same files: 5x per matching file
    const entryFiles = new Set(entry.files ?? []);
    for (const f of fileSet) {
      if (entryFiles.has(f)) score += 5;
    }

    // Same module (derived from file paths): 3x
    const entryModules = new Set(entry.modules ?? []);
    const taskModules = deriveModules(files);
    for (const m of taskModules) {
      if (entryModules.has(m)) score += 3;
    }

    // Keyword overlap: 1x per matching keyword
    const entryWords = extractKeywords(entry.goal ?? "");
    for (const w of goalWords) {
      if (entryWords.has(w)) score += 1;
    }

    return {
      taskId: entry.taskId,
      mode: entry.mode,
      goal: entry.goal ?? "",
      files: entry.files ?? [],
      score,
      resolution: entry.resolution,
      learnings: entry.learnings,
    } as SimilarTask;
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function extractKeywords(text: string): Set<string> {
  const stopWords = new Set(["the", "a", "an", "is", "in", "to", "for", "of", "and", "or", "on", "it", "be", "as", "at", "by", "this", "that", "with", "from", "not"]);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w)),
  );
}

function deriveModules(files: string[]): Set<string> {
  const modules = new Set<string>();
  for (const f of files) {
    // Extract top-level directory as module name
    const parts = f.replace(/^\.?\//, "").split("/");
    if (parts.length > 1) {
      modules.add(parts[0]);
      if (parts.length > 2) modules.add(`${parts[0]}/${parts[1]}`);
    }
  }
  return modules;
}

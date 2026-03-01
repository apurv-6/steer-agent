import { TaskState } from "./state.js";
import path from "path";

export interface SubAgentDecision {
  shouldSplit: boolean;
  reason: string;
  agents: SubAgentAssignment[];
}

export interface SubAgentAssignment {
  id: string;
  files: string[];
  description: string;
}

/**
 * Deterministic decision: should we spawn sub-agents for this task?
 * Rules:
 * - At least 4 files across 2+ independent file groups → parallel agents
 * - File isolation enforcement: each agent gets non-overlapping file set
 * - Groups are defined by directory (files in same dir = same group)
 */
export function shouldSpawnSubAgents(task: TaskState): SubAgentDecision {
  const files = task.files;

  if (files.length < 4) {
    return { shouldSplit: false, reason: "Too few files for parallelization", agents: [] };
  }

  // Group files by top-level directory
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const dir = path.dirname(file).split(path.sep)[0] || "_root";
    const arr = groups.get(dir) || [];
    arr.push(file);
    groups.set(dir, arr);
  }

  if (groups.size < 2) {
    return { shouldSplit: false, reason: "All files in same directory — no parallelization benefit", agents: [] };
  }

  // Create assignments: one per group
  const agents: SubAgentAssignment[] = [];
  let idx = 0;
  for (const [dir, groupFiles] of groups) {
    agents.push({
      id: `agent-${idx++}`,
      files: groupFiles,
      description: `Handle files in ${dir}/ (${groupFiles.length} files)`,
    });
  }

  return {
    shouldSplit: true,
    reason: `${agents.length} independent file groups detected across ${groups.size} directories`,
    agents,
  };
}

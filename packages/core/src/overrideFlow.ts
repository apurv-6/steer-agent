import { TaskState } from "./state.js";

export interface OverrideResult {
  task: TaskState;
  logged: boolean;
}

/**
 * Apply an override to a blocked task.
 * Records the override reason in the task state for learning extraction.
 */
export function requestOverride(task: TaskState, reason: string): TaskState {
  return {
    ...task,
    overrideUsed: true,
    learningNotes: [
      ...task.learningNotes,
      {
        id: `${task.taskId}-override-${Date.now()}`,
        taskId: task.taskId,
        module: "_global",
        category: "gotcha",
        summary: `Override used: ${reason}`,
        detail: `Task was blocked/low-score but developer overrode with reason: ${reason}`,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

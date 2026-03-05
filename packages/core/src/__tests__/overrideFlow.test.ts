import { describe, it, expect } from "vitest";
import { requestOverride } from "../overrideFlow.js";
import { createNewTask } from "../state.js";

describe("overrideFlow", () => {
  it("marks override as used", () => {
    const task = createNewTask("t1", "bugfix");
    const result = requestOverride(task, "Urgent fix needed");
    expect(result.overrideUsed).toBe(true);
  });

  it("adds learning note about override", () => {
    const task = createNewTask("t1", "bugfix");
    const result = requestOverride(task, "Urgent fix needed");
    expect(result.learningNotes.length).toBe(1);
    expect(result.learningNotes[0].category).toBe("gotcha");
    expect(result.learningNotes[0].summary).toContain("Override used");
  });

  it("preserves existing learning notes", () => {
    const task = createNewTask("t1", "bugfix");
    task.learningNotes = [{
      id: "existing", taskId: "t1", module: "auth", category: "pattern",
      summary: "Existing note", createdAt: new Date().toISOString(),
    }];

    const result = requestOverride(task, "Reason");
    expect(result.learningNotes.length).toBe(2);
  });
});

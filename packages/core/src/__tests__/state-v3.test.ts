import { describe, it, expect } from "vitest";
import { createNewTask, transitionStep, INITIAL_STATE } from "../state.js";

describe("state v3 - learning step", () => {
  it("INITIAL_STATE includes learning step", () => {
    expect(INITIAL_STATE.steps).toHaveProperty("learning");
    expect(INITIAL_STATE.steps.learning.status).toBe("pending");
  });

  it("INITIAL_STATE has V3 fields", () => {
    expect(INITIAL_STATE.hookResults).toEqual([]);
    expect(INITIAL_STATE.planSteps).toEqual([]);
    expect(INITIAL_STATE.learningNotes).toEqual([]);
  });

  it("createNewTask includes V3 fields", () => {
    const task = createNewTask("test-1", "bugfix");
    expect(task.hookResults).toEqual([]);
    expect(task.planSteps).toEqual([]);
    expect(task.learningNotes).toEqual([]);
  });

  it("transitions through learning step", () => {
    let state = createNewTask("test-1", "bugfix");

    // Transition through to verification
    state = transitionStep(state, "prompt");
    state = transitionStep(state, "planning");
    state = transitionStep(state, "execution");
    state = transitionStep(state, "reflection");
    state = transitionStep(state, "verification");

    // Now transition to learning
    state = transitionStep(state, "learning");
    expect(state.currentStep).toBe("learning");
    expect(state.steps.learning.status).toBe("active");
    expect(state.steps.verification.status).toBe("done");

    // Then to done
    state = transitionStep(state, "done");
    expect(state.currentStep).toBe("done");
    expect(state.steps.learning.status).toBe("done");
  });

  it("step order includes learning between verification and done", () => {
    let state = createNewTask("test-1", "bugfix");
    state = transitionStep(state, "learning");
    // learning is at index 7 (0-indexed: idle=0, context=1, ..., verification=6, learning=7, done=8)
    expect(state.stepNumber).toBe(7);

    state = transitionStep(state, "done");
    expect(state.stepNumber).toBe(8);
  });
});

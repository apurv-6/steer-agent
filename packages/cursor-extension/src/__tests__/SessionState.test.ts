import { describe, it, expect, vi } from "vitest";
import { SessionState } from "../SessionState.js";
import type { Memento } from "vscode";

function makeMockMemento(initial: Record<string, unknown> = {}): Memento {
  const store: Record<string, unknown> = { ...initial };
  return {
    get: <T>(key: string, defaultValue?: T): T => {
      return (key in store ? store[key] : defaultValue) as T;
    },
    update: (key: string, value: unknown) => {
      store[key] = value;
      return Promise.resolve();
    },
    keys: () => Object.keys(store),
  };
}

describe("SessionState", () => {
  it("initialises with DEFAULT_STATE when no stored state", () => {
    const state = new SessionState();
    expect(state.data.steerEnabled).toBe(false);
    expect(state.data.mode).toBe("dev");
    expect(state.data.gateCallCount).toBe(0);
    expect(state.data.scoreTrend).toEqual([]);
  });

  it("restores persisted state from memento", () => {
    const memento = makeMockMemento({
      "steeragent.sessionState": {
        steerEnabled: true,
        mode: "bugfix",
        gateCallCount: 5,
        turnId: 3,
        taskId: "task_abc",
        lastScore: 8,
        scoreTrend: [6, 7, 8],
        lastStatus: "READY",
        blockThreshold: 3,
        lastModelTier: "opus",
        lastPatchedPrompt: "improved prompt",
      },
    });
    const state = new SessionState(memento);
    expect(state.data.steerEnabled).toBe(true);
    expect(state.data.mode).toBe("bugfix");
    expect(state.data.gateCallCount).toBe(5);
    expect(state.data.taskId).toBe("task_abc");
  });

  it("update() merges partial state", () => {
    const state = new SessionState();
    state.update({ steerEnabled: true, mode: "refactor" });
    expect(state.data.steerEnabled).toBe(true);
    expect(state.data.mode).toBe("refactor");
    expect(state.data.gateCallCount).toBe(0); // unchanged
  });

  it("update() auto-tracks scoreTrend when lastScore is provided", () => {
    const state = new SessionState();
    state.update({ lastScore: 5 });
    state.update({ lastScore: 7 });
    state.update({ lastScore: 9 });
    expect(state.data.scoreTrend).toEqual([5, 7, 9]);
  });

  it("scoreTrend is capped at 10 entries", () => {
    const state = new SessionState();
    for (let i = 1; i <= 15; i++) {
      state.update({ lastScore: i });
    }
    expect(state.data.scoreTrend.length).toBe(10);
    expect(state.data.scoreTrend[0]).toBe(6); // oldest kept
    expect(state.data.scoreTrend[9]).toBe(15);
  });

  it("update() does NOT add null lastScore to scoreTrend", () => {
    const state = new SessionState();
    state.update({ lastScore: 7 });
    state.update({ lastScore: null });
    expect(state.data.scoreTrend).toEqual([7]);
  });

  it("fires onDidChange event when update() is called", () => {
    const state = new SessionState();
    const listener = vi.fn();
    state.onDidChange(listener);
    state.update({ steerEnabled: true });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].steerEnabled).toBe(true);
  });

  it("reset() restores DEFAULT_STATE and fires onDidChange", () => {
    const state = new SessionState();
    state.update({ steerEnabled: true, gateCallCount: 10 });
    const listener = vi.fn();
    state.onDidChange(listener);
    state.reset();
    expect(state.data.steerEnabled).toBe(false);
    expect(state.data.gateCallCount).toBe(0);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("persists state to memento on update()", () => {
    const memento = makeMockMemento();
    const updateSpy = vi.spyOn(memento, "update");
    const state = new SessionState(memento);
    state.update({ steerEnabled: true });
    expect(updateSpy).toHaveBeenCalledWith("steeragent.sessionState", expect.objectContaining({ steerEnabled: true }));
  });

  it("dispose() cleans up event emitter", () => {
    const state = new SessionState();
    const listener = vi.fn();
    state.onDidChange(listener);
    state.dispose();
    state.update({ steerEnabled: true }); // should not throw after dispose
  });

  it("data getter returns a readonly snapshot", () => {
    const state = new SessionState();
    const data = state.data;
    expect(data).toMatchObject({
      steerEnabled: false,
      mode: "dev",
      gateCallCount: 0,
    });
  });

  it("update() without lastScore does not append to scoreTrend", () => {
    const state = new SessionState();
    state.update({ lastScore: 6 });
    state.update({ mode: "debug" }); // no lastScore
    expect(state.data.scoreTrend).toEqual([6]);
  });
});

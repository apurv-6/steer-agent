import { describe, it, expect, beforeEach } from "vitest";
import { tmpdir } from "os";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { createNewTask, transitionStep } from "../state.js";
import { assemblePrompt } from "../promptAssembler.js";
import { buildPlan } from "../planBuilder.js";
import { shouldSpawnSubAgents } from "../subagent.js";
import { routeModel } from "../routeModel.js";
import { runReflection } from "../reflection.js";
import { runVerification } from "../verifier.js";
import { extractLearnings, persistLearnings, updateKnowledgeFile, completeTask } from "../learner.js";
import { generateCommitMessage } from "../commit-gen.js";
import { generatePRDescription } from "../pr-gen.js";
import { loadHooks } from "../hookRunner.js";
import { findSimilarTasks } from "../similarTasks.js";
import { loadModuleKnowledge } from "../knowledgeLoader.js";
import type { TaskState } from "../state.js";
import type { AssemblyContext } from "../promptAssembler.js";

/**
 * Integration test that exercises the same logic as steer.run orchestrator.
 * Tests both Phase 1 (plan) and Phase 2 (execute) against a real .steer/ directory.
 */
describe("steer.run orchestrator integration", () => {
  let cwd: string;
  let statePath: string;

  beforeEach(() => {
    cwd = join(tmpdir(), `steer-run-test-${Date.now()}`);
    mkdirSync(join(cwd, ".steer", "state"), { recursive: true });
    mkdirSync(join(cwd, ".steer", "knowledge"), { recursive: true });
    statePath = join(cwd, ".steer", "state", "current-task.json");
  });

  it("Phase 1: context → prompt → planning with all enrichments", () => {
    // Setup: create a task at context step (what steer.start does)
    let state = createNewTask("run-test-1", "bugfix");
    state.files = ["src/auth.ts", "src/utils.ts"];
    state.goal = "Fix authentication timeout";
    writeFileSync(statePath, JSON.stringify(state, null, 2));

    // Phase 1: plan
    // Step 1→2: context → prompt
    state = transitionStep(state, "prompt");
    expect(state.currentStep).toBe("prompt");
    expect(state.steps.context.status).toBe("done");
    expect(state.stepNumber).toBe(2);

    // Assemble prompt
    const similarTasks = findSimilarTasks(state.mode, state.files, state.goal!, cwd);
    const knowledge = loadModuleKnowledge(["src"], cwd);
    const assemblyCtx: AssemblyContext = {
      cwd,
      mode: state.mode,
      answers: {},
      knowledge,
      similarTasks,
      files: state.files,
    };
    const assembledPrompt = assemblePrompt(assemblyCtx);
    state.assembledPrompt = assembledPrompt;
    expect(assembledPrompt).toBeTruthy();
    expect(typeof assembledPrompt).toBe("string");

    // Step 2→3: prompt → planning
    state = transitionStep(state, "planning");
    expect(state.currentStep).toBe("planning");
    expect(state.steps.prompt.status).toBe("done");
    expect(state.stepNumber).toBe(3);

    // Build plan
    const { steps, impact } = buildPlan({ task: state, goal: state.goal!, files: state.files });
    state.planSteps = steps;
    state.impactPreview = impact;
    expect(steps.length).toBeGreaterThan(0);

    // Sub-agent decision
    const subAgentDecision = shouldSpawnSubAgents(state);
    state.subAgentDecision = subAgentDecision;
    expect(subAgentDecision).toBeDefined();
    expect(typeof subAgentDecision.shouldSplit).toBe("boolean");
    expect(typeof subAgentDecision.reason).toBe("string");

    // Model routing
    const routeResult = routeModel({ mode: "bugfix", score: 7 });
    state.modelTier = routeResult.tier;
    state.modelReason = routeResult.reason;
    expect(state.modelTier).toBeDefined();
    expect(["small", "mid", "high"]).toContain(state.modelTier);
    expect(state.modelReason).toBeTruthy();

    // Persist
    writeFileSync(statePath, JSON.stringify(state, null, 2));

    // Verify persisted state has all fields
    const persisted = JSON.parse(readFileSync(statePath, "utf-8"));
    expect(persisted.currentStep).toBe("planning");
    expect(persisted.assembledPrompt).toBeTruthy();
    expect(persisted.subAgentDecision).toBeDefined();
    expect(persisted.modelTier).toBeDefined();
    expect(persisted.modelReason).toBeDefined();
    expect(persisted.planSteps.length).toBeGreaterThan(0);
  });

  it("Phase 2: execution → reflection → verification → learning → done", () => {
    // Setup: task already at planning step with plan
    let state = createNewTask("run-test-2", "feature");
    state.files = ["src/theme.ts"];
    state.goal = "Add dark mode support";
    state.planSteps = [
      { id: 1, description: "Add theme toggle", files: ["src/theme.ts"], action: "modify", risk: "low" },
    ];
    state = transitionStep(state, "prompt");
    state = transitionStep(state, "planning");
    writeFileSync(statePath, JSON.stringify(state, null, 2));

    // Step 3→4: planning → execution
    state = transitionStep(state, "execution");
    expect(state.currentStep).toBe("execution");
    expect(state.steps.planning.status).toBe("done");

    // Step 4→5: execution → reflection
    const hooks = loadHooks(cwd);
    const reflectionResult = runReflection(state, cwd, hooks);
    state.reflectionPassed = reflectionResult.passed;
    expect(typeof reflectionResult.passed).toBe("boolean");

    state = transitionStep(state, "reflection");
    expect(state.currentStep).toBe("reflection");
    expect(state.steps.execution.status).toBe("done");

    // Step 5→6: reflection → verification
    const verificationResult = runVerification(state, hooks, cwd);
    state.verificationOutcome = verificationResult;
    expect(verificationResult).toBeDefined();
    expect(typeof verificationResult.passed).toBe("boolean");

    state = transitionStep(state, "verification");
    expect(state.currentStep).toBe("verification");
    expect(state.steps.reflection.status).toBe("done");

    // Step 6→7: verification → learning
    const learnings = extractLearnings(state);
    persistLearnings(learnings, cwd);
    state.learningNotes = learnings;

    if (learnings.length > 0) {
      const byModule = new Map<string, typeof learnings>();
      for (const l of learnings) {
        const arr = byModule.get(l.module) || [];
        arr.push(l);
        byModule.set(l.module, arr);
      }
      for (const [module, entries] of byModule) {
        updateKnowledgeFile(module, entries, cwd);
      }
    }

    state = transitionStep(state, "learning");
    expect(state.currentStep).toBe("learning");
    expect(state.steps.verification.status).toBe("done");

    // Step 7→8: learning → done
    completeTask(state, cwd);

    const commitMsg = generateCommitMessage(state);
    const prDescription = generatePRDescription(state);
    expect(commitMsg).toMatch(/^feat/);
    expect(prDescription).toContain("## What");

    state = transitionStep(state, "done");
    state.resumable = false;
    writeFileSync(statePath, JSON.stringify(state, null, 2));

    // Verify final state
    expect(state.currentStep).toBe("done");
    expect(state.stepNumber).toBe(8);
    expect(state.steps.learning.status).toBe("done");
    expect(state.steps.done.status).toBe("active");
    expect(state.resumable).toBe(false);

    // Verify history was written
    const historyPath = join(cwd, ".steer", "state", "history.jsonl");
    expect(existsSync(historyPath)).toBe(true);
    const historyContent = readFileSync(historyPath, "utf-8").trim();
    const historyRecord = JSON.parse(historyContent);
    expect(historyRecord.taskId).toBe("run-test-2");
    expect(historyRecord.goal).toBe("Add dark mode support");
  });

  it("full end-to-end: all 9 steps visited in sequence", () => {
    let state = createNewTask("run-e2e-1", "refactor");
    state.files = ["src/old.ts"];
    state.goal = "Simplify module structure";

    // Track every step visited
    const stepsVisited: string[] = ["context"]; // starts at context

    // context → prompt
    state = transitionStep(state, "prompt");
    stepsVisited.push("prompt");

    // prompt → planning
    state.assembledPrompt = "test prompt";
    state.planSteps = [{ id: 1, description: "Refactor old.ts", files: ["src/old.ts"], action: "modify", risk: "low" }];
    state = transitionStep(state, "planning");
    stepsVisited.push("planning");

    // planning → execution
    state = transitionStep(state, "execution");
    stepsVisited.push("execution");

    // execution → reflection
    state.reflectionPassed = true;
    state = transitionStep(state, "reflection");
    stepsVisited.push("reflection");

    // reflection → verification
    state.verificationOutcome = { passed: true, checks: [{ name: "lint", passed: true }], summary: "OK" };
    state = transitionStep(state, "verification");
    stepsVisited.push("verification");

    // verification → learning
    state.learningNotes = [];
    state = transitionStep(state, "learning");
    stepsVisited.push("learning");

    // learning → done
    state = transitionStep(state, "done");
    stepsVisited.push("done");

    expect(stepsVisited).toEqual([
      "context", "prompt", "planning", "execution",
      "reflection", "verification", "learning", "done",
    ]);
    expect(state.currentStep).toBe("done");
    expect(state.stepNumber).toBe(8);

    // All intermediate steps should be "done"
    for (const step of ["context", "prompt", "planning", "execution", "reflection", "verification", "learning"] as const) {
      expect(state.steps[step].status).toBe("done");
    }
  });

  it("model routing is stored and persisted in state", () => {
    let state = createNewTask("route-test-1", "design");
    state.score = 8;

    const result = routeModel({ mode: "design", score: 8 });
    state.modelTier = result.tier;
    state.modelReason = result.reason;

    // Design mode with high score should route to high tier
    expect(state.modelTier).toBe("high");
    expect(state.modelReason).toContain("design");

    writeFileSync(statePath, JSON.stringify(state, null, 2));
    const persisted = JSON.parse(readFileSync(statePath, "utf-8"));
    expect(persisted.modelTier).toBe("high");
    expect(persisted.modelReason).toBeTruthy();
  });

  it("subAgentDecision is stored in state", () => {
    let state = createNewTask("subagent-test-1", "feature");
    state.files = [
      "src/auth/login.ts",
      "src/auth/token.ts",
      "lib/utils/helper.ts",
      "lib/utils/format.ts",
    ];

    const decision = shouldSpawnSubAgents(state);
    state.subAgentDecision = decision;

    expect(decision.shouldSplit).toBe(true);
    expect(decision.agents.length).toBeGreaterThanOrEqual(2);

    writeFileSync(statePath, JSON.stringify(state, null, 2));
    const persisted = JSON.parse(readFileSync(statePath, "utf-8"));
    expect(persisted.subAgentDecision.shouldSplit).toBe(true);
    expect(persisted.subAgentDecision.agents.length).toBeGreaterThanOrEqual(2);
  });
});

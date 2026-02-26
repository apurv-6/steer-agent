// Types
export type * from "./types.js";
export { VALID_TRANSITIONS, STEP_ORDER, stepNumber } from "./types.js";

// Codebase mapping
export { buildCodebaseMap, saveCodebaseMap, loadCodebaseMap, scanFileTree, detectModules, parseImports, matchTestFiles, analyzeChangeCoupling, analyzeOwnership } from "./codebaseMap.js";

// Impact calculator
export { calculateImpact, findDownstream, findRelatedTests, computeRisk } from "./impactCalculator.js";

// Template loader
export { loadTemplate, generateTemplateQuestions, renderPrompt } from "./templateLoader.js";

// Hook engine
export { loadHooks, runHooks, parseHooksYaml, HookBlockError } from "./hookEngine.js";
export type { HookContext } from "./hookEngine.js";

// Workflow engine
export {
  createTask,
  gatherContext,
  buildPromptStep,
  createPlan,
  approvePlan,
  completeExecution,
  verify,
  suspendTask,
  resumeTask,
  getStatus,
} from "./workflowEngine.js";

// Config & state (re-export from fs/)
export { loadConfig, loadRules } from "../fs/configLoader.js";
export { readCurrentTask, writeCurrentTask, clearCurrentTask, appendHistory, readHistory, findSimilarTasks } from "../fs/taskState.js";

// Default templates & config
export { DEFAULT_TEMPLATES, DEFAULT_RULES, DEFAULT_HOOKS_YAML, DEFAULT_CONFIG } from "./defaultTemplates.js";

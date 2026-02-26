// ── Workflow Steps ──────────────────────────────────────────────────
export type WorkflowStep =
  | "IDLE"
  | "CONTEXT"
  | "PROMPT"
  | "PLANNING"
  | "EXECUTION"
  | "VERIFICATION"
  | "DONE"
  | "SUSPENDED";

export type StepStatus = "pending" | "active" | "done" | "failed" | "skipped";

export interface StepInfo {
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  duration?: string; // e.g. "0:45"
}

// ── Valid step transitions ─────────────────────────────────────────
export const VALID_TRANSITIONS: Record<WorkflowStep, WorkflowStep[]> = {
  IDLE: ["CONTEXT"],
  CONTEXT: ["PROMPT", "SUSPENDED"],
  PROMPT: ["PLANNING", "SUSPENDED"],
  PLANNING: ["EXECUTION", "SUSPENDED"],
  EXECUTION: ["VERIFICATION", "SUSPENDED"],
  VERIFICATION: ["DONE", "CONTEXT"], // CONTEXT = new round
  DONE: ["IDLE"], // start fresh
  SUSPENDED: ["CONTEXT", "PROMPT", "PLANNING", "EXECUTION", "VERIFICATION"],
};

// ── Step numbering ─────────────────────────────────────────────────
export const STEP_ORDER: WorkflowStep[] = [
  "CONTEXT",
  "PROMPT",
  "PLANNING",
  "EXECUTION",
  "VERIFICATION",
];

export function stepNumber(step: WorkflowStep): number {
  const idx = STEP_ORDER.indexOf(step);
  return idx >= 0 ? idx + 1 : 0;
}

// ── Task State (current-task.json) ─────────────────────────────────
export interface CurrentTaskState {
  taskId: string;
  mode: string; // GateMode
  round: number;
  startedAt: string;
  currentStep: WorkflowStep;
  stepNumber: number;

  steps: Record<string, StepInfo>;

  // Model
  modelTier?: string;
  modelReason?: string;

  // Sources
  sourcesUsed: string[];

  // Files
  files: string[];

  // Impact
  impactPreview?: ImpactPreview;

  // Score
  score?: number;
  overrideUsed: boolean;

  // Resume
  resumable: boolean;
  suspendedStep?: WorkflowStep;

  // Context gathered during workflow
  context: TaskContext;

  // Plan (approved)
  approvedPlan?: string[];
  completedPlanSteps?: string[];

  // Assembled prompt
  assembledPrompt?: string;
}

export interface TaskContext {
  goal?: string;
  jiraTicket?: string;
  jiraContext?: Record<string, unknown>;
  figmaLink?: string;
  slackThread?: string;
  sentryContext?: Record<string, unknown>;
  gitContext?: GitContextInfo;
  affectedFiles?: string[];
  reproSteps?: string;
  acceptanceCriteria?: string;
  userStory?: string;
  constraints?: string;
  deliverable?: string;
  rulesContent?: string;
  codemapExcerpt?: string;
  similarTasks?: SimilarTask[];
  answers?: Record<string, string>;
}

export interface GitContextInfo {
  recentCommits?: Array<{ hash: string; message: string; author: string; date: string }>;
  lastModifiedBy?: string;
  lastModified?: string;
  blame?: Record<string, string>; // file → primary author
}

export interface SimilarTask {
  taskId: string;
  mode: string;
  goal?: string;
  rounds: number;
  totalTime: string;
  modelTier?: string;
  resolution?: string;
}

// ── Task History (history.jsonl entries) ────────────────────────────
export interface TaskHistoryEntry {
  taskId: string;
  mode: string;
  rounds: number;
  totalTime: string;
  timePerStep: Record<string, string>;
  modelUsed?: string;
  modelReason?: string;
  sourcesUsed: string[];
  filesChanged: string[];
  score?: number;
  completedFirstRound: boolean;
  overrideUsed: boolean;
  impactRisk?: string;
  resumed: boolean;
  completedAt: string;
}

// ── Template Spec ──────────────────────────────────────────────────
export interface TemplateSpec {
  mode: string;
  required_fields: string[];
  optional_fields: string[];
  model_bias: string; // "low" | "mid" | "high"
  plan_required: boolean;
  verification_required: boolean;
  reflection_enabled: boolean;
  auto_fetch: string[];

  // Follow-up questions keyed by field name
  followUpQuestions: Record<string, string>;

  // Codebase-aware question hints (examples, not static)
  codemapQuestionHints?: string[];

  // Prompt template body (markdown with {placeholders})
  promptTemplate: string;
}

// ── Codebase Map ───────────────────────────────────────────────────
export interface CodebaseMap {
  root: string;
  language?: string;
  buildSystem?: string;
  architecture?: string;
  scannedAt: string;

  modules: Record<string, ModuleInfo>;
  dependencies: Record<string, FileDependency>;
  patterns?: Record<string, string>;
  conventions?: Record<string, unknown>;
  changeCoupling?: Record<string, Record<string, number>>;
  ownership?: Record<string, string>; // file → primary author
}

export interface ModuleInfo {
  type: string; // "feature-module" | "shared-module" | "test-module"
  critical: boolean;
  files: Record<string, FileInfo>;
  testDir?: string;
  testFiles?: Record<string, { covers: string }>;
}

export interface FileInfo {
  role: string; // "controller" | "service" | "repository" | "test" | "config" | "doc"
  loc: number;
  language?: string;
}

export interface FileDependency {
  imports: string[];
  exports: string[];
  calledBy: string[];
  testedBy?: string;
}

// ── Hook Definitions ───────────────────────────────────────────────
export type HookTrigger =
  | "pre-context" | "post-context"
  | "pre-plan" | "post-plan"
  | "pre-execute" | "post-execute"
  | "pre-verify" | "post-verify"
  | "post-commit" | "post-pr";

export type HookOnFail = "block" | "warn" | "skip";

export interface HookDefinition {
  trigger: HookTrigger;
  check?: string;
  run?: string;
  on_fail: HookOnFail;
  message: string;
  files?: string[]; // for file-specific checks like critical_file_guard
}

export interface HookResult {
  trigger: HookTrigger;
  check?: string;
  run?: string;
  result: "pass" | "fail" | "skip";
  message: string;
}

// ── Impact Preview ─────────────────────────────────────────────────
export interface ImpactPreview {
  filesModified: string[];
  downstream: string[];
  testsToRun: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  changeCoupling?: Array<{ file: string; coupling: number; inScope: boolean }>;
  openPRConflicts?: string[];
}

// ── Steer Config (.steer/config.json) ──────────────────────────────
export interface SteerConfig {
  version: string;
  team?: string;

  integrations?: {
    jira?: { projectKey?: string; baseUrl?: string; autoFetch?: boolean };
    figma?: { teamUrl?: string; autoFetch?: boolean };
    slack?: { devChannel?: string; autoFetch?: boolean };
    github?: { repo?: string; autoFetch?: boolean };
    sentry?: { projectSlug?: string; autoFetch?: boolean };
  };

  defaults?: {
    branch?: string;
    criticalModules?: string[];
    testCommand?: string;
    lintCommand?: string;
  };

  modelPolicy?: {
    default?: string;
    criticalModules?: string;
    designMode?: string;
    locThreshold?: number;
    fileCountThreshold?: number;
  };

  codemap?: {
    refreshOn?: string;
    strategy?: string;
    languages?: string[];
    excludePaths?: string[];
  };
}

// ── MCP Tool Response ──────────────────────────────────────────────
export interface WorkflowToolResponse {
  step: WorkflowStep;
  stepNumber: number;
  status: string;
  message: string;
  questions?: Array<{
    id: string;
    question: string;
    type: "text" | "mcq";
    options?: string[];
    required: boolean;
    context?: string;
  }>;
  actions?: string[];
  impactPreview?: ImpactPreview;
  similarTasks?: SimilarTask[];
  hookResults?: HookResult[];
  stateUpdated: boolean;
}

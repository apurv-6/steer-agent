// ── Modes ────────────────────────────────────────────────────────────
export type Mode = "chat" | "code" | "review" | "plan" | "design" | "bugfix" | "debug" | "feature" | "refactor";
export type GateMode = "dev" | "debug" | "bugfix" | "design" | "refactor" | "feature";

export const MODE_MAP: Record<GateMode, Mode> = {
  dev: "code",
  debug: "debug",
  bugfix: "bugfix",
  design: "design",
  refactor: "refactor",
  feature: "feature",
};

// ── Score ────────────────────────────────────────────────────────────
export interface ScoreResult {
  score: number;        // 0-10
  missing: string[];    // missing section names
  vagueFlags: string[]; // vague verb occurrences
  fileRefs: string[];   // @filename references found
}

// ── Follow-ups ───────────────────────────────────────────────────────
export interface FollowUp {
  question: string;
  type: "open" | "mcq";
  options?: string[];
}

// ── Routing ──────────────────────────────────────────────────────────
export interface RouteInput {
  mode: Mode;
  score: number;
  gitImpact?: GitImpact;
}

export interface RouteResult {
  tier: "small" | "mid" | "high";
  modelName: string;
  provider: string;
  reason: string;
  explanations: string[];
  estimatedCostUsd: number; // rough $ estimate for the prompt
}

// ── Git Impact ───────────────────────────────────────────────────────
export interface GitImpact {
  filesChanged: number;
  insertions: number;
  deletions: number;
  changedFiles: string[];
  criticalFilesHit: string[];  // matched against criticalModules config
  impactLevel: "low" | "medium" | "high";
}

// ── Canonical GateResult (single source of truth) ────────────────────
export type GateStatus = "BLOCKED" | "NEEDS_INFO" | "READY";

export interface GateResult {
  // Session tracking
  taskId: string;
  turnId: number;

  // Gate verdict
  status: GateStatus;
  score: number;
  missing: string[];
  followupQuestions: FollowUp[];

  // Patched output
  patchedPrompt: string | null;

  // Model routing
  modelSuggestion: RouteResult;

  // Cost
  costEstimate: {
    estimatedTokens: number;
    estimatedCostUsd: number;
  };

  // Git context (when available)
  gitImpact: GitImpact | null;

  // UX guidance
  nextAction: "block" | "answer_questions" | "review_and_apply" | "apply";
}

// ── Telemetry ────────────────────────────────────────────────────────
export interface TelemetryEvent {
  timestamp: string;
  event: string;
  [key: string]: unknown;
}

// ── Gate Input ───────────────────────────────────────────────────────
export interface GateInput {
  draftPrompt: string;
  mode: GateMode;
  taskId?: string;
  turnId?: number;
  answers?: Record<string, string>;
  gitDiffStat?: string;       // raw output of `git diff --stat`
  gitDiffNameOnly?: string;   // raw output of `git diff --name-only`
  criticalPaths?: string[];   // from criticalModules.json
}

// ── Codebase Map ─────────────────────────────────────────────────────
export interface FileInfo {
  path: string;
  role: string; // controller, service, repository, etc.
  loc?: number;
  imports?: string[];
  testFile?: string;
  lastModified?: string;
}

export interface ModuleInfo {
  name: string;
  path: string;
  type: string; // feature-module, shared-module, etc.
  critical: boolean;
  files: string[];
  testDir?: string;
}

export interface DependencyGraph {
  [filePath: string]: {
    imports: string[];
    importedBy: string[];
    testFile?: string;
  };
}

export interface ChangeCoupling {
  [filePath: string]: {
    [relatedFile: string]: number; // 0.0 to 1.0 frequency
  };
}

export interface CodebaseMap {
  root: string;
  modules: Record<string, ModuleInfo>;
  files: Record<string, FileInfo>;
  dependencies: DependencyGraph;
  coupling: ChangeCoupling;
}

// ── Hooks ───────────────────────────────────────────────────────────
export interface HookDefinition {
  step: string;           // e.g. "pre-context", "post-execution"
  check?: string;         // shell command that returns 0/1
  run?: string;           // shell command to execute
  on_fail: "block" | "warn" | "skip";
}

export interface HooksConfig {
  hooks: HookDefinition[];
}

export interface HookResult {
  hookStep: string;
  passed: boolean;
  output?: string;
  action: "block" | "warn" | "skip";
}

// ── Knowledge & Learnings ───────────────────────────────────────────
export type LearningCategory = "pattern" | "gotcha" | "convention" | "failed_approach" | "dependency";

export interface LearningEntry {
  id: string;
  taskId: string;
  module: string;
  category: LearningCategory;
  summary: string;
  detail?: string;
  createdAt: string;
}

export interface KnowledgeEntry {
  module: string;
  content: string;        // raw markdown from knowledge/{module}.md
}

// ── Plan & Verification ─────────────────────────────────────────────
export interface PlanStep {
  id: number;
  description: string;
  files: string[];
  action: "modify" | "create" | "delete" | "test";
  risk: "low" | "medium" | "high";
  reason?: string;
}

export interface ImpactPreview {
  filesModified: string[];
  downstreamDeps: string[];
  testsToRun: string[];
  riskLevel: "low" | "medium" | "high";
  summary: string;
}

export interface VerificationResult {
  passed: boolean;
  checks: VerificationCheck[];
  summary: string;
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

// ── Similar Tasks ───────────────────────────────────────────────────
export interface SimilarTask {
  taskId: string;
  mode: Mode;
  goal: string;
  files: string[];
  score: number;          // similarity score
  resolution?: string;
  learnings?: string[];
}

// ── Steer Config (.steer/config.json) ───────────────────────────────
export interface SteerConfig {
  version: string;
  team?: string;
  codemap?: {
    include?: string[];
    exclude?: string[];
    criticalModules?: string[];
  };
  integrations?: Record<string, unknown>;
  scoring?: {
    threshold?: number;
    blockBelow?: number;
  };
  routing?: {
    defaultTier?: "small" | "mid" | "high";
  };
}

// ── Modes ────────────────────────────────────────────────────────────
export type Mode = "chat" | "code" | "review" | "plan" | "design" | "bugfix" | "debug";
export type GateMode = "dev" | "debug" | "bugfix" | "design" | "refactor";

export const MODE_MAP: Record<GateMode, Mode> = {
  dev: "code",
  debug: "debug",
  bugfix: "bugfix",
  design: "design",
  refactor: "code",
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

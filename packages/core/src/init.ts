import fs from "fs-extra";
import path from "path";
import { buildCodebaseMap } from "./codemap-static.js";

const DEFAULT_CONFIG = {
  version: "3.0",
  team: "engineering",
  integrations: {
    jira: { projectKey: "", baseUrl: "", autoFetch: false },
    figma: { teamUrl: "", autoFetch: false },
    slack: { devChannel: "", autoFetch: false },
    github: { repo: "", autoFetch: true },
    sentry: { projectSlug: "", autoFetch: false }
  },
  defaults: {
    branch: "develop",
    criticalModules: [],
    testCommand: "npm test",
    lintCommand: "npm run lint"
  },
  modelPolicy: {
    default: "mid",
    criticalModules: "high",
    designMode: "high",
    locThreshold: 300
  },
  codemap: {
    refreshOn: "steer.start",
    strategy: "incremental",
    fullScanTrigger: "weekly"
  },
  rag: { enabled: true },
  promptCache: { enabled: true }
};

const DEFAULT_RULES = `# Team Rules — SteerAgent

## Code Conventions
- Use TypeScript for all new code
- All new code must have unit tests
- No direct DB schema modifications without migration
- API changes require backward compatibility

## AI Constraints
- Never modify critical modules (auth/, payments/) without explicit approval
- Never expose API keys in code
- Always include error handling
- Max file scope per task: 5 files unless approved
`;

const DEFAULT_HOOKS = `hooks:
  pre-context:
    - check: template_exists
      on_fail: block
      message: "No template found for this mode."

  post-plan:
    - run: "echo 'Plan approved, beginning execution'"
      on_fail: skip

  post-execute:
    - run: "npm run lint"
      on_fail: warn
      message: "Lint warnings found."
`;

const TEMPLATES: Record<string, string> = {
  "bugfix.md": `---
mode: bugfix
required_fields: [goal, affected_files, repro_steps, acceptance_criteria]
optional_fields: [jira_ticket, figma_link, slack_thread]
model_bias: mid
plan_required: true
verification_required: true
reflection_enabled: true
auto_fetch: [jira, sentry, git_context]
---

## Follow-up questions (if fields missing):
- goal: "What exact behavior must change?"
- affected_files: "Which files are involved?"
- repro_steps: "How do you reproduce this?"
- acceptance_criteria: "How will you verify the fix?"
- scope: "Should changes be limited to listed files only?"

## Codebase-aware questions (generated dynamically):
# These are NOT static. They are generated at runtime from codebase-map.json.
# Examples of what the system might ask:
# - "LoginController depends on TokenService. Is the bug there or here?"
# - "This file is called by 3 consumers. Should we check all of them?"
# - "Rahul modified this file 2 days ago. Is this related to that change?"

## Prompt template:
GOAL: {goal}
CONTEXT: {repro_steps}
{jira_context}
{sentry_context}
{git_context}
CODEBASE: {codebase_map_excerpt}
FILES: {affected_files}
DEPENDENCIES: {dependency_chain}
LIMITS:
  - Scope: {scope}
  - {rules_from_RULES.md}
OUTPUT FORMAT: Patch diff + file paths
REVIEW: {acceptance_criteria}
TESTS: {related_tests_from_codemap}
`,
  "feature.md": `---
mode: feature
required_fields: [goal, user_story, affected_modules, acceptance_criteria]
optional_fields: [jira_ticket, figma_link, slack_thread, api_spec]
model_bias: high
plan_required: true
verification_required: true
reflection_enabled: true
auto_fetch: [jira, figma, git_context]
---

## Follow-up questions:
- goal: "What feature are you building?"
- user_story: "As a [user], I want [action], so that [benefit]"
- affected_modules: "Which modules will this touch?"
- acceptance_criteria: "How will you verify the feature works?"
- figma_link: "Is there a Figma design for this? (paste link)"

## Prompt template:
GOAL: {goal}
USER STORY: {user_story}
MODULES: {affected_modules}
DESIGN: {figma_context}
CODEBASE: {codebase_map_excerpt}
EXISTING PATTERNS: {detected_patterns}
LIMITS:
  - {rules_from_RULES.md}
OUTPUT FORMAT: Implementation plan + code + tests
REVIEW: {acceptance_criteria}
TESTS: {related_tests_from_codemap}
`,
  "refactor.md": `---
mode: refactor
required_fields: [goal, target_files, constraints, acceptance_criteria]
optional_fields: [jira_ticket, slack_thread]
model_bias: mid
plan_required: true
verification_required: true
reflection_enabled: true
auto_fetch: [git_context]
---

## Follow-up questions:
- goal: "What are you refactoring and why?"
- target_files: "Which files need refactoring?"
- constraints: "What must NOT change? (APIs, interfaces, behavior)"
- acceptance_criteria: "How will you verify nothing broke?"

## Prompt template:
GOAL: {goal}
FILES: {target_files}
DEPENDENCIES: {dependency_chain}
CONSUMERS: {files_that_import_targets}
PRESERVE: {constraints}
LIMITS:
  - Behavior must remain identical
  - All existing tests must pass
  - Public interfaces unchanged
  - {rules_from_RULES.md}
OUTPUT FORMAT: Refactored code + explanation of changes
REVIEW: {acceptance_criteria}
TESTS: {all_tests_for_affected_files}
`,
  "design.md": `---
mode: design
required_fields: [goal, scope, constraints, deliverable]
optional_fields: [jira_ticket, figma_link, slack_thread, existing_architecture]
model_bias: high
plan_required: true
verification_required: false
reflection_enabled: false
auto_fetch: [jira, figma]
---

## Follow-up questions:
- goal: "What are you designing?"
- scope: "What's in scope and out of scope?"
- constraints: "What technical constraints exist?"
- deliverable: "What format? (doc, diagram, RFC)"

## Prompt template:
GOAL: {goal}
SCOPE: {scope}
CONSTRAINTS: {constraints}
EXISTING ARCHITECTURE: {codebase_map_summary}
CURRENT PATTERNS: {detected_patterns}
LIMITS:
  - {rules_from_RULES.md}
OUTPUT FORMAT: {deliverable}
`,
  "debug.md": `---
mode: debug
required_fields: [symptom, affected_files, expected_behavior, actual_behavior]
optional_fields: [jira_ticket, slack_thread, error_logs, stack_trace]
model_bias: mid
plan_required: false
verification_required: true
reflection_enabled: true
auto_fetch: [sentry, git_context]
---

## Follow-up questions:
- symptom: "What's happening?"
- expected_behavior: "What should happen?"
- actual_behavior: "What actually happens?"
- affected_files: "Where do you think the issue is?"
- error_logs: "Any error messages or stack traces?"

## Prompt template:
SYMPTOM: {symptom}
EXPECTED: {expected_behavior}
ACTUAL: {actual_behavior}
FILES: {affected_files}
CALL CHAIN: {call_chain_from_codemap}
ERRORS: {error_logs}
{sentry_context}
RECENT CHANGES: {git_log_for_affected_files}
LIMITS:
  - Diagnose before fixing
  - Explain root cause
  - {rules_from_RULES.md}
OUTPUT FORMAT: Root cause analysis + fix recommendation
REVIEW: {expected_behavior} is restored
`
};

export interface InitOptions {
  template?: "coinswitch" | "minimal" | "strict";
  team?: string;
  org?: string;
  force?: boolean;
  noTemplates?: boolean;
}

interface Preset {
  criticalModules: string[];
  rules: string;
  modelPolicy: { default: string; criticalModules: string };
}

const PRESETS: Record<string, Preset> = {
  coinswitch: {
    criticalModules: ["auth", "payments", "trading", "crypto", "kyc"],
    rules: `# SteerAgent Rules — CoinSwitch

## R1 — Scope Restriction [BLOCK]
Never modify files outside the task's declared file scope.

## R2 — Critical Module Guard [BLOCK]
auth/, payments/, trading/, crypto/, kyc/ require explicit approval before modification.

## R3 — Test Coverage [WARN]
No function longer than 20 lines without tests.

## R4 — Repository Pattern [BLOCK]
No direct database queries. All data access must go through the repository pattern.

## R5 — PR Size Limit [WARN]
Maximum 300 lines of code per PR. Warning shown at 250 LOC.

## R6 — Lint Before Commit [AUTO]
Automatically run eslint + prettier before every commit.

## R7 — No Direct Redis [BLOCK]
No direct Redis calls. Use CacheService.
`,
    modelPolicy: { default: "mid", criticalModules: "high" },
  },
  minimal: {
    criticalModules: [],
    rules: `# SteerAgent Rules — Minimal

## R1 — Scope Restriction [BLOCK]
Never modify files outside the task's declared file scope.

## R2 — Test Coverage [WARN]
New code should have tests where practical.
`,
    modelPolicy: { default: "mid", criticalModules: "high" },
  },
  strict: {
    criticalModules: [],
    rules: `# SteerAgent Rules — Strict

## R1 — Scope Restriction [BLOCK]
Never modify files outside the task's declared file scope.

## R2 — Test Coverage [BLOCK]
All new functions must have tests. No exceptions.

## R3 — PR Size Limit [BLOCK]
Maximum 200 lines of code per PR.

## R4 — No console.log [BLOCK]
No console.log statements in production code.

## R5 — Branch Coverage [BLOCK]
100% branch coverage required for changed files.
`,
    modelPolicy: { default: "high", criticalModules: "high" },
  },
};

export async function initSteer(cwd: string, opts: InitOptions = {}) {
  const steerDir = path.join(cwd, ".steer");
  const preset = PRESETS[opts.template ?? "minimal"] ?? PRESETS.minimal;

  // 1. Create directories
  await fs.ensureDir(path.join(steerDir, "templates"));
  await fs.ensureDir(path.join(steerDir, "state"));
  await fs.ensureDir(path.join(steerDir, "knowledge"));
  await fs.ensureDir(path.join(steerDir, "embeddings"));

  // 2. Write config.json (merge preset + user opts)
  const config = {
    ...DEFAULT_CONFIG,
    team: opts.team ?? DEFAULT_CONFIG.team,
    organization: opts.org ?? "default",
    defaults: {
      ...DEFAULT_CONFIG.defaults,
      criticalModules: preset.criticalModules,
    },
    modelPolicy: {
      ...DEFAULT_CONFIG.modelPolicy,
      ...preset.modelPolicy,
    },
  };
  await fs.writeJSON(path.join(steerDir, "config.json"), config, { spaces: 2 });

  // 3. Write RULES.md (preset-specific)
  await fs.writeFile(path.join(steerDir, "RULES.md"), preset.rules);

  // 4. Write hooks.yaml
  await fs.writeFile(path.join(steerDir, "hooks.yaml"), DEFAULT_HOOKS);

  // 5. Write Templates (unless --no-templates)
  if (!opts.noTemplates) {
    for (const [filename, content] of Object.entries(TEMPLATES)) {
      await fs.writeFile(path.join(steerDir, "templates", filename), content);
    }
  }

  // 6. Create knowledge/_global.md
  const globalKnowledgePath = path.join(steerDir, "knowledge", "_global.md");
  if (!await fs.pathExists(globalKnowledgePath)) {
    await fs.writeFile(globalKnowledgePath, "# Global Knowledge\n\nTeam-wide patterns, conventions, and learnings.\n");
  }

  // 7. Create steer.log placeholder
  const logPath = path.join(steerDir, "state", "steer.log");
  if (!await fs.pathExists(logPath)) {
    await fs.writeFile(logPath, `# SteerAgent Log — initialized ${new Date().toISOString()}\n`);
  }

  // 8. Add .steer/state/ to .gitignore
  const gitignorePath = path.join(cwd, ".gitignore");
  const gitignoreEntries = "\n# SteerAgent runtime state\n.steer/state/\n.steer/embeddings/\n";
  if (await fs.pathExists(gitignorePath)) {
    const existing = await fs.readFile(gitignorePath, "utf8");
    if (!existing.includes(".steer/state/")) {
      await fs.appendFile(gitignorePath, gitignoreEntries);
    }
  } else {
    await fs.writeFile(gitignorePath, gitignoreEntries.trimStart());
  }

  // 9. Build Codebase Map
  console.error("Building codebase map...");
  try {
    const map = await buildCodebaseMap(cwd);
    await fs.writeJSON(path.join(steerDir, "codebase-map.json"), map, { spaces: 2 });
  } catch (err) {
    console.error("Failed to build codebase map:", err);
  }

  return { success: true, path: steerDir };
}

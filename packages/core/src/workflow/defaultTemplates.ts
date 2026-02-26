/**
 * Default template contents for steer.init scaffolding.
 * These are written to .steer/templates/ on init.
 */

export const DEFAULT_TEMPLATES: Record<string, string> = {
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

## Follow-up questions
- goal: "What exact behavior must change?"
- affected_files: "Which files are involved?"
- repro_steps: "How do you reproduce this?"
- acceptance_criteria: "How will you verify the fix?"

## Prompt template
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
  - {rules_from_RULES_md}
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

## Follow-up questions
- goal: "What feature are you building?"
- user_story: "As a [user], I want [action], so that [benefit]"
- affected_modules: "Which modules will this touch?"
- acceptance_criteria: "How will you verify the feature works?"

## Prompt template
GOAL: {goal}
USER STORY: {user_story}
MODULES: {affected_modules}
DESIGN: {figma_context}
CODEBASE: {codebase_map_excerpt}
EXISTING PATTERNS: {detected_patterns}
LIMITS:
  - {rules_from_RULES_md}
OUTPUT FORMAT: Implementation plan + code + tests
REVIEW: {acceptance_criteria}
TESTS: {related_tests_from_codemap}
`,

  "refactor.md": `---
mode: refactor
required_fields: [goal, affected_files, constraints, acceptance_criteria]
optional_fields: [jira_ticket, slack_thread]
model_bias: mid
plan_required: true
verification_required: true
reflection_enabled: true
auto_fetch: [git_context]
---

## Follow-up questions
- goal: "What are you refactoring and why?"
- affected_files: "Which files need refactoring?"
- constraints: "What must NOT change? (APIs, interfaces, behavior)"
- acceptance_criteria: "How will you verify nothing broke?"

## Prompt template
GOAL: {goal}
FILES: {affected_files}
DEPENDENCIES: {dependency_chain}
CONSUMERS: {consumers}
PRESERVE: {constraints}
LIMITS:
  - Behavior must remain identical
  - All existing tests must pass
  - Public interfaces unchanged
  - {rules_from_RULES_md}
OUTPUT FORMAT: Refactored code + explanation of changes
REVIEW: {acceptance_criteria}
TESTS: {related_tests_from_codemap}
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

## Follow-up questions
- goal: "What are you designing?"
- scope: "What's in scope and out of scope?"
- constraints: "What technical constraints exist?"
- deliverable: "What format? (doc, diagram, RFC)"

## Prompt template
GOAL: {goal}
SCOPE: {scope}
CONSTRAINTS: {constraints}
EXISTING ARCHITECTURE: {codebase_map_excerpt}
CURRENT PATTERNS: {detected_patterns}
LIMITS:
  - {rules_from_RULES_md}
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

## Follow-up questions
- symptom: "What's happening?"
- expected_behavior: "What should happen?"
- actual_behavior: "What actually happens?"
- affected_files: "Where do you think the issue is?"

## Prompt template
SYMPTOM: {symptom}
EXPECTED: {expected_behavior}
ACTUAL: {actual_behavior}
FILES: {affected_files}
CALL CHAIN: {dependency_chain}
ERRORS: {error_logs}
{sentry_context}
RECENT CHANGES: {git_context}
LIMITS:
  - Diagnose before fixing
  - Explain root cause
  - {rules_from_RULES_md}
OUTPUT FORMAT: Root cause analysis + fix recommendation
REVIEW: {expected_behavior} is restored
`,
};

export const DEFAULT_RULES = `# Team Rules — SteerAgent

## Code Conventions
- All new code must have unit tests
- No direct DB schema modifications without migration
- API changes require backward compatibility

## Architecture
- Follow established patterns in this codebase
- Repository layer for all data access
- No business logic in UI components

## AI Constraints
- Never expose API keys in code
- Always include error handling
- Max file scope per task: 5 files unless approved

## Review Checklist
- Code compiles
- Existing tests pass
- New code has test coverage
- No console.log / print statements in production code
`;

export const DEFAULT_HOOKS_YAML = `hooks:
  pre-context:
    - check: template_exists
      on_fail: warn
      message: "No template found for this mode."

  pre-plan:
    - check: critical_file_guard
      on_fail: warn
      message: "Touching critical module. Requires careful review."

  post-execute:
    - run: "echo 'Execution complete'"
      on_fail: skip
      message: "Post-execute notification."

  pre-verify:
    - run: "echo 'Starting verification'"
      on_fail: skip
      message: "Pre-verify notification."
`;

export const DEFAULT_CONFIG = {
  version: "2.0",
  defaults: {
    branch: "main",
    criticalModules: [] as string[],
    testCommand: "npm test",
    lintCommand: "npm run lint",
  },
  modelPolicy: {
    default: "mid",
    criticalModules: "high",
    designMode: "high",
    locThreshold: 300,
    fileCountThreshold: 3,
  },
  codemap: {
    refreshOn: "steer.start",
    strategy: "incremental",
    excludePaths: ["node_modules/", ".git/", "build/", "dist/"],
  },
};

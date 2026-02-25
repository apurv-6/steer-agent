---
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

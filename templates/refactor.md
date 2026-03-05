---
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

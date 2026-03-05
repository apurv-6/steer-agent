---
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

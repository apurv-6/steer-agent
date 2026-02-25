---
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

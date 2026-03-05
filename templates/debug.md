---
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

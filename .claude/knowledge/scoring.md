# Scoring

## Algorithm
- Rule-based, 0-10 scale, section-presence deductions
- Start at 10, deduct -2 for missing GOAL/LIMITS/REVIEW, -1 for vague verbs or @file without scope
- Status thresholds: BLOCKED (<=3), NEEDS_INFO (4-6), READY (>=7)
- Zero LLM cost — pure TypeScript, < 200ms

## Key Files
- `packages/core/src/scorePrompt.ts` — scoring logic
- `packages/core/src/gate.ts` — orchestration (score → followups → patch → route)
- `packages/core/src/__tests__/scorePrompt.test.ts` — 54 tests

## Future
- Rubric-based 5-dimension scoring deferred until pilot calibration data exists
- Per-criterion breakdown deferred until users ask "why did I score 4?"

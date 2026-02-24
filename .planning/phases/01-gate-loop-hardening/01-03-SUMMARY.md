---
phase: 01-gate-loop-hardening
plan: 03
subsystem: telemetry, docs
tags: [telemetry, jsonl, pilot-docs, coinswitch, metrics]

# Dependency graph
requires:
  - phase: 01-02
    provides: "Hardened extension with session persistence and enriched model routing"
provides:
  - "Telemetry append() with explicit absolute path (no default)"
  - "Extension telemetry to globalStorageUri with enriched JSONL records"
  - "CLI telemetry to cwd-based data/telemetry.jsonl"
  - "SETUP.md for 15-minute CoinSwitch pilot installation"
  - "PILOT.md with metrics, extraction commands, and success criteria"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [explicit telemetry path parameter, best-effort telemetry with try/catch, jq-based metric extraction]

key-files:
  created:
    - docs/PILOT.md
  modified:
    - packages/core/src/telemetry.ts
    - packages/cursor-extension/src/extension.ts
    - packages/cli/src/steer.ts
    - docs/SETUP.md

key-decisions:
  - "Telemetry append() requires explicit path - no default, callers must be intentional"
  - "Extension telemetry uses globalStorageUri (Cursor-managed, per-workspace)"
  - "CLI telemetry uses cwd-based path (data/telemetry.jsonl)"
  - "Telemetry records include all 10 required fields for pilot analysis"
  - "SETUP.md restructured for CoinSwitch pilot (14 devs, 15-min target)"

patterns-established:
  - "Telemetry best-effort: always wrap in try/catch, never crash host process"
  - "Enriched telemetry records: timestamp, taskId, turnId, mode, score, status, missing, modelTier, estimatedCostUsd, hasGitImpact"

requirements-completed: [TELE-01, TELE-02]

# Metrics
duration: 5min
completed: 2026-02-24
---

# Phase 1 Plan 3: Telemetry Fix + Pilot Docs Summary

**Telemetry with explicit paths and enriched JSONL records, plus SETUP.md and PILOT.md for CoinSwitch 14-developer pilot**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-24T17:47:07Z
- **Completed:** 2026-02-24T17:51:52Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Telemetry append() now requires explicit absolute path (no implicit relative default)
- Extension writes enriched telemetry to globalStorageUri with all 10 required fields
- CLI writes enriched telemetry to cwd-based data/telemetry.jsonl
- SETUP.md rewritten as step-by-step 15-minute installation guide for CoinSwitch
- PILOT.md defines all metrics, jq extraction commands, success/failure criteria, and 2-week timeline
- Demo script verified: BLOCKED, NEEDS_INFO, READY all pass correctly
- All 54 tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix telemetry path and enrich records** - `03ab4ab` (feat)
2. **Task 2: Write SETUP.md and PILOT.md** - `267cebc` (feat)

## Files Created/Modified
- `packages/core/src/telemetry.ts` - Removed DEFAULT_PATH, made filePath required parameter, changed event type to Record<string, unknown>
- `packages/cursor-extension/src/extension.ts` - Added telemetryPath from globalStorageUri, appendTelemetry helper, telemetry calls after every gate call
- `packages/cli/src/steer.ts` - Added telemetry import, CLI_TELEMETRY_PATH, telemetry call after gate
- `docs/SETUP.md` - Complete rewrite: 5-step install guide with troubleshooting, CoinSwitch focused
- `docs/PILOT.md` - New: metrics definitions, jq extraction commands, success criteria, red flags table

## Decisions Made
- Telemetry append() requires explicit path (no default) -- forces callers to be intentional about where telemetry goes
- Extension uses globalStorageUri -- Cursor-managed, no manual config needed per developer
- CLI uses process.cwd()-based path -- telemetry stays with the project
- Record type broadened to Record<string, unknown> -- allows both gate telemetry and apply-to-chat events without strict typing
- SETUP.md completely rewritten rather than patched -- cleaner for pilot onboarding

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 complete: MCP hardened, hook verified, extension polished, telemetry wired, docs written
- Ready for CoinSwitch pilot deployment
- Phase 2 scope to be determined by 2 weeks of pilot data

## Self-Check: PASSED

- FOUND: packages/core/src/telemetry.ts
- FOUND: packages/cursor-extension/src/extension.ts
- FOUND: packages/cli/src/steer.ts
- FOUND: docs/SETUP.md
- FOUND: docs/PILOT.md
- FOUND: commit 03ab4ab (Task 1)
- FOUND: commit 267cebc (Task 2)

---
*Phase: 01-gate-loop-hardening*
*Completed: 2026-02-24*

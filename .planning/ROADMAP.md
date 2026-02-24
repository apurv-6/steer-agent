# Roadmap: SteerAgent

## Overview

SteerAgent v1 is built in 4 phases: first harden the core infrastructure (EventBus, SessionStore, hook bridge, MCP reliability) so the 14-dev CoinSwitch pilot has a reliable foundation; then build the command system, scoring upgrade, extension UX, and configuration layer that make the tool feel like one coherent product; then add pilot-feedback-driven features (session metrics, score trends) based on real usage data; finally prepare the architecture for scale (budget guardrails, team analytics, embedded MCP). Each phase delivers a usable increment — Phase 1 alone produces a working gate loop from hook to extension.

## Phases

- [ ] **Phase 1: Core Infrastructure & Pilot Reliability** - EventBus, SessionStore, hook bridge, MCP hardening, canonical gate with transparent scoring
- [ ] **Phase 2: Command System & Scoring Upgrade** - /steer command router, rubric-based scoring, 7-section patches, extension panels with EventBus, project config
- [ ] **Phase 3: Extension UX & Connected Loop** - Full StatusPanel + WizardPanel with real-time EventBus updates, near-intercept Send Patched flow, session metrics
- [ ] **Phase 4: Pilot Feedback & Scale Prep** - Score trend visualization, CLI polish, MCP multi-editor, telemetry extensibility for v2

## Phase Details

### Phase 1: Core Infrastructure & Pilot Reliability
**Goal**: A reliable foundation where the hook fires, the extension reacts in real-time, telemetry writes correctly, and the MCP server stays alive. The CoinSwitch pilot can start.
**Depends on**: Nothing (first phase)
**Requirements**: GATE-01, GATE-03, GATE-06, GATE-07, GATE-08, ROUT-01, ROUT-02, ROUT-03, ROUT-04, GIT-01, GIT-02, GIT-04, SESS-01, SESS-02, SESS-03, ARCH-01, ARCH-02, ARCH-03, ARCH-06, ARCH-07, EXT-05, HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05, MCP-01, MCP-02, MCP-03, MCP-04, TELE-01, TELE-02, TELE-03, CONF-03, REL-01, REL-02, REL-03
**Success Criteria** (what must be TRUE):
  1. `gate()` in core returns GateResult with per-criterion scoring breakdown, and all consumers (MCP, CLI, extension, hook) use it as single source of truth
  2. EventBus emits typed events (gate:result, session:changed) and SessionStore tracks score trend across turns
  3. Hook writes signal file, extension FileSystemWatcher picks it up, panels update within 1 second
  4. MCP server survives uncaught exceptions, signal handling works, smoke test passes all 4 cases
  5. Telemetry writes to correct absolute path in both extension and CLI contexts
  6. Session persists across Cursor restart (taskId, turn history preserved)
**Plans**: 4 plans

Plans:
- [ ] 01-01: Core primitives — EventBus, SessionStore, PersistenceAdapter, constants, typed events
- [ ] 01-02: Canonical gate with transparent scoring — enhance gate() to return per-criterion breakdown, wire EventBus emission
- [ ] 01-03: Hook + bridge — update steer-gate-hook.js to write signal file, build HookBridge with FileSystemWatcher in extension
- [ ] 01-04: MCP hardening + telemetry fix — stdout audit, error handlers, signal handling, telemetry path fix, smoke tests

### Phase 2: Command System & Scoring Upgrade
**Goal**: The /steer command system works, scoring uses 5-dimension rubric instead of section-presence, prompts are patched with 7 sections, and project config drives thresholds and weights.
**Depends on**: Phase 1
**Requirements**: GATE-02, GATE-04, GATE-05, GATE-09, GIT-03, SESS-04, ARCH-04, ARCH-05, CMD-01, CMD-02, CMD-03, CMD-04, CMD-05, CMD-06, CMD-07, CMD-08, CMD-09, CONF-01, CONF-02
**Success Criteria** (what must be TRUE):
  1. `/steer on`, `/steer off`, `/steer mode debug`, `/steer gate`, `/steer status`, `/steer explain`, `/steer metrics`, `/steer threshold 5` all work from Cursor command palette
  2. Scoring uses 5 rubric dimensions (clarity, completeness, constraints, verifiability, efficiency) with per-dimension breakdown visible via `/steer explain`
  3. Patched prompts contain 7 sections (CONTEXT, GOAL, INPUTS, LIMITS, OUTPUT FORMAT, ACTIONS, REVIEW)
  4. `.steer/config.json` in workspace root is loaded and drives score thresholds, section weights, and critical paths
  5. Typed webview message protocol eliminates untyped msg.type switches; CommandRouter consolidates all command registrations
  6. Override audit trail logs reason when BLOCKED is overridden
**Plans**: 4 plans

Plans:
- [ ] 02-01: Command router + schema — CommandRouter class, /steer subcommand dispatch, steer.command.schema.json
- [ ] 02-02: Rubric scoring engine — 5-dimension scorer replacing section-presence, mode-specific scoring profiles, gaming test cases
- [ ] 02-03: 7-section patch template + MCQ follow-ups — enhanced buildPrompt, MCQ-first question generation, context gap detection
- [ ] 02-04: Project config + typed extension protocol — .steer/config.json loader, configurable thresholds/weights, typed webview messages

### Phase 3: Extension UX & Connected Loop
**Goal**: The extension panels are fully connected to EventBus, the near-intercept "Send Patched" flow works, and developers see a cohesive product — not disconnected pieces.
**Depends on**: Phase 2
**Requirements**: EXT-01, EXT-02, EXT-03, EXT-04, EXT-06, EXT-07, CLI-01, CLI-02
**Success Criteria** (what must be TRUE):
  1. StatusPanel shows live score (large, colored), status badge, mode, trend sparkline, gate calls, model tier, block threshold, task ID — all updating in real-time via EventBus
  2. WizardPanel shows MCQ follow-ups with answers, patched prompt diff, model explanation with cost breakdown, action buttons (Send Patched / Apply / Override / Copy)
  3. "Send Patched" opens Cursor chat composer with the patched prompt when direct injection isn't possible
  4. @steer chat participant returns inline gate results with scoring breakdown and model suggestions
  5. Session metrics visible in panel: gate calls, blocked count, overrides, avg score
  6. CLI interactive mode produces clean, copy-friendly output with cost + git impact + explanations
**Plans**: 3 plans

Plans:
- [ ] 03-01: StatusPanel rebuild — EventBus subscription, real-time score/trend/status rendering, session metrics display
- [ ] 03-02: WizardPanel rebuild — MCQ follow-ups, patched prompt diff, model explanation, Send Patched / Copy / Override actions
- [ ] 03-03: Chat participant + CLI polish — @steer inline results, CLI interactive mode with formatted output

### Phase 4: Pilot Feedback & Scale Prep
**Goal**: Features informed by pilot data — score trend visualization, telemetry extensibility — and architecture preparation for v2 (budget guardrails schema, team analytics hooks).
**Depends on**: Phase 3
**Requirements**: EXT-06 (enhanced)
**Success Criteria** (what must be TRUE):
  1. Score trend visualization shows improvement over time (sparkline or mini-chart) in StatusPanel
  2. Telemetry schema is extensible for v2 consumers (team dashboard, cost tracking) without migration
  3. MCP server tested and documented for Claude Desktop, Windsurf, and Cline
  4. All 61 v1 requirements verified complete
**Plans**: 2 plans

Plans:
- [ ] 04-01: Score trends + telemetry extensibility — trend visualization in panel, telemetry schema versioning, extensible event types
- [ ] 04-02: MCP multi-editor + final verification — test configs for Claude Desktop/Windsurf/Cline, full requirement verification pass

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Infrastructure & Pilot Reliability | 0/4 | Not started | - |
| 2. Command System & Scoring Upgrade | 0/4 | Not started | - |
| 3. Extension UX & Connected Loop | 0/3 | Not started | - |
| 4. Pilot Feedback & Scale Prep | 0/2 | Not started | - |

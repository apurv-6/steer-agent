# Requirements: SteerAgent

**Defined:** 2026-02-24
**Core Value:** Every prompt going to an LLM is structured enough to get a useful response on the first try — reducing iteration churn, token waste, and developer frustration.

## v1 Requirements

### Core Gate Engine (GATE)

- [ ] **GATE-01**: Canonical `gate()` function in core accepts `GateInput`, returns `GateResult` — single source of truth for all consumers
- [ ] **GATE-02**: Rubric-based scoring across 5 dimensions: clarity, completeness, constraints, verifiability, efficiency (replaces section-presence-only scoring)
- [ ] **GATE-03**: Transparent scoring breakdown — per-criterion scores exposed in GateResult (e.g., clarity: 2/2, constraints: 0/2)
- [ ] **GATE-04**: 7-section prompt patch template: CONTEXT, GOAL, INPUTS, LIMITS, OUTPUT FORMAT, ACTIONS, REVIEW
- [ ] **GATE-05**: MCQ-first follow-up questions — prefer structured answers (MCQ) over open text; max 3 questions
- [ ] **GATE-06**: `nextAction` field in GateResult: block | answer_questions | review_and_apply | apply
- [ ] **GATE-07**: GateResult includes taskId, turnId, status (BLOCKED/NEEDS_INFO/READY), score, missing, followupQuestions, patchedPrompt, modelSuggestion, costEstimate, gitImpact
- [ ] **GATE-08**: Gate evaluation completes in < 200ms (rule-based, zero LLM calls)
- [ ] **GATE-09**: Expanded modes: dev, debug, bugfix, spec, review, interview (mode-specific scoring profiles)

### Model Routing (ROUT)

- [ ] **ROUT-01**: Explainable model routing — returns provider + model name, not just tier; includes `explanations: string[]` with routing reasoning
- [ ] **ROUT-02**: Git-aware routing — critical files → high tier, high git impact → mid minimum, design+high score → high
- [ ] **ROUT-03**: Cost estimate per prompt — estimatedTokens + estimatedCostUsd in GateResult
- [ ] **ROUT-04**: Model suggestion includes tier (small/mid/high), model name, provider, and cost breakdown

### Git Integration (GIT)

- [ ] **GIT-01**: Parse `git diff --stat` and `git diff --name-only` to derive impact level (low/medium/high)
- [ ] **GIT-02**: Critical module detection — match changed files against configurable critical paths (glob patterns)
- [ ] **GIT-03**: Context gap detection — flag when files in git scope are not mentioned in prompt sections
- [ ] **GIT-04**: GitImpact included in GateResult: filesChanged, linesChanged, impactLevel, criticalFiles, changedFiles

### Session Management (SESS)

- [ ] **SESS-01**: SessionStateV1 — full lifecycle tracking: taskId, turnId, scoreTrend, mode, enabled, lastScore, lastStatus, gateCallCount, blockedCount, overrideCount
- [ ] **SESS-02**: Session continuity across Cursor restarts — persist taskId and turn history; only reset on explicit "New Task"
- [ ] **SESS-03**: Score trend tracking — last 10 scores stored; available for display and telemetry
- [ ] **SESS-04**: Override audit trail — log reason when BLOCKED status is overridden

### Architecture (ARCH)

- [ ] **ARCH-01**: EventBus in core — typed pub/sub (gate:result, gate:error, session:changed, session:reset, telemetry:event, hook:signal)
- [ ] **ARCH-02**: SessionStore in core — in-memory state with pluggable PersistenceAdapter; extension injects vscode.Memento, CLI uses ephemeral
- [ ] **ARCH-03**: Hook-to-Extension bridge — file-based IPC via signal file (~/.steer-agent/last-gate.json) + FileSystemWatcher
- [ ] **ARCH-04**: CommandRouter — single dispatch point for all VS Code command registrations
- [ ] **ARCH-05**: Typed webview message protocol — discriminated union for ToWebviewMessage / FromWebviewMessage
- [ ] **ARCH-06**: gate() emits events on EventBus; telemetry subscribes automatically (no manual logging calls)
- [ ] **ARCH-07**: All shared types exported from core; no duplicated type definitions across packages

### Command System (CMD)

- [ ] **CMD-01**: `/steer` command router with subcommands: on, off, mode, gate, send, status, explain, metrics, reset, threshold
- [ ] **CMD-02**: `/steer on` and `/steer off` enable/disable gating for current session
- [ ] **CMD-03**: `/steer mode <name>` switches active mode (dev, debug, bugfix, spec, review, interview)
- [ ] **CMD-04**: `/steer gate` triggers manual gate evaluation on current prompt
- [ ] **CMD-05**: `/steer status` shows current session state (score, mode, gate calls, model, task)
- [ ] **CMD-06**: `/steer explain` shows detailed scoring breakdown for last gate result
- [ ] **CMD-07**: `/steer metrics` shows session metrics (gate calls, blocked count, overrides, avg score)
- [ ] **CMD-08**: `/steer threshold <n>` sets block threshold for current session
- [ ] **CMD-09**: Command schema defined in steer.command.schema.json

### Cursor Extension (EXT)

- [ ] **EXT-01**: Left panel (StatusPanel) — live session HUD: score (large, colored), status badge, mode, trend visualization, gate calls, model tier, block threshold, task ID, turn
- [ ] **EXT-02**: Right panel (WizardPanel) — follow-ups with MCQ + answers, patched prompt diff view, model explanation with cost, action buttons (Send Patched / Apply / Override / Copy)
- [ ] **EXT-03**: @steer chat participant — inline gate results in Cursor chat
- [ ] **EXT-04**: Panels subscribe to EventBus for real-time updates (no polling, no stale state)
- [ ] **EXT-05**: Graceful error handling — try/catch wrappers, user-facing error notifications, retry buttons
- [ ] **EXT-06**: Session metrics displayed in panel: gate calls, blocked count, overrides, avg score, turns-to-done proxy
- [ ] **EXT-07**: "Send Patched" near-intercept flow — opens chat composer with patched prompt when Cursor API doesn't allow direct injection

### Hook Integration (HOOK)

- [ ] **HOOK-01**: CJS hook script for Cursor `beforeSubmitPrompt` — reads stdin JSON, runs gate(), returns {continue: boolean}
- [ ] **HOOK-02**: Blocking policy: score ≤ 3 → continue:false (BLOCKED); score 4-6 → continue:true + guidance; score ≥ 7 → continue:true
- [ ] **HOOK-03**: Hook writes GateResult to signal file for extension bridge pickup
- [ ] **HOOK-04**: Hook completes within 5-second Cursor timeout (including git operations)
- [ ] **HOOK-05**: Example cursor-hooks.json config shipped with project

### MCP Server (MCP)

- [ ] **MCP-01**: `steer.gate` tool accepts full GateInput parameters via MCP
- [ ] **MCP-02**: Stateless stdio relay to core gate() — no EventBus integration (separate process)
- [ ] **MCP-03**: Stdout audit — no stray console.log corrupting JSON-RPC; global error handlers (uncaughtException, SIGINT, SIGTERM)
- [ ] **MCP-04**: Smoke test script validates all gate statuses (BLOCKED, NEEDS_INFO, READY, git impact)

### CLI (CLI)

- [ ] **CLI-01**: `steer` interactive mode — accepts prompt, runs gate, displays results with cost + git impact + explanations
- [ ] **CLI-02**: Clean copy-friendly output format for pasting patched prompts into any LLM interface

### Telemetry (TELE)

- [ ] **TELE-01**: JSONL append telemetry — every gate call logged with taskId, turnId, mode, score, status, model, cost, gitImpact, timestamp
- [ ] **TELE-02**: Telemetry path uses `context.globalStorageUri` in extension context (not relative path)
- [ ] **TELE-03**: Telemetry subscribes to EventBus automatically (fire-and-forget, no consumer coupling)

### Configuration (CONF)

- [ ] **CONF-01**: Project-scoped configuration via `.steer/config.json` — thresholds, section weights, critical path patterns, mode definitions
- [ ] **CONF-02**: Configurable score thresholds — replace hardcoded BLOCKED/NEEDS_INFO/READY values (e.g., { blocked: 3, needsInfo: 7 })
- [ ] **CONF-03**: criticalModules.json integration — configurable per-project critical file patterns for git impact analysis

### Reliability (REL)

- [ ] **REL-01**: MCP server stays alive on errors — process.on('uncaughtException'), signal handling, process.stdin.resume() keepalive
- [ ] **REL-02**: Extension degrades gracefully when core throws — error notifications, not silent crashes
- [ ] **REL-03**: Validate Cursor chat participant compatibility — if @steer silently fails, MCP is primary integration path with prominent fallback UX

## v2 Requirements

### Budget & Cost

- **COST-01**: Cost-aware budget guardrails — daily/weekly spend caps, per-prompt cost warnings
- **COST-02**: Automatic tier downgrade when budget exceeded
- **COST-03**: Cost tracking per user/team via telemetry

### Team Analytics

- **TEAM-01**: Team prompt patterns dashboard — aggregated scoring trends, common missing sections, cost per developer
- **TEAM-02**: Weekly/monthly reports from telemetry data

### Advanced Features

- **ADV-01**: Prompt template library — 5-10 built-in templates per mode, custom templates in .steer/templates/
- **ADV-02**: Learning mode / prompt coaching — before/after examples, contextual tips
- **ADV-03**: Custom section definitions — teams define THREAT_MODEL, SCHEMA, etc. with custom weights
- **ADV-04**: Score trend visualization — sparkline in StatusPanel, metrics CLI command
- **ADV-05**: MCP multi-editor testing — Claude Desktop, Windsurf, Cline configs
- **ADV-06**: Automatic context injection — AST-based file signature injection into patched prompts

### Infrastructure

- **INFRA-01**: Embedded MCP server via VS Code mcpServerDefinitionProviders (eliminates manual config)
- **INFRA-02**: Telemetry aggregation pipeline for team-level analytics

## Out of Scope

| Feature | Reason |
|---------|--------|
| LLM-based prompt scoring | Adds 500ms-2s latency, cost per call, non-determinism; rule-based is instant, free, debuggable |
| Blocking prompts by default | Developers will disable the tool; default to advisory, opt-in to blocking |
| Full prompt rewriting | Developers lose ownership; patch sections only |
| Real-time scoring as you type | Constant distraction, wastes computation on incomplete thoughts |
| Multi-LLM provider management | Scope creep into API gateway territory; recommend tier, let IDE handle provider |
| Approval workflows | Kills developer velocity; use budget guardrails + post-hoc audit instead |
| Cloud/org-wide analytics | Local only for v1; JSONL + file-based telemetry |
| Code execution or PR automation | Just prompt steering, not code actions |
| Mobile/web app | Cursor-first for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GATE-01 | Phase 1 | Pending |
| GATE-02 | Phase 2 | Pending |
| GATE-03 | Phase 1 | Pending |
| GATE-04 | Phase 2 | Pending |
| GATE-05 | Phase 2 | Pending |
| GATE-06 | Phase 1 | Pending |
| GATE-07 | Phase 1 | Pending |
| GATE-08 | Phase 1 | Pending |
| GATE-09 | Phase 2 | Pending |
| ROUT-01 | Phase 1 | Pending |
| ROUT-02 | Phase 1 | Pending |
| ROUT-03 | Phase 1 | Pending |
| ROUT-04 | Phase 1 | Pending |
| GIT-01 | Phase 1 | Pending |
| GIT-02 | Phase 1 | Pending |
| GIT-03 | Phase 2 | Pending |
| GIT-04 | Phase 1 | Pending |
| SESS-01 | Phase 1 | Pending |
| SESS-02 | Phase 1 | Pending |
| SESS-03 | Phase 1 | Pending |
| SESS-04 | Phase 2 | Pending |
| ARCH-01 | Phase 1 | Pending |
| ARCH-02 | Phase 1 | Pending |
| ARCH-03 | Phase 1 | Pending |
| ARCH-04 | Phase 2 | Pending |
| ARCH-05 | Phase 2 | Pending |
| ARCH-06 | Phase 1 | Pending |
| ARCH-07 | Phase 1 | Pending |
| CMD-01 | Phase 2 | Pending |
| CMD-02 | Phase 2 | Pending |
| CMD-03 | Phase 2 | Pending |
| CMD-04 | Phase 2 | Pending |
| CMD-05 | Phase 2 | Pending |
| CMD-06 | Phase 2 | Pending |
| CMD-07 | Phase 2 | Pending |
| CMD-08 | Phase 2 | Pending |
| CMD-09 | Phase 2 | Pending |
| EXT-01 | Phase 2 | Pending |
| EXT-02 | Phase 2 | Pending |
| EXT-03 | Phase 2 | Pending |
| EXT-04 | Phase 2 | Pending |
| EXT-05 | Phase 1 | Pending |
| EXT-06 | Phase 3 | Pending |
| EXT-07 | Phase 2 | Pending |
| HOOK-01 | Phase 1 | Pending |
| HOOK-02 | Phase 1 | Pending |
| HOOK-03 | Phase 1 | Pending |
| HOOK-04 | Phase 1 | Pending |
| HOOK-05 | Phase 1 | Pending |
| MCP-01 | Phase 1 | Pending |
| MCP-02 | Phase 1 | Pending |
| MCP-03 | Phase 1 | Pending |
| MCP-04 | Phase 1 | Pending |
| CLI-01 | Phase 2 | Pending |
| CLI-02 | Phase 2 | Pending |
| TELE-01 | Phase 1 | Pending |
| TELE-02 | Phase 1 | Pending |
| TELE-03 | Phase 1 | Pending |
| CONF-01 | Phase 2 | Pending |
| CONF-02 | Phase 2 | Pending |
| CONF-03 | Phase 1 | Pending |
| REL-01 | Phase 1 | Pending |
| REL-02 | Phase 1 | Pending |
| REL-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 61 total
- Mapped to phases: 61
- Unmapped: 0

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after initial definition*

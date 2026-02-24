# Requirements: SteerAgent (CTO Cut)

**Defined:** 2026-02-24
**Revised:** 2026-02-24 (CTO review — cut 61 → 15 for Phase 1)
**Core Value:** Every prompt going to an LLM is structured enough to get a useful response on the first try.

## v1 Requirements (Phase 1: Gate Loop Hardening)

### Hook (HOOK)

- [ ] **HOOK-01**: CJS hook script for Cursor beforeSubmitPrompt — reads stdin, runs gate(), returns {continue: boolean}
- [ ] **HOOK-02**: Blocking policy: score <= 3 → continue:false; score 4-6 → true; score >= 7 → true
- [ ] **HOOK-04**: Hook completes within 5-second Cursor timeout
- [ ] **HOOK-05**: Example cursor-hooks.json shipped with project

### MCP Server (MCP)

- [ ] **MCP-03**: Stdout audit — no stray console.log; global error handlers (uncaughtException, SIGINT, SIGTERM)
- [ ] **MCP-04**: Smoke test validates BLOCKED, NEEDS_INFO, READY, and server survival

### Extension (EXT)

- [ ] **EXT-05**: Graceful error handling — try/catch on all registrations, error notifications instead of silent failure

### Reliability (REL)

- [ ] **REL-01**: MCP server stays alive on errors
- [ ] **REL-02**: Extension degrades gracefully when core throws
- [ ] **REL-03**: Chat participant wrapped in try/catch — if it fails, MCP is the path

### Session (SESS)

- [ ] **SESS-02**: Session taskId persists across Cursor restarts via workspaceState

### Routing (ROUT)

- [ ] **ROUT-04**: Model suggestion includes tier, modelName, and provider

### Telemetry (TELE)

- [ ] **TELE-01**: JSONL append telemetry — every gate call logged
- [ ] **TELE-02**: Telemetry path uses context.globalStorageUri in extension (not relative)

### Docs (DOCS)

- [ ] **DOCS-01**: SETUP.md — 15-minute installation guide for CoinSwitch
- [ ] **DOCS-02**: PILOT.md — what we measure, how to extract, what success looks like

## Deferred Requirements (Phase 2+, scoped by pilot data)

| Requirement | Trigger |
|---|---|
| Rubric-based 5-dimension scoring | Pilot data shows section-presence scoring is too coarse |
| Per-criterion scoring breakdown | Users ask "why did I score 4?" |
| 7-section patch template | Users say "I need INPUTS/ACTIONS sections" |
| /steer command system (10 commands) | Users request more than on/off/gate |
| EventBus + SessionStore | Consumer count exceeds direct-call simplicity |
| Hook-to-extension bridge | Cursor ships proper hook ↔ extension API |
| .steer/config.json project config | Teams need different thresholds per repo |
| Score trend visualization | 2+ weeks of telemetry data exists |
| Prompt template library | Users ask "what should I put in GOAL?" |
| Custom section definitions | Teams request THREAT_MODEL, SCHEMA sections |
| Team analytics dashboard | Developer count exceeds 50 |
| Cost-aware budget guardrails | Cost tracking infrastructure exists |

## Out of Scope

| Feature | Reason |
|---------|--------|
| LLM-based scoring | Adds latency, cost, non-determinism |
| Blocking by default | Developers will disable the tool |
| Full prompt rewriting | Developers lose ownership |
| Multi-LLM provider management | Scope creep |
| Approval workflows | Kills velocity |

## Traceability

| Requirement | Phase | Plan | Status |
|---|---|---|---|
| HOOK-01 | 1 | 01-02 | Pending |
| HOOK-02 | 1 | 01-02 | Pending |
| HOOK-04 | 1 | 01-02 | Pending |
| HOOK-05 | 1 | 01-02 | Pending |
| MCP-03 | 1 | 01-01 | Pending |
| MCP-04 | 1 | 01-01 | Pending |
| EXT-05 | 1 | 01-02 | Pending |
| REL-01 | 1 | 01-01 | Pending |
| REL-02 | 1 | 01-02 | Pending |
| REL-03 | 1 | 01-02 | Pending |
| SESS-02 | 1 | 01-02 | Pending |
| ROUT-04 | 1 | 01-02 | Pending |
| TELE-01 | 1 | 01-03 | Pending |
| TELE-02 | 1 | 01-03 | Pending |
| DOCS-01 | 1 | 01-03 | Pending |
| DOCS-02 | 1 | 01-03 | Pending |

**Coverage:**
- Phase 1 requirements: 16 total
- Mapped to plans: 16
- Unmapped: 0

---
*Requirements defined: 2026-02-24*
*Last revised: 2026-02-24 after CTO review*

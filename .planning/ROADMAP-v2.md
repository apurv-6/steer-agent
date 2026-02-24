# Roadmap: SteerAgent v1 (CTO Cut)

## Overview

Ship a working gate loop to 14 developers in 5-7 days. The hook blocks bad prompts. The MCP tool returns structured results. The extension shows what happened and why. Telemetry captures enough to know if it's working. Nothing else until we have 2 weeks of real data.

## Principles

1. **No architecture without users.** EventBus, SessionStore, PersistenceAdapter — all cut. Direct function calls until complexity demands otherwise.
2. **No scoring improvements without calibration data.** Ship current section-presence scoring. Collect 2 weeks of real prompts. Build rubric from data, not assumptions.
3. **No features without demand.** Score trends, templates, coaching, custom sections — all deferred. Ship. Observe. React.
4. **The hook is observation, not interception.** It blocks score <= 3. Everything else passes through. The extension is where improvement happens — not the hook.

## Phases

- [ ] **Phase 1: Gate Loop Hardening** — Make what exists reliable for 14 devs
- [ ] **Phase 2: Pilot Feedback** — React to what we learn in weeks 1-2

Everything else is Phase 3+ and not planned until Phase 2 data says so.

## Phase Details

### Phase 1: Gate Loop Hardening

**Goal**: 14 CoinSwitch developers install the tool. The hook fires on every prompt. The MCP server stays alive. The extension shows score and patched prompt. Telemetry captures every gate call. No crashes, no silent failures.

**Depends on**: Nothing
**Timeline**: 5-7 focused days, 1 developer

**What we're NOT doing:**
- No EventBus (call functions directly)
- No SessionStore abstraction (use workspaceState directly)
- No hook-to-extension bridge (they operate independently)
- No rubric scoring upgrade (ship current scoring, collect data)
- No 7-section patches (keep current 5 sections)
- No per-criterion scoring breakdown (use existing `missing` array)
- No slash command system (3 commands: on, off, gate)
- No typed message protocol (current msg.type switch is fine)

**Plans**: 3 plans, 1 wave (sequential, fast)

#### Plan 01: MCP Server Hardening (Day 1)

**Files**: packages/mcp-server/src/index.ts, packages/mcp-server/src/smoke.mjs

Tasks:
1. Add stdout guard: `console.log = (...args) => console.error("[mcp]", ...args)` — first line, before imports
2. Add error handlers: `process.on("uncaughtException")`, `process.on("unhandledRejection")` — log to stderr, don't exit
3. Add signal handlers: SIGINT/SIGTERM → clean exit
4. Add `process.stdin.resume()` keepalive
5. Wrap `handleGate` in try/catch returning MCP error format on failure
6. Update smoke test: verify BLOCKED/NEEDS_INFO/READY responses, verify server survives error case

**Done when**: `node packages/mcp-server/src/smoke.mjs` passes 4 cases. Server stays alive after error injection.

#### Plan 02: Hook + Extension Polish (Days 2-4)

**Files**: hooks/steer-gate-hook.js, packages/cursor-extension/src/extension.ts, packages/cursor-extension/src/StatusPanel.ts, packages/cursor-extension/src/WizardPanel.ts

Tasks:
1. **Hook cleanup**: Verify CJS format works. Add 3-second timeout on git execSync (already done — confirm). Test with `echo '{"prompt":"fix it"}' | node hooks/steer-gate-hook.js` for all 3 score ranges. Ship cursor-hooks.example.json.
2. **Extension error handling**: Wrap chat participant registration in try/catch (if it fails in Cursor, log warning and continue). Wrap panel registrations in try/catch. Add error notification via `vscode.window.showErrorMessage` on gate failures instead of silent swallow.
3. **Extension session fix**: Persist taskId in workspaceState across restarts. Reset only on explicit "New Task" command. Increment turnId on each gate call.
4. **Model routing enrichment**: Add `modelName` and `provider` to RouteResult. Map tiers: small → haiku, mid → sonnet, high → opus. Show in WizardPanel alongside tier.
5. **Panel polish**: StatusPanel shows score (colored), status, mode, model tier, gate call count. WizardPanel shows follow-up questions, patched prompt, model suggestion with cost, Copy Prompt button. No sparklines. No trends. No metrics dashboard.

**Done when**: Extension installs, activates without errors, shows accurate score and patched prompt for test prompts. Hook blocks "fix it" and passes well-structured prompts.

#### Plan 03: Telemetry + Docs (Days 5-6)

**Files**: packages/core/src/telemetry.ts, packages/cursor-extension/src/extension.ts, docs/SETUP.md, docs/PILOT.md

Tasks:
1. **Fix telemetry path**: In extension, use `context.globalStorageUri.fsPath` for telemetry directory. Create directory if needed. In CLI, use `process.cwd() + "/data"`. Make `append()` accept explicit absolute path parameter.
2. **Enrich telemetry record**: Each JSONL line includes: timestamp, taskId, turnId, mode, score, status, missing sections, model tier, estimated cost, has git impact (boolean). No criterion breakdown. No EventBus subscription — just call `append()` directly after `gate()` in each consumer.
3. **Write SETUP.md**: Installation steps for CoinSwitch. Hook config. Extension install. MCP config for Cursor. Verify checklist (run demo.sh, check extension activates, verify steer.gate in MCP).
4. **Write PILOT.md**: What we're measuring (gate calls/day, avg score, block rate, override rate). How to extract metrics from JSONL. What success looks like after 2 weeks.

**Done when**: Telemetry writes to correct path in both extension and CLI. JSONL has all required fields. SETUP.md gets a developer from zero to working in 15 minutes.

**Success Criteria** (what must be TRUE for Phase 1):
  1. `echo '{"prompt":"fix it"}' | node hooks/steer-gate-hook.js` returns `continue: false`
  2. MCP smoke test passes 4 cases, server survives error injection
  3. Extension activates without errors in Cursor, shows score and patched prompt
  4. Telemetry writes JSONL to correct absolute path with all required fields
  5. A new developer can install in 15 minutes using SETUP.md
  6. Demo script (hooks/demo.sh) shows BLOCKED → NEEDS_INFO → READY

### Phase 2: Pilot Feedback (Weeks 3-4, scoped by data)

**Goal**: React to what we learn from 14 developers using the tool for 2 weeks. Scope is determined by telemetry and feedback, NOT by this document.

**Depends on**: Phase 1 + 2 weeks of pilot data

**Likely work (will be scoped after data review):**
- If developers game the scoring → add semantic validation within sections
- If developers ask "what should I put in GOAL?" → add 3-5 prompt templates
- If scores plateau → add per-criterion breakdown to help developers improve
- If config is too rigid → add .steer/config.json for thresholds
- If MCP is unreliable → investigate embedded MCP server
- If the hook blocks too aggressively/passively → tune threshold based on data

**What we explicitly WON'T do in Phase 2:**
- Team dashboard (need 50+ devs to justify)
- Budget guardrails (need cost tracking infrastructure)
- Custom section definitions (need teams asking for them)
- EventBus / SessionStore (need actual scaling problems)

## Cut Items (with rationale)

| Cut | Original Phase | Rationale |
|-----|----------------|-----------|
| EventBus | Phase 1 | 4 consumers, direct calls work. Add when N > 10. |
| SessionStore + PersistenceAdapter | Phase 1 | One implementation (Memento). Abstract when second backend appears. |
| File-based IPC hook bridge | Phase 1 | Rube Goldberg. Hook and extension work independently. |
| Rubric-based 5-dimension scoring | Phase 2 | No calibration data. Ship current scoring, build rubric from real prompts. |
| 7-section patch template | Phase 2 | 5 sections work. Add when users say "I need INPUTS section." |
| Per-criterion scoring breakdown | Phase 1 | `missing` array is sufficient. Add when users say "why did I score 4?" |
| 10 slash commands | Phase 2 | 3 commands (on/off/gate). Add when users request specific commands. |
| Typed webview message protocol | Phase 2 | 5 message types. Untyped switch is fine. |
| CommandRouter | Phase 2 | 5 commands. registerCommand 5 times. |
| Score trend visualization | Phase 3 | No data to trend. |
| Prompt template library | Phase 3 | No demand signal yet. |
| Learning mode / coaching | Phase 3 | No adoption data to know what to teach. |
| Team analytics dashboard | Phase 4 | 14 devs. grep the JSONL file. |
| Cost-aware budget guardrails | Phase 4 | No cost tracking infrastructure. |
| Custom section definitions | Phase 3 | Zero teams have asked. |

## Progress

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 1. Gate Loop Hardening | 0/3 | Not started | - |
| 2. Pilot Feedback | TBD | Blocked on Phase 1 data | - |

## What Success Looks Like

**After Phase 1 (Day 7):**
- 14 developers have the tool installed
- Every prompt goes through the gate
- Garbage prompts are blocked (score <= 3)
- Developers see what's missing and get a patched prompt
- We have JSONL data showing gate calls, scores, and block rates

**After Phase 2 (Week 4):**
- Average prompt score has increased (measured from telemetry)
- Block rate has decreased (developers learned the structure)
- We know which features to build next (from data, not assumptions)

# SteerAgent

## What This Is

SteerAgent is a developer productivity tool that gates every AI prompt before it reaches an LLM. When a developer types `/steer` (or enables Steer: ON), every outgoing message is intercepted, scored against a rubric, optionally patched with missing structure, routed to an appropriate model tier, and instrumented. It turns vague "fix it" prompts into structured, cost-efficient, first-pass-success prompts — without requiring developers to learn prompt engineering.

Built for CoinSwitch first (14 devs, ~10 items/month pilot), architected to generalize later.

## Core Value

Every prompt going to an LLM is structured enough to get a useful response on the first try — reducing iteration churn, token waste, and developer frustration.

## Requirements

### Validated

- ✓ Rule-based prompt scoring (0-10, section-based deductions) — v0.1
- ✓ Follow-up question generation (max 3, mode-aware, MCQ + open) — v0.1
- ✓ Prompt patching (5-section: GOAL/CONTEXT/LIMITS/OUTPUT FORMAT/REVIEW) — v0.1
- ✓ Model tier routing (small/mid/high) — v0.1
- ✓ Token estimation + cost estimate — v0.1
- ✓ MCP server (`steer.gate` tool) — v0.1
- ✓ Cursor extension (Status + Wizard panels, @steer chat participant) — v0.1
- ✓ CLI interactive mode — v0.1
- ✓ Local telemetry (JSONL) — v0.1
- ✓ Canonical gate() in core (single source of truth) — v0.2
- ✓ Git impact analysis (diff parsing, critical modules, impact level) — v0.2
- ✓ Git-aware model routing with explanations + cost estimate — v0.2
- ✓ Session tracking (taskId, turnId, scoreTrend) — v0.2
- ✓ Cursor `beforeSubmitPrompt` hook bridge — v0.2
- ✓ `nextAction` guidance in GateResult — v0.2

### Active

- [ ] `/steer` command router (on/off/mode/gate/send/status/explain/metrics/reset/threshold)
- [ ] Rubric-based scoring (5 dimensions: clarity, completeness, constraints, verifiability, efficiency)
- [ ] 7-section prompt patch template (CONTEXT, GOAL, INPUTS, LIMITS, OUTPUT FORMAT, ACTIONS, REVIEW)
- [ ] MCQ-first follow-up questions (prefer structured answers over open text)
- [ ] Explainable model routing (provider + model, not just tier; reasoning + cost breakdown)
- [ ] SessionStateV1 (full lifecycle: task thread, followup state, routing prefs, git context, UI, metrics)
- [ ] Connected gating loop ("gate on type" debounce mode OR "near-intercept" Send Patched flow)
- [ ] Command schema (steer.command.schema.json) + GateResult schema (steer.gateResult.schema.json)
- [ ] Left panel: live session HUD (score, status, model, gate calls, block threshold, task)
- [ ] Right panel: wizard (followups + answers + patched prompt diff + model explanation + Send/Apply/Override)
- [ ] Expanded modes: dev, debug, bugfix, spec, review, interview
- [ ] Session metrics in panel (gate calls, blocked count, overrides, avg score, turns-to-done proxy)
- [ ] criticalModules.json integration for CoinSwitch (auth, payments, security paths)
- [ ] Override audit trail (reason logged when BLOCKED is overridden)

### Out of Scope

- Cloud/org-wide analytics — local only for v1
- Auto-sending to Cursor chat unless API allows reliably — use near-intercept pattern
- Code execution or PR creation automation — just prompt steering
- LLM-based scoring — rule-based only (deterministic, fast, zero cost)
- Persistent org-wide config — per-workspace for v1
- Mobile/web app — Cursor-first

## Context

- Monorepo: 4 packages (core, mcp-server, cli, cursor-extension) + hooks/
- v0.2 already works: scoring, patching, routing, extension panels, hook bridge, telemetry
- The gap is **cohesion**: pieces exist but the UX is fragmented (manual gate → copy-paste → no loop)
- Cursor supports `beforeSubmitPrompt` hook (verified), but true chat input interception requires either hooks or "near-intercept" UX pattern
- GSD-inspired architecture: slash commands, spec-first, smooth sub-agent orchestration
- CoinSwitch pilot: measure throughput per dev per month, token cost per task, first-pass success rate

## Constraints

- **Runtime**: Node.js >= 18
- **IDE**: Cursor (primary), VS Code compatible
- **Cost**: Zero runtime cost — no LLM calls in the gate itself
- **Latency**: < 200ms for gate evaluation (rule-based, pure TS functions)
- **Architecture**: Core must be framework-free, importable by all consumers (MCP, extension, CLI, hooks)
- **Pilot**: Must work at CoinSwitch within current tooling (Cursor + existing repos)
- **Modularity**: Same repo for speed, but package boundaries clean enough to extract later

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rule-based scoring (not LLM) | Zero cost, deterministic, < 200ms | ✓ Good |
| Single canonical gate() in core | Eliminates duplication, single schema | ✓ Good |
| CJS hook script (not ESM) | Node 18 compatibility without package.json | ✓ Good |
| beforeSubmitPrompt hook | Best Cursor integration point, gets prompt text | — Pending |
| Block only at score ≤ 3 | Aggressive enough to catch garbage, not annoying | — Pending |
| Near-intercept pattern (Send Patched) | Works even if Cursor can't truly intercept chat | — Pending |
| GSD-inspired command system | Proven UX pattern for slash commands + workflow | — Pending |
| Rubric scoring (5 dimensions) | More nuanced than section-presence checking | — Pending |
| MCQ-first follow-ups | Faster for devs, structured answers patch better | — Pending |

---
*Last updated: 2026-02-24 after v1 spec definition*

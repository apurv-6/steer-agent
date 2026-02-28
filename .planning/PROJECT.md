# SteerAgent

## What This Is

SteerAgent is an AI workflow governance system for engineering teams. It standardizes how developers collaborate with AI coding agents by enforcing structured workflows, guardrails, and measurement — without requiring any prompting skill.

It is NOT a prompt coaching tool. It is NOT an AI wrapper. It is engineering standards enforcement for AI-assisted development.

**Comparable to:** ESLint for code quality → SteerAgent for AI collaboration quality.

Built for CoinSwitch first (14 devs, ~10 items/month pilot), architected to generalize later.

## Core Value

Increase First-Pass Completion Rate (FPCR) while reducing AI cost. Make the process repeatable so any developer — junior or senior — produces quality output on first pass. Knowledge compounds: every task makes the next one smarter.

## Architecture

Three layers. Clear separation of concerns.

```
Layer 3: VS Code/Cursor Extension (v1: read-only, v2: full 5-tab sidebar)
Layer 2: MCP Server (workflow engine — owns ALL logic and state)
Layer 1: .steer/ folder (spec files, state, knowledge, templates — committed to git)
```

- MCP works in ANY host: Cursor, VS Code, Claude Code, OpenCode, Gemini CLI, Windsurf
- Extension v1 is optional. Extension v2 is the product experience.
- Works 100% without extension (MCP + .steer/ = full functionality)

## 8-Step Workflow

Every task, every mode, every time:

1. **Context Gathering** — load knowledge + codemap + RAG + external sources
2. **Prompt Assembly** — build from all context including knowledge layer
3. **Planning** — impact preview + sub-agent decision
4. **Execution** — single-agent OR parallel sub-agents
5. **Reflection Loop** — self-review against criteria + knowledge
6. **Verification** — acceptance gate
7. **Learning Extraction** — extract + persist compounding knowledge
8. **Output Generation** — commit + PR + telemetry + knowledge updates

## Primary KPI

**FPCR** = (tasks completed in ≤ 2 rounds) / (total tasks) × 100%

Target: 70%+ after Phase 2 (60 days).

## Constraints

- **Runtime**: Node.js >= 18
- **IDE**: Any MCP-compatible host (Cursor primary)
- **Cost**: Zero runtime cost in governance layer (no LLM calls in gate/scoring/routing/hooks)
- **Latency**: < 200ms for deterministic operations
- **Architecture**: Core must be framework-free, importable by all consumers
- **State**: File-based (current-task.json is single source of truth)
- **Knowledge**: `.steer/knowledge/` committed to git (team-shared)
- **No auto-send**: Developer always manually confirms before execution

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| 3-layer architecture | Clear separation: files → engine → UI |
| MCP owns all logic | Works in any host, extension is optional |
| File-based state | Simple, debuggable, resumable |
| Deterministic governance | No AI in scoring, routing, gating, hooks |
| Compounding knowledge | Learnings persist in git, shared across team |
| Sub-agents for parallel work only | File isolation enforced, no shared-file parallelism |
| RAG over full-file loading | 80% token reduction |
| Reflection before human review | Catch obvious mistakes automatically |
| FPCR as primary KPI | Measures what leadership cares about |
| Extension v2 as product surface | 5-tab sidebar is the daily developer experience |

## Build Phases

- **V1 (Weeks 1-4)**: Foundation, workflow engine, measurement, knowledge, extension v2 core
- **Phase 2 (Weeks 5-8)**: Intelligence (RAG, tree-sitter), integrations (Jira/Sentry/GitHub), output generation
- **Phase 3+**: Compound workflows, full sub-agent orchestration, LSP, web dashboard

## What Exists (v0.2)

- Rule-based scoring (0-10, section-presence) ✓
- Follow-up generation (max 3, mode-aware) ✓
- Prompt patching (5-section: GOAL/CONTEXT/LIMITS/OUTPUT FORMAT/REVIEW) ✓
- Model tier routing (small/mid/high) ✓
- MCP server (steer.gate tool) ✓
- Cursor extension (Status + Wizard panels) ✓
- CLI interactive mode ✓
- Local telemetry (JSONL) ✓
- Hook bridge (beforeSubmitPrompt) ✓
- Git impact analysis ✓

These components will be refactored into the v3.0 architecture.

---
*Canonical spec: `.planning/SPEC-V3.md` | Last updated: 2026-02-28*

# Project State

## Current Phase

v3.0 spec defined. v0.2 code exists. Ready to begin V1 Week 1.

## What Exists (v0.2)

| Component | Status |
|-----------|--------|
| Rule-based scoring (0-10, section-presence) | Working |
| Follow-up generation (max 3, mode-aware) | Working |
| Prompt patching (5-section) | Working |
| Model tier routing (small/mid/high) | Working |
| MCP server (steer.gate tool) | Working |
| Cursor extension (Status + Wizard panels) | Working |
| CLI interactive mode | Working |
| Local telemetry (JSONL) | Working |
| Hook bridge (beforeSubmitPrompt) | Working |
| Git impact analysis | Working |
| 54 tests passing (7 test files) | Working |

## What's New in v3.0

The spec evolves SteerAgent from a prompt quality gate into a full AI workflow governance system:

- **3-layer architecture** (.steer/ → MCP Server → Extension v1/v2)
- **8-step workflow** (Context → Prompt → Planning → Execution → Reflection → Verification → Learning → Output)
- **Compounding knowledge** (per-module learnings committed to git)
- **14 MCP tools** (up from 1: steer.gate)
- **Extension v2** (5-tab sidebar: Task, Knowledge, FPCR, Map, Rules)
- **FPCR as primary KPI** (First-Pass Completion Rate)
- **Sub-agent orchestration** (parallel independent work)
- **RAG over codebase** (local embeddings)
- **External integrations** (Jira, Sentry, GitHub, Figma, Slack)

## Next Action

Begin V1 Week 1: Foundation + Codebase Map.

Key deliverables:
1. `.steer/` folder structure + templates
2. Codebase map builder (static analysis)
3. MCP `steer.init` and `steer.start`
4. Prompt assembly pipeline
5. State machine (8-step)

---
*Last updated: 2026-02-28*

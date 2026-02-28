# Architecture: SteerAgent v3.0

## 3-Layer Architecture

```
┌─────────────────────────────────────────────────┐
│  Layer 3: VS Code/Cursor Extension              │
│  v1: READ-ONLY overview panel                   │
│  v2: Full sidebar (Task, Knowledge, FPCR, Map,  │
│      Rules) + inline annotations + status bar   │
│  Watches .steer/state/ + MCP command bridge     │
├─────────────────────────────────────────────────┤
│  Layer 2: MCP Server (Workflow Engine)           │
│  Owns ALL logic and state                       │
│  14 MCP tools (init, start, plan, execute, etc.)│
│  Orchestrates external MCP servers (Phase 2)    │
│  Works in ANY MCP host                          │
├─────────────────────────────────────────────────┤
│  Layer 1: .steer/ Folder (Spec Files)           │
│  Lives in repo, committed to git                │
│  Templates, rules, config, state, telemetry     │
│  Codebase map, knowledge files, embeddings      │
└─────────────────────────────────────────────────┘
```

## Separation of Concerns

| Surface | Role | Writes to .steer/? |
|---------|------|-------------------|
| Chat | Active conversation (questions, plans, execution) | Via MCP only |
| Extension v1 | Passive display (step tracker, history) | NEVER |
| Extension v2 | Full experience (5 tabs + input bar + annotations) | Via MCP command bridge |

## State Machine

```
IDLE → CONTEXT → PROMPT → PLANNING → EXECUTION → REFLECTION → VERIFICATION → LEARNING → DONE
                                                                    │
                                                                    ▼
                                                          (fail → new round)
                                                          CONTEXT → ... (repeat)

At any point: crash → SUSPENDED (resumable from current-task.json)
```

## MCP Tools

| Tool | Purpose | Phase |
|---|---|---|
| `steer.init` | Onboard repo, build codebase map | V1 |
| `steer.start` | Begin task, load template, gather context | V1 |
| `steer.plan` | Propose plan with impact preview | V1 |
| `steer.execute` | Track execution, scope enforcement | V1 |
| `steer.verify` | Verification checklist | V1 |
| `steer.status` | Progress summary (CLI) | V1 |
| `steer.map` | Rebuild/query codebase map | V1 |
| `steer.impact` | Change impact preview | V1 |
| `steer.resume` | Resume interrupted task | V1 |
| `steer.similar` | Find similar past tasks | V1 |
| `steer.learn` | Extract learnings, update knowledge | V1 |
| `steer.commit` | Smart commit message | Phase 2 |
| `steer.pr` | PR description generator | Phase 2 |
| `steer.knowledge` | Search/view/prune knowledge | Phase 2 |

## Prompt Assembly Pipeline

```
RULES.md               → Team constraints (always loaded, cached)
knowledge/{module}.md   → Compounding context (loaded for affected modules)
codebase-map.json       → Architecture, patterns, conventions
history.jsonl           → Similar past tasks, failed approaches
templates/{mode}.md     → Mode-specific structure
External sources        → Jira, Sentry, GitHub, Slack, Figma (Phase 2)
Developer input         → Task description + follow-up answers
Constraints             → File limits, model tier, hook flags
Output format           → Expected shape (diff, plan, etc.)
Verification            → Acceptance criteria + tests to run
```

## Data Flow

```
Developer: "Fix the login bug"
    │
    ▼
Agent calls steer.start({mode: "bugfix"})
    │
    ▼
MCP: load codemap + knowledge + git context + similar tasks
    │
    ▼
MCP returns: intelligent questions + pre-loaded context
    │
    ▼
Developer answers (fewer needed because system already knows)
    │
    ▼
Agent calls steer.plan() → plan + impact preview → approval
    │
    ▼
Agent calls steer.execute() → [agent does the work]
    │
    ▼
MCP: reflection loop (self-review, max 2 rounds)
    │
    ▼
Agent calls steer.verify() → checklist results
    │
    ▼
Agent calls steer.learn() → extract learnings → update knowledge/
    │
    ▼
Agent calls steer.commit() + steer.pr() → output generation
    │
    ▼
Logged to history.jsonl. Knowledge files updated. Done.
```

## Package Dependencies

```
packages/core/          → Zero deps. Pure TS functions.
packages/mcp-server/    → Depends on core. MCP SDK + Zod.
packages/cli/           → Depends on core.
packages/cursor-extension/ → Depends on core. VS Code API.
```

## Key Abstractions

| Type | Description |
|------|-------------|
| `TaskState` | Full workflow state (8 steps, timing, context, plan) |
| `CodemapNode` | Module/file with dependencies, tests, risk level |
| `Learning` | Extracted insight (pattern, gotcha, convention, failed_approach) |
| `ImpactPreview` | Files modified, downstream deps, tests to run, risk |

## Intelligence Layers (Incremental)

| Phase | Approach | Precision |
|-------|----------|-----------|
| V1 | Static analysis (regex imports, file tree, git log) | Good |
| Phase 2 | Tree-sitter AST + RAG embeddings | Better |
| Phase 3+ | LSP integration | Best |

---
*Canonical spec: `.planning/SPEC-V3.md` | Last updated: 2026-02-28*

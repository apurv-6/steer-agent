# Structure: SteerAgent v3.0

## Repository Layout

```
steer-agent-tool/
├── packages/
│   ├── core/                        → Core logic (zero deps, pure TS)
│   │   └── src/
│   │       ├── scoring.ts           → Prompt scoring (CLEAR dimensions)
│   │       ├── routing.ts           → Model routing rules
│   │       ├── state.ts             → Workflow state machine (8 steps)
│   │       ├── telemetry.ts         → history.jsonl + metrics
│   │       ├── hooks.ts             → Hook runner
│   │       ├── templates.ts         → Template loader + field checker
│   │       ├── prompt-builder.ts    → Prompt assembly pipeline
│   │       ├── codemap.ts           → Codebase map builder + querier
│   │       ├── codemap-static.ts    → Static analysis (V1: regex/imports)
│   │       ├── dependency-graph.ts  → Dependency resolution
│   │       ├── change-coupling.ts   → Git log co-change analysis
│   │       ├── impact.ts            → Change impact calculator
│   │       ├── similar-tasks.ts     → History search + matching
│   │       ├── git-context.ts       → Git log, blame, PR detection
│   │       ├── resume.ts            → Task resumption logic
│   │       ├── reflection.ts        → Self-review loop (Phase 2)
│   │       ├── rag/                 → RAG pipeline (Phase 2)
│   │       ├── commit-gen.ts        → Smart commit (Phase 2)
│   │       ├── pr-gen.ts            → PR description (Phase 2)
│   │       └── types.ts             → Shared types
│   │
│   ├── mcp-server/                  → MCP server (stdio)
│   │   └── src/
│   │       ├── server.ts            → MCP server setup
│   │       ├── tools/               → One file per MCP tool
│   │       │   ├── init.ts          → steer.init
│   │       │   ├── start.ts         → steer.start
│   │       │   ├── plan.ts          → steer.plan
│   │       │   ├── execute.ts       → steer.execute
│   │       │   ├── verify.ts        → steer.verify
│   │       │   ├── status.ts        → steer.status
│   │       │   ├── map.ts           → steer.map
│   │       │   ├── impact.ts        → steer.impact
│   │       │   ├── resume.ts        → steer.resume
│   │       │   ├── similar.ts       → steer.similar
│   │       │   ├── commit.ts        → steer.commit (Phase 2)
│   │       │   └── pr.ts            → steer.pr (Phase 2)
│   │       ├── integrations/        → External MCP callers (Phase 2)
│   │       └── mode-mapper.ts
│   │
│   ├── cursor-extension/            → VS Code / Cursor extension
│   │   └── src/
│   │       ├── extension.ts         → Entry point
│   │       ├── panels/              → One file per panel/tab
│   │       │   ├── task-panel.ts    → Task tab (v2)
│   │       │   ├── knowledge-panel.ts
│   │       │   ├── fpcr-panel.ts
│   │       │   ├── codemap-panel.ts
│   │       │   ├── rules-panel.ts
│   │       │   ├── step-tracker.ts  → v1 panel
│   │       │   ├── impact-view.ts   → v1 panel
│   │       │   └── task-history.ts  → v1 panel
│   │       ├── watcher.ts           → .steer/state/ file watcher
│   │       ├── command-bridge.ts    → VS Code → MCP bridge
│   │       ├── annotations.ts      → Inline annotations (Phase 2)
│   │       └── status-bar.ts       → Status bar
│   │
│   └── cli/                         → CLI entrypoint
│       └── src/
│           ├── init.ts, mcp.ts, metrics.ts, map.ts
│           └── package.json
│
├── templates/                       → Default .steer/ templates
├── .steer/                          → Per-repo config (created by steer.init)
│   ├── config.json, RULES.md, hooks.yaml, codebase-map.json
│   ├── knowledge/                   → Committed (team-shared)
│   ├── templates/                   → Committed
│   ├── embeddings/                  → Gitignored (Phase 2)
│   └── state/                       → Gitignored
│       ├── current-task.json, history.jsonl, learnings.jsonl, steer.log
│
├── .planning/                       → Project planning docs
├── tasks/                           → Task tracking (todo.md, lessons.md)
├── CLAUDE.md                        → Agent rules
├── README.md
├── package.json                     → Monorepo root
└── tsconfig.base.json
```

## Where to Add New Code

| What | Where |
|------|-------|
| Scoring/routing/state logic | `packages/core/src/` |
| New MCP tool | `packages/mcp-server/src/tools/{name}.ts` |
| New integration | `packages/mcp-server/src/integrations/{name}.ts` |
| Extension v2 panel | `packages/cursor-extension/src/panels/{name}.ts` |
| New template | `templates/` (defaults) or `.steer/templates/` (per-repo) |
| New hook check | `packages/core/src/hooks.ts` |
| RAG pipeline | `packages/core/src/rag/` |

## .steer/ gitignore Rules

**Committed (team-shared):** config.json, RULES.md, hooks.yaml, codebase-map.json, knowledge/, templates/

**Gitignored:** state/, embeddings/

## Naming Conventions

- Files: `kebab-case.ts`
- Functions: `camelCase`
- Types/Interfaces: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- MCP tools: `steer.{verb}` (e.g., steer.start, steer.plan)
- Extension panels: `{name}-panel.ts`

---
*Canonical spec: `.planning/SPEC-V3.md` | Last updated: 2026-02-28*

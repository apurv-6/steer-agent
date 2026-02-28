# Requirements: SteerAgent v3.0

## Layer 1: .steer/ Folder

### V1
- [ ] `.steer/config.json` — integrations, team settings, codemap config
- [ ] `.steer/RULES.md` — team constraints, conventions, non-negotiables
- [ ] `.steer/hooks.yaml` — lifecycle triggers (pre/post each step)
- [ ] `.steer/codebase-map.json` — structural understanding of the repo
- [ ] `.steer/templates/` — 5 workflow templates (bugfix, feature, refactor, design, debug)
- [ ] `.steer/knowledge/` — per-module markdown files (committed to git)
- [ ] `.steer/state/current-task.json` — live workflow state (gitignored)
- [ ] `.steer/state/history.jsonl` — completed task telemetry (gitignored)
- [ ] `.steer/state/learnings.jsonl` — raw extracted learnings (gitignored)
- [ ] `.steer/state/steer.log` — append-only execution log (gitignored)

### Phase 2
- [ ] `.steer/embeddings/` — RAG index (local, gitignored)

## Layer 2: MCP Server (Workflow Engine)

### V1 MCP Tools
- [ ] `steer.init` — onboard repo, build codebase map, set up .steer/
- [ ] `steer.start` — begin task, load template, gather intelligent context
- [ ] `steer.plan` — propose execution plan with impact preview
- [ ] `steer.execute` — track execution, scope enforcement
- [ ] `steer.verify` — run verification checklist against acceptance criteria
- [ ] `steer.status` — current step + timing + progress (CLI users)
- [ ] `steer.map` — rebuild or query codebase map
- [ ] `steer.impact` — preview change impact before execution
- [ ] `steer.resume` — resume interrupted task from saved state
- [ ] `steer.similar` — find similar past tasks from history
- [ ] `steer.learn` — extract learnings, update knowledge files

### Phase 2 MCP Tools
- [ ] `steer.commit` — generate smart commit message from task context
- [ ] `steer.pr` — generate PR description from task telemetry
- [ ] `steer.knowledge` — search/view/prune module knowledge files

### V1 Core Engine
- [ ] State machine: IDLE → CONTEXT → PROMPT → PLANNING → EXECUTION → REFLECTION → VERIFICATION → LEARNING → DONE
- [ ] Prompt assembly pipeline (hierarchical: RULES → KNOWLEDGE → CODEBASE → HISTORY → TEMPLATE → CONTEXT → TASK → CONSTRAINTS → OUTPUT → VERIFICATION)
- [ ] Codebase map builder (static: file tree, imports, test matching, git co-change)
- [ ] Dependency graph builder (import/export parsing)
- [ ] Change coupling analysis (git log co-change frequency)
- [ ] Scoring engine (CLEAR: Clarity, Limits, Evidence, Actions, Review — 5 dimensions, max 10)
- [ ] Model routing (deterministic: critical module → high, LOC > 300 → high, design → high, etc.)
- [ ] Hook system (hooks.yaml loader + runner, pre/post each step)
- [ ] Follow-up question engine (codebase-aware, max 3 questions)
- [ ] File reference intelligence (@file → dependency enrichment)
- [ ] Git context fetcher (blame, log, recent commits, open PRs)
- [ ] Similar task matcher (module + mode + files + keyword matching)
- [ ] Learning extraction engine (deterministic rules: root cause → pattern, multi-round → gotcha, etc.)
- [ ] Knowledge file generator (append-only, per-module .steer/knowledge/*.md)
- [ ] Task resumption (durable state in current-task.json)

### Phase 2 Core Engine
- [ ] Tree-sitter AST parser (precise dependency graph)
- [ ] RAG pipeline (chunker + local embedder + vector index + retriever)
- [ ] Reflection loop (self-review, max 2 rounds, bounded)
- [ ] Sub-agent trigger decision tree (deterministic, file isolation enforced)
- [ ] Sub-agent orchestrator (spawn + merge + learnings collection)
- [ ] Smart commit generator (Conventional Commits format)
- [ ] PR description generator (What/Why/How/Impact/Testing)
- [ ] Prompt caching (Anthropic API native)

### Phase 2 Integrations
- [ ] MCP tool chaining (parallel fetch + graceful degradation)
- [ ] Jira MCP integration (auto-fetch ticket details)
- [ ] Sentry MCP integration (auto-fetch crash reports)
- [ ] GitHub MCP integration (open PRs, CI status, recent merges)
- [ ] Figma MCP integration (design tokens, annotations)
- [ ] Slack MCP integration (thread context extraction)

## Layer 3: VS Code Extension

### Extension v1 (Read-Only)
- [ ] Step tracker panel (watches current-task.json)
- [ ] Impact preview panel
- [ ] Task history panel
- [ ] File system watcher (polls current-task.json)
- [ ] NEVER calls MCP, NEVER writes state, NEVER blocks workflow

### Extension v2 Core (P0 — Week 3)
- [ ] Sidebar frame + 5-tab bar (Task | Knowledge | FPCR | Map | Rules)
- [ ] Task panel: task card, workflow progress, CLEAR score ring
- [ ] Task input bar + MCP command bridge
- [ ] Knowledge injected cards (in Task panel)
- [ ] Status bar integration (persistent FPCR + task info)

### Extension v2 Panels (P1 — Week 4)
- [ ] Knowledge panel: full browser + search
- [ ] Rules panel: rules list + hooks display
- [ ] FPCR dashboard: 4 metric cards, basic stats
- [ ] Terminal STEER LOG tab

### Extension v2 Advanced (P2 — Phase 2 Week 6)
- [ ] Inline code annotations (VS Code Diagnostics API)
- [ ] FPCR sparkline + team leaderboard
- [ ] Codemap panel (RAG status, module tree, coupling)
- [ ] Notification toasts (knowledge matches, blocked prompts)
- [ ] Sub-agent parallel status in Task panel

### Extension v2 Polish (P3 — Phase 2 Week 8)
- [ ] Change coupling visualization
- [ ] Dependency graph visualization
- [ ] Theme customization (accent color per org)

## Critical Design Rules

1. MCP + .steer/ = 100% functionality. Extension optional.
2. All workflow logic in MCP. All state in .steer/ files.
3. Extension NEVER writes to .steer/ directly.
4. Score NEVER shown to developer in chat.
5. Hooks are deterministic. No LLM calls.
6. Model routing is a pure function.
7. No auto-send ever.
8. Graceful degradation for all integrations.
9. Knowledge files committed to git. learnings.jsonl gitignored.
10. Sub-agent file isolation ENFORCED.

## Out of Scope (Phase 3+)

- Compound workflow chaining
- Full autonomous mode
- Web dashboard
- LSP integration
- CI/CD pipeline integration
- Multi-repo support
- Custom embedding models
- Knowledge auto-pruning without confirmation

---
*Canonical spec: `.planning/SPEC-V3.md` | Last updated: 2026-02-28*

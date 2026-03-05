# Roadmap: SteerAgent v3.0

## Overview

Build an AI workflow governance system in 8 weeks. V1 (Weeks 1-4): working governance + knowledge + extension v2 core for 14 developers. Phase 2 (Weeks 5-8): intelligence layer + integrations + output generation.

## Principles

1. **Governance beats raw prompting.** Structure reduces ambiguity. Fewer iterations. Lower cost. Higher quality.
2. **No AI in governance.** Scoring, routing, gating, hooks — all deterministic. Pure functions.
3. **MCP owns everything.** Works in any host. Extension is optional bonus.
4. **Knowledge compounds.** Every task makes the next one smarter. Learnings persist in git.
5. **Ship, observe, react.** No features without demand signal from real usage data.

---

## V1: Weeks 1-4

### Week 1: Foundation + Codebase Map

**Goal:** `.steer/` folder structure, codebase map, core workflow engine, first 2 MCP tools.

- [ ] `.steer/` folder structure + all 5 templates (bugfix, feature, refactor, design, debug)
- [ ] Codebase map builder (static: file tree, imports, test matching)
- [ ] Dependency graph builder (import/export parsing)
- [ ] Change coupling analysis (git log co-change)
- [ ] Core scoring logic (v3.0 CLEAR dimensions)
- [ ] Core state machine (8-step transitions)
- [ ] MCP `steer.init` (setup + codemap build)
- [ ] MCP `steer.start` (template loading + intelligent context questions)
- [ ] Follow-up question engine (codebase-aware, not generic)
- [ ] Prompt assembly pipeline
- [ ] File reference detection + dependency enrichment
- [ ] Git context fetcher (blame, log, recent commits)
- [ ] `current-task.json` writer

### Week 2: Workflow Engine + Extension v1

**Goal:** Full workflow loop working in MCP. Extension v1 shows progress.

- [ ] MCP `steer.plan` (plan + impact preview)
- [ ] MCP `steer.execute` (execution + scope enforcement)
- [ ] MCP `steer.verify` (verification checklist)
- [ ] MCP `steer.status` (progress for CLI)
- [ ] MCP `steer.impact` (change impact calculator)
- [ ] Timer per step
- [ ] Hook system (hooks.yaml loader + runner)
- [ ] Model routing logic (deterministic, explainable)
- [ ] Extension v1: step tracker panel (read-only)
- [ ] Extension v1: file system watcher for current-task.json
- [ ] Task resumption (`steer.resume`)

### Week 3: Measurement + Knowledge + Extension v2 Core + Pilot

**Goal:** Telemetry, knowledge compounding, extension v2 P0 components, internal pilot.

- [ ] `history.jsonl` telemetry logging
- [ ] CLI `metrics` command (FPCR, iteration index, model usage)
- [ ] Override flow (blocked → reason → log)
- [ ] Similar past tasks (`steer.similar`)
- [ ] Learning extraction engine (root cause + gotcha detection)
- [ ] `learnings.jsonl` writer
- [ ] `knowledge/` file generator (append-only, per-module)
- [ ] Knowledge loading in context gathering step
- [ ] `steer.learn` MCP tool
- [ ] Extension v1: task history panel + impact preview panel
- [ ] Extension v2: sidebar frame + 5-tab bar (P0)
- [ ] Extension v2: Task panel — task card, workflow progress, score ring (P0)
- [ ] Extension v2: Task input bar + MCP command bridge (P0)
- [ ] Extension v2: Knowledge injected cards in Task panel (P0)
- [ ] Extension v2: Status bar integration (P0)
- [ ] Extension v2: Terminal STEER LOG tab (P1)
- [ ] Internal pilot with 3-5 developers

### Week 4: Refinement + Extension v2 Panels + Rollout

**Goal:** Polish from pilot feedback. Extension v2 P1 panels. Full team rollout.

- [ ] Template refinement based on pilot
- [ ] Hook refinement
- [ ] Scoring weight adjustments
- [ ] Extension v2: Knowledge panel — full browser + search (P1)
- [ ] Extension v2: Rules panel — rules list + hooks display (P1)
- [ ] Extension v2: FPCR dashboard — 4 metric cards, basic stats (P1)
- [ ] Leadership metrics report
- [ ] Expand to full 14-developer team
- [ ] Documentation + onboarding guide

---

## Phase 2: Weeks 5-8

### Week 5: Intelligence Layer

- [ ] Tree-sitter AST parser (precise dependency graph)
- [ ] RAG pipeline: chunker + local embedder + vector index + retriever
- [ ] Embed full codebase on init, incremental on git push
- [ ] Integrate RAG chunks into prompt assembly
- [ ] Reflection loop (self-review, max 2 rounds)

### Week 6: Integration Layer + Knowledge + Sub-agents

- [ ] MCP tool chaining (parallel fetch + graceful degradation)
- [ ] Jira MCP integration
- [ ] Sentry MCP integration
- [ ] GitHub MCP integration (PRs, CI, merges)
- [ ] Sub-agent trigger decision tree (deterministic)
- [ ] Sub-agent file isolation verifier
- [ ] Sub-agent orchestrator (spawn + merge + learnings)
- [ ] Advanced learning extraction (failed approaches, conventions)
- [ ] `steer.knowledge` search/prune
- [ ] Extension v2: inline code annotations (P2)
- [ ] Extension v2: FPCR sparkline + leaderboard (P2)
- [ ] Extension v2: codemap panel (P2)
- [ ] Extension v2: notification toasts (P2)
- [ ] Extension v2: sub-agent status (P2)

### Week 7: Output Generation

- [ ] `steer.commit` — smart commit messages (Conventional Commits)
- [ ] `steer.pr` — PR description generator
- [ ] Figma MCP integration
- [ ] Slack MCP integration
- [ ] Prompt caching (Anthropic API native)
- [ ] Token savings measurement (RAG vs full-file)

### Week 8: Polish + Rollout

- [ ] Reflection loop tuning
- [ ] RAG quality tuning
- [ ] Integration reliability hardening
- [ ] Extension v2: change coupling visualization (P3)
- [ ] Extension v2: dependency graph visualization (P3)
- [ ] Updated leadership report
- [ ] Full team Phase 2 rollout
- [ ] Documentation update

---

## Success Criteria

### V1 (30-Day Pilot)

| Metric | Target |
|---|---|
| FPCR improvement | 25-40% increase from baseline |
| Iteration Index | 30% fewer rounds per task |
| High-tier model usage | Measurably reduced |
| Adoption | >= 50% of pilot squad |
| Knowledge files created | >= 1 per active module |
| Tasks using prior knowledge | >= 30% by end of pilot |
| Extension v2 adoption | >= 80% using sidebar daily |

### Phase 2 (60-Day)

| Metric | Target |
|---|---|
| FPCR | 70%+ overall |
| Reflection catch rate | 30%+ issues caught before human review |
| Context token savings | 50%+ via RAG |
| Integration adoption | 80%+ tasks use >= 1 external source |
| Compounding effect | Month-over-month improvement in rounds/task |

---

## What NOT to Build Until Phase 3+

| Deferred | Why |
|---|---|
| Compound workflow chaining | Single workflows must prove out first |
| Full autonomous mode | Interactive governance must work first |
| Web dashboard | Extension v2 FPCR panel covers this |
| LSP integration | Tree-sitter sufficient for Phase 2 |
| CI/CD pipeline integration | Post-Phase 2 |
| Multi-repo support | Single repo first |
| Knowledge auto-pruning | Manual review required |

---
*Canonical spec: `.planning/SPEC-V3.md` | Last updated: 2026-02-28*

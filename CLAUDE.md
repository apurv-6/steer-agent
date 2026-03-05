# SteerAgent — Claude Code Rules

## Workflow

### Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan — don't keep pushing
- Use plan mode for verification steps, not just building

### Research Before Planning
- Study relevant code deeply before writing any plan
- Write findings to `research.md` — never just a verbal summary in chat
- Review `research.md` for accuracy before proceeding to `tasks/todo.md`

### Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- One task per subagent for focused execution

### Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules that prevent the same mistake
- Review lessons at session start

### Verification Before Done
- Never mark a task complete without proving it works
- Run tests, check logs, demonstrate correctness
- Ask: "Would a staff engineer approve this?"
- Diff behavior between main and your changes when relevant

### Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them

## Task Management

1. Research first — write findings to `research.md`
2. Plan first — write plan to `tasks/todo.md` with checkable items
3. Verify plan — check in before starting implementation
4. Track progress — mark items complete as you go
5. Explain changes — high-level summary at each step
6. Document results — add review section to `tasks/todo.md`
7. Capture lessons — update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First:** Make every change as simple as possible. Minimal code impact.
- **No Laziness:** Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact:** Changes touch only what's necessary. Avoid introducing bugs.

## Architecture (v3.0)

### 3 Layers
1. **`.steer/` folder** — spec files, state, knowledge, templates (committed to git)
2. **MCP Server** — workflow engine, owns ALL logic and state
3. **Extension** — v1: read-only overview, v2: full 5-tab sidebar

### Key Rules
- MCP owns all logic. Extension NEVER writes to `.steer/` directly.
- Works 100% without extension (MCP + .steer/ = full functionality)
- Deterministic governance: no AI in scoring, routing, gating, hooks
- File-based state: `current-task.json` is single source of truth
- Knowledge compounds: `.steer/knowledge/` committed to git, team-shared
- No auto-send ever. Developer always confirms.

### 8-Step Workflow
Context → Prompt → Planning → Execution → Reflection → Verification → Learning → Output

## Project

- Monorepo: `packages/core`, `packages/mcp-server`, `packages/cli`, `packages/cursor-extension`
- Build: `npm run build --workspaces` | Test: `npm test` (vitest in core)
- TypeScript strict, ESM everywhere (CJS for extension only)
- Primary KPI: FPCR (First-Pass Completion Rate)

## Key Paths

- Canonical spec: `.planning/SPEC-V3.md`
- Core logic: `packages/core/src/`
- MCP server: `packages/mcp-server/src/`
- Extension: `packages/cursor-extension/src/`
- CLI: `packages/cli/src/`
- `.steer/` folder: templates, config, rules, knowledge, state
- Planning: `.planning/` (PROJECT.md, ROADMAP.md, REQUIREMENTS.md)

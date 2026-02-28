# SteerAgent

**AI workflow governance for engineering teams.** Standardizes how developers collaborate with AI coding agents — structured workflows, guardrails, measurement, and compounding knowledge. No prompting skill required.

## What It Does

| Without SteerAgent | With SteerAgent |
|---|---|
| Developer types vague prompt | Developer answers 2-3 structured questions |
| 5-7 iterations to get useful output | 1-2 iterations (FPCR 70%+) |
| Context manually typed, often incomplete | Context auto-gathered from codebase, Jira, Sentry, git |
| Expensive models used for trivial tasks | Deterministic routing to right model tier |
| Knowledge lost after each task | Knowledge compounds across team via git |
| No measurement | FPCR dashboard, telemetry, leadership reports |

## Architecture

```
Layer 3: VS Code/Cursor Extension (v1: read-only, v2: full 5-tab sidebar)
Layer 2: MCP Server (workflow engine — owns ALL logic)
Layer 1: .steer/ folder (templates, rules, knowledge — committed to git)
```

Works in **any MCP host**: Cursor, VS Code, Claude Code, OpenCode, Gemini CLI, Windsurf.

## Quick Start

```bash
# Setup
npx steer-agent-tool init       # Create .steer/, build codebase map
npx steer-agent-tool mcp        # Start MCP server

# Usage (in any MCP-compatible chat)
/steer:bugfix COIN-4521         # Bugfix workflow
/steer:feature                  # Feature workflow
/steer:refactor                 # Refactor workflow
/steer:status                   # Check progress
/steer:resume                   # Resume interrupted task

# Metrics
npx steer-agent-tool metrics    # FPCR, iteration index, model usage
```

## 8-Step Workflow

Every task, every mode, every time:

1. **Context Gathering** — load knowledge + codemap + git + external sources
2. **Prompt Assembly** — build structured prompt from all context
3. **Planning** — impact preview + approval required
4. **Execution** — single-agent or parallel sub-agents
5. **Reflection** — self-review before presenting to developer
6. **Verification** — acceptance gate
7. **Learning** — extract and persist knowledge for future tasks
8. **Output** — commit message + PR description + telemetry

## Extension v2 (5-Tab Sidebar)

| Tab | What It Shows |
|---|---|
| Task | Active task card, workflow progress, CLEAR score, task input |
| Knowledge | Module learnings, failed approaches, search |
| FPCR | First-Pass Completion Rate, team metrics, leaderboard |
| Map | Codebase intelligence, module tree, change coupling |
| Rules | Active rules, hooks, governance status |

## MCP Configuration

```json
{
  "mcpServers": {
    "steer-agent": {
      "command": "npx",
      "args": ["steer-agent-tool", "mcp"],
      "cwd": "/path/to/your/repo"
    }
  }
}
```

## Docs

- [Spec v3.0](.planning/SPEC-V3.md) — Full master specification
- [Setup](docs/SETUP.md) — Installation guide
- [Workflow](docs/WORKFLOW.md) — Daily usage
- [Pilot](docs/PILOT.md) — Metrics and success criteria

## Build

```bash
npm install
npm run build --workspaces
npm test
```

---

Built for CoinSwitch (14 devs). Architected to generalize.

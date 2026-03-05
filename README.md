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
# 1. Install (once per machine):
npm install -g @coinswitch/steer-agent
steer-agent install          # Registers MCP server + skills + hooks

# 2. Initialize (once per project):
cd ~/bitbucketRepo/your-project
steer-agent init --template coinswitch

# 3. Use (in Claude Code):
/steer-start Fix the null pointer in auth/TokenService

# Maintenance:
steer-agent status           # Check health
steer-agent doctor           # Auto-fix issues
steer-agent update           # Update to latest
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

`steer-agent install` writes this automatically to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "steer-agent": {
      "command": "steer-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

## CLI Reference

```
steer-agent install          Register MCP + skills + hooks (once per machine)
steer-agent init [options]   Initialize .steer/ in current project
steer-agent status           Show installation and project health
steer-agent doctor           Diagnose and auto-fix issues
steer-agent update           Update to latest version
steer-agent uninstall        Remove global components (keeps project data)
```

**Init options:**

```
--template coinswitch|minimal|strict   Governance preset (default: minimal)
--team <name>                           Team name
--org <name>                            Organization name
--force                                 Overwrite existing .steer/
```

## Governance Rules

Rules live in `.steer/RULES.md`. Three severities:

| Severity | Behavior |
|---|---|
| `[BLOCK]` | Hard stop — must get explicit approval to proceed |
| `[WARN]` | Warning shown — Claude may continue but must acknowledge |
| `[AUTO]` | Automatically enforced (e.g. lint before commit) |

Default CoinSwitch preset: scope restriction, auth/payments guard, test coverage, repository pattern, PR size limit, lint-on-commit.

## Docs

- [Spec v3.0](.planning/SPEC-V3.md) — Full master specification

## Build

```bash
npm install
npm run build --workspaces
npm test
```

---

Built for CoinSwitch (14 devs). Architected to generalize.

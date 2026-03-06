# SteerAgent

**AI workflow governance for engineering teams.** Wraps every AI coding session in a structured 8-step workflow — context gathering, planning, execution, reflection, verification, and compounding knowledge. No prompting skill required.

> ESLint enforces code quality. SteerAgent enforces AI collaboration quality.

## The Problem

| Without SteerAgent | With SteerAgent |
|---|---|
| Vague prompt → 5-7 iterations | Structured questions → 1-2 iterations |
| Context manually typed | Auto-loaded from codebase, Jira, Sentry, git |
| Expensive model for trivial tasks | Deterministic routing to right tier |
| Knowledge lost each session | Compounds across team in git |
| No measurement | FPCR dashboard + telemetry |

---

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/apurv-6/steer-agent/main/install.sh | bash
```

Clones the repo, builds, installs globally, and registers MCP + hook + skills + extension automatically.

### Then initialize your project

```bash
# Once per repo
cd ~/your-project
steer-agent init --template coinswitch

# Restart Claude Code → type /steer-start
```

That's it. No manual settings.json editing. No symlink debugging.

---

## CLI Reference

```
steer-agent install [--no-ext] Re-register MCP + hook + skills + extension. --no-ext skips sidebar
steer-agent init [options]     Create .steer/ in current project
steer-agent status             Show global + project health
steer-agent doctor             Diagnose and auto-fix broken MCP/hooks/skills
steer-agent update             Update to latest version
steer-agent uninstall          Remove global components (keeps .steer/ project data)
```

**Init options:**
```
--template coinswitch|minimal|strict   Governance preset (default: minimal)
--team <name>                          Team name
--force                                Overwrite existing .steer/
```

---

## How It Works

### Architecture

```
Layer 3: Cursor / VS Code Extension  (5-tab sidebar — optional)
           ↕  read + MCP commands
Layer 2: MCP Server                  (workflow engine — owns all logic)
           ↕  reads/writes
Layer 1: .steer/ folder              (config, rules, knowledge — committed to git)
```

- Works in **any MCP host**: Cursor, VS Code, Claude Code, Windsurf, OpenCode, Gemini CLI
- Extension is optional — full functionality via MCP alone

### 8-Step Workflow

Every task runs through the same pipeline:

```
1. Context      — codebase map + RAG + knowledge files + git + Jira/Sentry
2. Prompt       — structured template assembled from all context
3. Plan         — impact preview + file scope + sub-agent split decision
4. Execute      — single agent or parallel sub-agents (file-isolated)
5. Reflect      — self-review: plan coverage, scope, acceptance criteria
6. Verify       — acceptance gate checklist
7. Learn        — extract patterns → persist to .steer/knowledge/
8. Output       — commit message + PR description + FPCR telemetry
```

### Governance Rules

Rules live in `.steer/RULES.md`:

| Severity | Behavior |
|---|---|
| `[BLOCK]` | Hard stop — explicit approval required |
| `[WARN]` | Warning surfaced — acknowledged before proceeding |
| `[AUTO]` | Enforced automatically (e.g. lint before commit) |

CoinSwitch preset includes: scope restriction, auth/payments module guard, test coverage, repository pattern, PR size limit, lint-on-commit.

---

## Extension Sidebar (5 Tabs)

| Tab | What It Shows |
|---|---|
| Task | Active task, workflow progress, model tier, CLEAR score |
| Knowledge | Module learnings, failed approaches, searchable |
| FPCR | First-Pass Completion Rate, avg rounds, task history chart |
| Map | Codebase intelligence, module tree, change coupling |
| Rules | Active rules, hook status, governance overview |

Installed automatically. Skip with: `steer-agent install --no-ext`

---

## Slash Commands (16 skills)

After install, these work in Claude Code chat:

```
/steer-start     Begin a new task (mode picker → context → plan)
/steer-plan      Create execution plan with impact preview
/steer-execute   Execute approved plan
/steer-verify    Run acceptance gate
/steer-learn     Extract and persist learnings
/steer-commit    Generate Conventional Commits message
/steer-pr        Generate PR description
/steer-status    Show current task progress
/steer-map       Rebuild codebase map
/steer-gate      Score a prompt (CLEAR dimensions)
/steer-impact    Preview change impact for files
/steer-resume    Resume an interrupted task
/steer-similar   Find similar past tasks
/steer-knowledge Search/view knowledge files
/steer-init      Initialize .steer/ (alias for CLI)
```

---

## Project Structure

```
.steer/                   ← committed to git
  config.json             ← routing rules, model policy, integrations
  RULES.md                ← governance rules (BLOCK / WARN / AUTO)
  hooks.yaml              ← lifecycle hooks (pre-context, post-plan, post-execute)
  templates/              ← prompt templates per mode (bugfix, feature, refactor...)
  knowledge/              ← compounding team knowledge (grows with every task)
  state/                  ← runtime state (gitignored)
    current-task.json     ← single source of truth for active task
    history.jsonl         ← FPCR telemetry
    learnings.jsonl       ← raw learning entries
```

---

## MCP Server Config

`steer-agent install` writes this automatically to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "steer-agent": {
      "command": "node",
      "args": ["/path/to/steer-agent/dist/mcp-entry.js"]
    }
  }
}
```

14 MCP tools: `steer.init` `steer.start` `steer.plan` `steer.execute` `steer.verify` `steer.status` `steer.map` `steer.impact` `steer.resume` `steer.similar` `steer.commit` `steer.pr` `steer.learn` `steer.knowledge`

---

## Monorepo Layout

```
packages/
  core/              @steer-agent-tool/core — scoring, routing, RAG, state, codemap
  mcp-server/        MCP server (14 tools)
  cli/               @coinswitch/steer-agent — published CLI package
  cursor-extension/  VS Code / Cursor sidebar extension
```

```bash
npm install
npm run build          # build all packages
npm test               # run tests (vitest)
npm run link:cli       # link CLI globally for local testing
npm run publish:cli    # build + publish to Artifactory
```

---

## Key Metric: FPCR

**First-Pass Completion Rate** = tasks completed in ≤ 2 rounds / total tasks × 100%

- Target: 70%+ after 60-day Phase 2 rollout
- Measured per developer, per team, per mode
- Visible in the FPCR tab and `steer-agent status`

---

Built for CoinSwitch (14 devs). Architected to generalize.

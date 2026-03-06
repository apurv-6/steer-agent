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

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | >= 18.0.0 | Check: `node --version` |
| **npm** | any (bundled with Node) | Check: `npm --version` |
| **git** | any recent | For cloning during install |
| **OS** | macOS or Linux | Windows not supported |
| **Claude Code** | any | Or any MCP-compatible host (Cursor, VS Code, Windsurf, etc.) |

---

## Installation

### Option 1: One-Line Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/apurv-6/steer-agent/main/install.sh | bash
```

This will:
1. Verify Node.js >= 18 and npm are installed
2. Clone the repo, install dependencies, and build all packages
3. Install the CLI globally via `npm install -g`
4. Create stable symlinks in `/usr/local/bin` (works across nvm version switches)
5. Auto-register MCP server, hook, and skills in `~/.claude/settings.json`
6. Install the Cursor/VS Code sidebar extension

To also install the Cursor sidebar extension explicitly:
```bash
bash install.sh --ext
```

To install from a specific branch or tag:
```bash
bash install.sh --ref develop
```

### Option 2: Manual Install (From Source)

```bash
# 1. Clone the repo
git clone https://github.com/apurv-6/steer-agent.git
cd steer-agent

# 2. Install dependencies
npm install

# 3. Build all packages (order matters)
npm run build

# 4. Install CLI globally
cd packages/cli
npm pack
npm install -g ./coinswitch-steer-agent-*.tgz

# 5. Register MCP, hook, skills, and extension
steer-agent install
```

### Option 3: npm Link (For Local Development)

```bash
git clone https://github.com/apurv-6/steer-agent.git
cd steer-agent
npm install
npm run build
npm run link:cli    # links CLI globally from source
steer-agent install # register MCP + hooks + skills + extension
```

---

## Post-Install Setup

### 1. Verify the installation

```bash
steer-agent --version     # should print version
steer-agent doctor        # diagnoses and auto-fixes issues
```

If `steer-agent` is not found, add npm's global bin to your PATH:

```bash
# Find the binary location
npm prefix -g

# Add to your shell profile (~/.zshrc, ~/.bashrc, etc.)
export PATH="$(npm prefix -g)/bin:$PATH"
```

**nvm users:** The installer creates symlinks in `/usr/local/bin` so the binary survives nvm version switches. If you switch Node versions and things break, re-run:
```bash
steer-agent install
```

### 2. Initialize your project

```bash
cd ~/your-project
steer-agent init --template coinswitch
```

### 3. Restart Claude Code and start using it

```bash
# In Claude Code chat:
/steer-start
```

---

## What Gets Installed

The installer registers these components in `~/.claude/settings.json`:

### MCP Server
```json
{
  "mcpServers": {
    "steer-agent": {
      "command": "node",
      "args": ["/absolute/path/to/dist/mcp-entry.js"]
    }
  }
}
```

### UserPromptSubmit Hook
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [{
          "type": "command",
          "command": "node /absolute/path/to/hooks/prompt-submit.js",
          "timeout": 5000
        }]
      }
    ]
  }
}
```

### Skills
14 slash commands symlinked to `~/.claude/skills/`:
```
steer, steer-start, steer-plan, steer-execute, steer-verify,
steer-commit, steer-pr, steer-gate, steer-map, steer-impact,
steer-resume, steer-similar, steer-learn, steer-knowledge, steer-init
```

### Extension (Optional)
`.vsix` installed into Cursor or VS Code via `cursor --install-extension` or `code --install-extension`.

---

## CLI Reference

```
steer-agent install [--no-ext] [--force]   Register MCP + hook + skills + extension
steer-agent init [options]                 Create .steer/ in current project
steer-agent status                         Show global + project health
steer-agent doctor                         Diagnose and auto-fix broken MCP/hooks/skills
steer-agent update                         Update to latest version
steer-agent uninstall                      Remove global components (keeps .steer/ project data)
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
           |  read + MCP commands
Layer 2: MCP Server                  (workflow engine — owns all logic)
           |  reads/writes
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

## Slash Commands

After install, these work in Claude Code chat:

```
/steer-start     Begin a new task (mode picker -> context -> plan)
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
.steer/                   <- committed to git
  config.json             <- routing rules, model policy, integrations
  RULES.md                <- governance rules (BLOCK / WARN / AUTO)
  hooks.yaml              <- lifecycle hooks (pre-context, post-plan, post-execute)
  templates/              <- prompt templates per mode (bugfix, feature, refactor...)
  knowledge/              <- compounding team knowledge (grows with every task)
  state/                  <- runtime state (gitignored)
    current-task.json     <- single source of truth for active task
    history.jsonl         <- FPCR telemetry
    learnings.jsonl       <- raw learning entries
```

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
npm install            # install all workspace dependencies
npm run build          # build all packages (core -> mcp-server -> extension -> cli)
npm test               # run tests (vitest)
npm run link:cli       # link CLI globally for local development
npm run publish:cli    # build + publish to registry
```

---

## Troubleshooting

### `steer-agent: command not found`

```bash
# Check where npm installed it
npm prefix -g

# Add to your shell profile and restart terminal
echo 'export PATH="$(npm prefix -g)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Hook format warnings on Claude Code startup

If you see `hooks: Expected array, but received undefined`, your hooks are in the old format. Fix:
```bash
steer-agent install --force
```

Or run the auto-fixer:
```bash
steer-agent doctor
```

### MCP server not connecting

```bash
steer-agent doctor    # auto-detects and fixes registration
steer-agent install   # re-registers everything
```

Then restart Claude Code.

### Extension not showing in Cursor sidebar

```bash
# Re-install the extension
steer-agent install

# Or manually:
# Cmd+Shift+P -> "Extensions: Install from VSIX"
# Select the .vsix from packages/cursor-extension/
```

### After switching Node versions (nvm)

The installer creates stable symlinks, but if they break:
```bash
steer-agent install --force
```

### Skills not appearing as slash commands

```bash
steer-agent doctor    # fixes broken symlinks
# Then restart Claude Code
```

---

## Key Metric: FPCR

**First-Pass Completion Rate** = tasks completed in <= 2 rounds / total tasks x 100%

- Target: 70%+ after 60-day Phase 2 rollout
- Measured per developer, per team, per mode
- Visible in the FPCR tab and `steer-agent status`

---

Built for CoinSwitch (14 devs). Architected to generalize.

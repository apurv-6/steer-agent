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

`steer-agent install` registers **5 components** in a single command:

| Component | Location | Purpose |
|---|---|---|
| **MCP Server** | `~/.claude/settings.json` → `mcpServers.steer-agent` | Workflow engine — 14 tools |
| **Hook** | `~/.claude/settings.json` → `hooks.UserPromptSubmit` | Context injection on every prompt |
| **Skills** | `~/.claude/skills/steer-*` (16 symlinks) | Slash commands (`/steer-start`, `/steer-plan`, etc.) |
| **Commands** | `~/.claude/commands/steer/` (symlink) | Command definitions with allowed-tools |
| **Extension** | Cursor/VS Code | 5-tab sidebar (optional) |

All paths use absolute references so the install works regardless of nvm version or shell.

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

### Skills (16 slash commands)
```
steer, steer-start, steer-plan, steer-execute, steer-verify,
steer-commit, steer-pr, steer-gate, steer-map, steer-impact,
steer-resume, steer-similar, steer-learn, steer-knowledge,
steer-init, steer-status
```

### Extension (Optional)
`.vsix` installed into Cursor or VS Code via `cursor --install-extension` or `code --install-extension`.

---

## High-Level Design (HLD)

### Architecture — 3 Layers

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: IDE Extension (Cursor / VS Code)              │
│  packages/cursor-extension/src/                         │
│  ├── extension.ts          — activation, MCP client     │
│  ├── panels/sidebar.ts     — 5-tab webview UI           │
│  └── SessionState.ts       — extension state mgmt       │
│  Role: Read-only dashboard. Calls MCP for all actions.  │
└──────────────────────┬──────────────────────────────────┘
                       │ MCP protocol (stdio)
┌──────────────────────▼──────────────────────────────────┐
│  Layer 2: MCP Server (workflow engine)                  │
│  packages/mcp-server/src/                               │
│  ├── index.ts              — server setup, tool registry│
│  └── tools/                                             │
│      ├── start.ts          — context gathering          │
│      ├── plan.ts           — planning + impact preview  │
│      ├── execute.ts        — execution tracking         │
│      ├── verify.ts         — acceptance gate            │
│      └── learn.ts          — knowledge extraction       │
│  Role: Owns ALL logic. Reads/writes .steer/ state.      │
└──────────────────────┬──────────────────────────────────┘
                       │ reads/writes filesystem
┌──────────────────────▼──────────────────────────────────┐
│  Layer 1: .steer/ folder (project config + state)       │
│  .steer/                                                │
│  ├── config.json           — routing, model policy      │
│  ├── RULES.md              — governance (BLOCK/WARN/AUTO│
│  ├── templates/            — prompt templates per mode  │
│  ├── knowledge/            — compounding learnings (git)│
│  └── state/                — runtime (gitignored)       │
│      ├── current-task.json — materialized task state     │
│      ├── events.jsonl      — append-only event log       │
│      ├── history.jsonl     — FPCR telemetry             │
│      └── steer.log         — execution log              │
└─────────────────────────────────────────────────────────┘
```

**Key rule:** MCP owns all logic. Extension NEVER writes to `.steer/` directly. Works 100% without the extension.

### Core Engine

```
packages/core/src/
├── start.ts             — task initialization, context assembly
├── completion.ts        — model routing + tier selection
├── generateFollowUps.ts — follow-up question generation
├── promptAssembler.ts   — template + RAG + context → final prompt
├── events.ts            — 14 event types (discriminated union)
├── eventStore.ts        — append-only event log + materialized state
├── gitBranch.ts         — git branch per attempt execution
├── rag/
│   ├── chunker.ts       — splits files into chunks + keyword extraction
│   ├── indexer.ts       — TF-IDF index builder (buildIndex/loadIndex)
│   └── retriever.ts     — keyword search over index (top-8 chunks)
├── scoring.ts           — CLEAR score calculation
├── codemap.ts           — codebase intelligence
└── state.ts             — current-task.json read/write
```

### Event Sourcing

Every state mutation emits an event to `.steer/state/events.jsonl` (append-only JSONL). `current-task.json` is a **materialized view** rebuilt on each emit — the extension sidebar continues polling it unchanged.

14 event types: `task_created`, `step_started`, `step_completed`, `rag_retrieved`, `model_routed`, `gate_scored`, `plan_created`, `plan_approved`, `execution_started`, `execution_attempt_failed`, `hook_executed`, `verification_completed`, `learning_extracted`, `task_completed`.

Events enable replay (`replayEvents`), state reconstruction (`materializeState`), auditing, and debugging without losing history.

### Git Branch Execution (Optional)

When enabled in `.steer/config.json`, Step 4 (Execution) creates an isolated git branch per attempt:

```json
{
  "execution": {
    "gitBranch": true,
    "maxAttempts": 3,
    "mergeStrategy": "squash"
  }
}
```

**Flow:** `steer.execute` creates `steer/{taskId}-attempt-{n}` → AI writes code on branch → `steer.verify` runs build+lint+test → **pass**: squash merge back to origin → **fail**: delete branch, create new attempt (up to `maxAttempts`).

### 8-Step Workflow — Data Flow

Every task follows the same governed pipeline. Each step has a mandatory MCP tool call (except Step 5 and 8).

```
  User types /steer-start "fix auth bug"
  │
  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 1: CONTEXT                          MCP: steer_start           │
│                                                                      │
│ Trigger:  /steer-start or /steer skill                              │
│ Input:    task description, mode (inferred from keywords)           │
│ Process:                                                             │
│   core/start.ts         → initialize task state                     │
│   core/rag/indexer.ts   → load/build TF-IDF index                   │
│   core/rag/retriever.ts → search index → top 8 relevant chunks     │
│   core/codemap.ts       → module tree, change coupling              │
│   .steer/knowledge/     → load team learnings for this module       │
│   .steer/templates/     → load prompt template for mode             │
│ Output:   current-task.json created, context assembled              │
│ State:    .steer/state/current-task.json { status: "context" }      │
└──────────────────────┬───────────────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 2: GATE                             MCP: steer_gate            │
│                                                                      │
│ Input:    draft prompt, mode, taskId                                │
│ Process:                                                             │
│   core/scoring.ts       → CLEAR score (Context, Length, Examples,   │
│                            Accuracy, Requirements) — deterministic  │
│   core/generateFollowUps.ts → generate clarifying questions         │
│   core/completion.ts    → route to model tier (haiku/sonnet/opus)   │
│ Output:   score (1-10), tier recommendation, follow-ups             │
│ Gate:     score <= 3 = BLOCKED, 4-6 = NEEDS_INFO, 7+ = PASS        │
│ State:    current-task.json { status: "gated", score, tier }        │
└──────────────────────┬───────────────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 3: PLANNING                         MCP: steer_plan            │
│                                                                      │
│ Input:    taskId, goal, files, acceptance criteria                   │
│ Process:                                                             │
│   mcp-server/tools/plan.ts → impact analysis on target files        │
│   .steer/RULES.md          → check governance rules (BLOCK/WARN)    │
│   core/codemap.ts          → dependency graph for scope validation  │
│ Output:   execution plan with file list + acceptance criteria       │
│ Gate:     WAIT for user approval before proceeding                  │
│ State:    current-task.json { status: "planned", plan: {...} }      │
└──────────────────────┬───────────────────────────────────────────────┘
                       ▼  (user approves)
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 4: EXECUTION                        MCP: steer_execute         │
│                                                                      │
│ Input:    taskId, approved: true                                    │
│ Process:                                                             │
│   AI agent makes code changes per approved plan                     │
│   mcp-server/tools/execute.ts → log execution start/end            │
│   .steer/RULES.md             → enforce AUTO rules (lint, tests)   │
│ Output:   code changes applied                                      │
│ State:    current-task.json { status: "executed" }                  │
└──────────────────────┬───────────────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 5: REFLECTION                       (no MCP call)              │
│                                                                      │
│ Process:  AI self-reviews changes vs acceptance criteria            │
│           Checks: plan coverage, scope creep, edge cases            │
│ Output:   gaps/risks identified                                     │
└──────────────────────┬───────────────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 6: VERIFICATION                     MCP: steer_verify          │
│                                                                      │
│ Input:    taskId, cwd                                               │
│ Process:                                                             │
│   mcp-server/tools/verify.ts → run acceptance checklist             │
│   Run tests (npm test / vitest)                                     │
│   Compare behavior: before vs after                                 │
│ Output:   pass/fail per acceptance criterion                        │
│ State:    current-task.json { status: "verified", results: [...] }  │
└──────────────────────┬───────────────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 7: LEARNING                         MCP: steer_learn           │
│                                                                      │
│ Input:    taskId, cwd                                               │
│ Process:                                                             │
│   mcp-server/tools/learn.ts → extract patterns from completed task │
│   .steer/knowledge/         → persist learnings (committed to git) │
│   .steer/state/learnings.jsonl → append raw entry                  │
│ Output:   knowledge entries saved                                   │
│ State:    current-task.json { status: "learned" }                   │
└──────────────────────┬───────────────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 8: OUTPUT                           (no MCP call)              │
│                                                                      │
│ Process:  Summarize what changed, files modified, verification      │
│           Generate commit message (/steer-commit)                   │
│           Generate PR description (/steer-pr)                       │
│           Log FPCR telemetry to history.jsonl                       │
│ Output:   task complete, knowledge compounded                       │
│ State:    current-task.json { status: "complete" }                  │
└──────────────────────────────────────────────────────────────────────┘
```

### Hook: UserPromptSubmit

Runs on **every** user prompt (before AI responds):

```
User types message
  │
  ▼
packages/cli/src/hooks/prompt-submit.ts
  │
  ├── Reads .steer/state/current-task.json
  ├── Injects active task context into prompt
  └── Returns { "result": "Success" }
```

### RAG Pipeline

```
Build (once per project):
  core/rag/chunker.ts    → split all project files into chunks
  core/rag/indexer.ts    → extract keywords → build TF-IDF index
  Output: .steer/embeddings/index.json (468 chunks, 2006 keywords)

Query (every steer_start):
  core/rag/retriever.ts  → keyword search → top 8 chunks by TF-IDF score
  core/promptAssembler.ts → inject chunks into prompt template
```

### Governance Engine

```
.steer/RULES.md defines rules with severity:
  [BLOCK]  → hard stop, requires explicit approval
  [WARN]   → warning surfaced, must acknowledge
  [AUTO]   → enforced automatically (lint, test)

Checked at:
  Step 3 (Planning)  → BLOCK/WARN rules checked against file scope
  Step 4 (Execution) → AUTO rules enforced (lint before commit)
  Step 6 (Verify)    → all rules re-checked against final changes
```

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
/steer-start     Begin a new task (auto-detects mode → full 8-step workflow)
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
    current-task.json     <- materialized task state
    events.jsonl          <- append-only event log
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

# SteerAgent Setup Guide

Get from zero to working in under 5 minutes.

---

## Prerequisites

| Requirement | Check |
|---|---|
| Node.js >= 18 | `node -v` |
| npm access to CoinSwitch Artifactory | `npm ping --registry https://artifactory.coinswitch.co/npm/` |
| Claude Code | Already installed |

---

## Step 1 — Configure npm registry (one-time per machine)

```bash
npm config set @coinswitch:registry https://artifactory.coinswitch.co/npm/
```

If your team uses an `.npmrc` file in a shared repo, this may already be configured.

---

## Step 2 — Install the package (one-time per machine)

```bash
npm install -g @coinswitch/steer-agent
```

Verify:

```bash
steer-agent --version
# steer-agent v0.1.0
```

---

## Step 3 — Register MCP + skills + hooks (one-time per machine)

```bash
steer-agent install
```

Expected output:

```
⚡ Installing SteerAgent...

  MCP Server
  └── ✅ steer-agent MCP server registered

  Skills
  └── ✅ 16 skills installed

  Hooks
  └── ✅ Hook registered

  VS Code / Cursor Extension
  └── ✅ Extension installed via cursor
```

This writes to `~/.claude/settings.json` — Claude Code picks it up automatically on next launch.

---

## Step 4 — Initialize your project (once per project)

```bash
cd ~/bitbucketRepo/your-project
steer-agent init --template coinswitch
```

Expected output:

```
⚡ Initializing SteerAgent in your-project...

  Created:
  ├── .steer/config.json
  ├── .steer/RULES.md
  ├── .steer/hooks.yaml
  ├── .steer/templates/
  └── .steer/state/ (gitignored)
```

**Commit `.steer/` to git** so your team shares the same rules:

```bash
git add .steer/
git commit -m "chore: add SteerAgent workflow governance"
```

---

## Step 5 — Verify everything works

```bash
steer-agent status
```

You should see:

```
GLOBAL (machine-wide):
  ✅  MCP Server  steer-mcp registered
  ✅  Skills  16 installed
  ✅  Hooks  UserPromptSubmit registered

PROJECT (your-project):
  ✅  .steer/ found
  ✅  Config  v3.0, team: mobile-eng, org: CoinSwitch
  ✅  Rules  7 rules

HEALTH: All systems operational ✅
```

---

## Step 6 — Use it

Open Claude Code in your project and type:

```
/steer-start Fix the null pointer in auth/TokenService
```

SteerAgent will:
1. Gather context from your codebase and `.steer/knowledge/`
2. Score your prompt with CLEAR
3. Route to the appropriate model tier
4. Run through the 8-step governed workflow
5. Save learnings for next time

---

## Daily Usage

| Task | Command |
|---|---|
| Start a task | `/steer-start <description>` |
| Check progress | `/steer-status` |
| Resume interrupted task | `/steer-resume` |
| Generate commit message | `/steer-commit` |
| Generate PR description | `/steer-pr` |
| Search knowledge base | `/steer-knowledge <query>` |

---

## Troubleshooting

### Run doctor first

```bash
steer-agent doctor
```

Doctor auto-fixes common issues (broken skill symlinks, missing hook registration, stale codebase map).

### MCP server not connecting

```bash
# Check it's registered:
cat ~/.claude/settings.json | grep steer

# Re-register:
steer-agent install --force
```

### Skills not showing in Claude Code

```bash
# Re-install skills:
steer-agent install --force

# Verify:
ls ~/.claude/skills/ | grep steer
```

### `.steer/` not found errors

Make sure you're in a project that has been initialized:

```bash
steer-agent init --template coinswitch
```

### Updating to latest version

```bash
steer-agent update
```

---

## Available Init Templates

| Template | Use case |
|---|---|
| `coinswitch` | CoinSwitch projects — auth/payments guard, no raw SQL, lint-on-commit |
| `minimal` | Any project — just scope restriction and test warning |
| `strict` | High-risk projects — all rules as BLOCK, 100% coverage required |

---

## What gets committed vs gitignored

```
COMMITTED (shared with team):
  .steer/config.json          ← Team configuration
  .steer/RULES.md             ← Governance rules
  .steer/hooks.yaml           ← Lifecycle hooks
  .steer/templates/*.md       ← Prompt templates
  .steer/knowledge/*.md       ← Team knowledge base

GITIGNORED (local only):
  .steer/state/               ← Runtime state files
  .steer/embeddings/          ← RAG index
  .steer/codebase-map.json    ← Rebuilt automatically
```

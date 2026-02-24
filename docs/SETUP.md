# SteerAgent Setup Guide

Get from zero to working in 15 minutes. This guide targets the CoinSwitch pilot (14 developers).

## Prerequisites

- **Node.js** >= 18 (`node -v` to check)
- **Cursor IDE** (latest version with hooks support)
- **Git** (for git impact analysis)

## Step 1: Clone and Build

```bash
git clone git@github.com:apurv-6/steer-agent.git steer-agent
cd steer-agent
npm install
npm run build --workspaces
```

This builds all 4 packages: `core`, `mcp-server`, `cli`, `cursor-extension`.

Verify the build:

```bash
npx vitest run          # 54 tests should pass
bash hooks/demo.sh      # 3 gate calls: BLOCKED, NEEDS_INFO, READY
```

## Step 2: Install Cursor Extension

```bash
cd packages/cursor-extension
npm run package
cursor --install-extension steer-agent-extension-0.1.0.vsix
```

After install, restart Cursor. You should see **"Steer Agent"** in the Activity Bar with two panels:

- **Status Panel** -- score, status badge, mode, model tier, gate call count
- **Wizard Panel** -- follow-ups, patched prompt, model routing, Copy Prompt button

## Step 3: Configure Cursor Hook

The hook gates every prompt submission automatically.

```bash
cp hooks/cursor-hooks.example.json ~/.cursor/hooks.json
```

Then edit `~/.cursor/hooks.json` and update the path to match your installation:

```json
{
  "hooks": {
    "beforeSubmitPrompt": [{
      "type": "command",
      "command": "node /absolute/path/to/steer-agent/hooks/steer-gate-hook.js",
      "timeout": 5000
    }]
  }
}
```

**Blocking policy:**

| Score   | Status     | Behavior                              |
| ------- | ---------- | ------------------------------------- |
| <= 3    | BLOCKED    | Prompt rejected, must improve         |
| 4-6     | NEEDS_INFO | Prompt allowed, guidance shown        |
| >= 7    | READY      | Prompt allowed silently               |

## Step 4: Configure MCP Server

Add to your Cursor MCP settings (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "steer": {
      "command": "node",
      "args": ["/absolute/path/to/steer-agent/packages/mcp-server/dist/index.js"]
    }
  }
}
```

The MCP server exposes one tool: `steer.gate` which accepts:

| Parameter        | Type     | Required | Description                        |
| ---------------- | -------- | -------- | ---------------------------------- |
| `draftPrompt`    | string   | Yes      | The prompt to evaluate             |
| `mode`           | enum     | Yes      | dev/debug/bugfix/design/refactor   |
| `taskId`         | string   | No       | Reuse across turns for session     |
| `turnId`         | number   | No       | Increment on re-evaluate           |
| `answers`        | object   | No       | Follow-up answers                  |
| `gitDiffStat`    | string   | No       | Output of `git diff --stat`        |
| `gitDiffNameOnly`| string   | No       | Output of `git diff --name-only`   |
| `criticalPaths`  | string[] | No       | From `criticalModules.json`        |

## Step 5: Verify Everything Works

### 5a. Hook test

```bash
echo '{"prompt":"fix it"}' | node hooks/steer-gate-hook.js
# Expected: {"continue":false,...} (BLOCKED)

echo '{"prompt":"## GOAL\nAdd auth\n## LIMITS\nOnly src/auth\n## REVIEW\nTests pass"}' | node hooks/steer-gate-hook.js
# Expected: {"continue":true,...} (READY)
```

### 5b. Full demo

```bash
bash hooks/demo.sh
# Shows 3 cases: BLOCKED -> NEEDS_INFO -> READY
```

### 5c. Extension check

1. Open Cursor
2. Open the Steer Agent panel in the Activity Bar
3. Run command: `Steer Agent: Suggest`
4. Enter a draft prompt -- you should see score, status, and follow-ups

### 5d. MCP check

In Cursor chat, type: `/steer evaluate my prompt: fix the bug`

You should see a gate result with score, status, and model suggestion.

## Troubleshooting

### Hook not firing

- Verify `~/.cursor/hooks.json` exists and has correct absolute path
- Test manually: `echo '{"prompt":"test"}' | node /path/to/hooks/steer-gate-hook.js`
- Check Cursor version supports `beforeSubmitPrompt` hooks

### MCP not connecting

- Verify `~/.cursor/mcp.json` has correct absolute path to `dist/index.js`
- Rebuild: `cd packages/mcp-server && npm run build`
- Test: `cd packages/mcp-server && npm run smoke`

### Extension not showing

- Rebuild: `cd packages/cursor-extension && npm run package`
- Reinstall: `cursor --install-extension steer-agent-extension-0.1.0.vsix`
- Check Output panel > "Steer Agent" for error messages

### Permission errors on telemetry

- Extension writes to Cursor's `globalStorageUri` (managed by Cursor, no manual config)
- CLI writes to `./data/telemetry.jsonl` relative to working directory

## Environment Variables

| Variable              | Default | Description                     |
| --------------------- | ------- | ------------------------------- |
| `STEER_MODE`          | `dev`   | Override mode for hook           |
| `STEER_DRAFT_PROMPT`  | --      | Fallback prompt if stdin empty   |

## Critical Modules Config

Create `criticalModules.json` in your project root to flag sensitive paths:

```json
{
  "paths": [
    "src/auth",
    "src/payments",
    "src/core/security"
  ]
}
```

When git diff touches these paths, the model router upgrades to a stronger tier automatically.

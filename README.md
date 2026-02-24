# SteerAgent

**Prompt quality gate for AI coding agents.** Scores your prompts, suggests improvements, routes to the right model tier, and blocks weak prompts before they waste tokens.

Built for teams using Cursor IDE with AI coding workflows.

## What it does

Before your prompt reaches an LLM, SteerAgent evaluates it:

| Score | Status      | What happens                          |
|-------|-------------|---------------------------------------|
| 1-3   | BLOCKED     | Prompt rejected - must improve first  |
| 4-6   | NEEDS_INFO  | Prompt allowed with guidance shown    |
| 7-10  | READY       | Prompt allowed silently               |

It checks for:
- Clear goal statement
- Scope limits (files, modules)
- Review criteria
- Context (git diff, file references)
- Appropriate model routing (save money on simple tasks)

## Quick Start (15 min)

```bash
git clone https://github.com/apurv-6/steer-agent.git
cd steer-agent
npm install
npm run build
```

Verify:
```bash
npx vitest run          # tests should pass
bash hooks/demo.sh      # 3 gate calls: BLOCKED -> NEEDS_INFO -> READY
```

Then follow [docs/SETUP.md](docs/SETUP.md) to install the Cursor extension, hook, and MCP server.

## Components

| Package | What it does |
|---------|-------------|
| `packages/core` | Scoring engine, prompt builder, follow-up generator, git impact analysis |
| `packages/mcp-server` | MCP server exposing `steer.gate` tool for Cursor chat |
| `packages/cursor-extension` | VS Code/Cursor sidebar with score display, follow-ups, and patched prompt |
| `packages/cli` | CLI for scripting and CI integration |
| `hooks/` | Cursor `beforeSubmitPrompt` hook that gates every prompt |

## How it works

```
Developer writes prompt
        |
        v
  [Cursor Hook / MCP / CLI]
        |
        v
  SteerAgent Gate
  - Score prompt (0-10)
  - Detect missing sections (GOAL, LIMITS, REVIEW, etc.)
  - Analyze git diff for blast radius
  - Check critical modules
  - Generate follow-up questions
  - Route to model tier (small/mid/high)
        |
        v
  BLOCKED / NEEDS_INFO / READY
```

## Integration Options

### 1. Cursor Hook (recommended - automatic)
Gates every prompt submission. Zero friction after install.

### 2. MCP Server
Use `@steer` in Cursor chat to evaluate prompts on demand.

### 3. CLI
```bash
echo "fix the bug" | npx steer-cli gate --mode dev
```

### 4. Critical Modules
Create `criticalModules.json` in your project root:
```json
{
  "paths": ["src/auth", "src/payments", "src/core/security"]
}
```
When git diff touches these paths, model routing auto-upgrades.

## Docs

- [Setup Guide](docs/SETUP.md) - Full installation for your team
- [Workflow Guide](docs/WORKFLOW.md) - How to use SteerAgent day-to-day
- [Pilot Metrics](docs/PILOT.md) - What we measure and success criteria
- [Debug Guide](docs/DEBUG.md) - Troubleshooting

## Architecture

```
core (shared library)
 ├── mcp-server
 ├── cursor-extension
 └── cli
```

TypeScript monorepo with npm workspaces. `core` is the only shared dependency.

## License

Private - internal use only.

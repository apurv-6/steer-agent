# Codebase Structure

**Analysis Date:** 2026-02-24

## Directory Layout

```
steer-agent-tool/
├── packages/                    # Monorepo packages
│   ├── core/                    # Shared library (pure functions)
│   │   └── src/
│   │       ├── __tests__/       # Vitest unit tests
│   │       ├── types.ts         # Shared type definitions
│   │       ├── index.ts         # Public API exports
│   │       ├── scorePrompt.ts   # Prompt scoring logic
│   │       ├── buildPrompt.ts   # Prompt restructuring
│   │       ├── generateFollowUps.ts  # Follow-up question generation
│   │       ├── extractFileRefs.ts    # @reference extraction
│   │       ├── routeModel.ts    # Model tier routing
│   │       ├── estimateTokens.ts     # Token estimation
│   │       └── telemetry.ts     # JSONL telemetry writer
│   ├── cli/                     # Command-line interface
│   │   └── src/
│   │       ├── index.ts         # CLI entry point
│   │       ├── steer.ts         # Interactive steer command
│   │       ├── gateAdapter.ts   # Gate orchestration (duplicated)
│   │       └── metrics.ts       # Telemetry aggregation
│   ├── mcp-server/              # Model Context Protocol server
│   │   └── src/
│   │       ├── index.ts         # MCP server entry
│   │       ├── gate.ts          # Gate orchestration (duplicated)
│   │       └── smoke.mjs        # Smoke test script
│   └── cursor-extension/        # VS Code/Cursor extension
│       └── src/
│           ├── extension.ts     # Extension entry point
│           ├── SessionState.ts  # State management
│           ├── gateClient.ts    # Gate orchestration (duplicated)
│           ├── StatusPanel.ts   # Status webview
│           └── WizardPanel.ts   # Wizard webview
├── data/                        # Runtime data (gitignored)
│   └── telemetry.jsonl          # Telemetry events
├── .cursor/                     # Cursor IDE config
│   └── commands/                # Custom commands
├── package.json                 # Workspace root
└── package-lock.json
```

## Directory Purposes

**`packages/core/`:**
- Purpose: Zero-dependency library with prompt analysis logic
- Contains: Pure TypeScript functions, type definitions, unit tests
- Key files: `scorePrompt.ts` (scoring algorithm), `buildPrompt.ts` (prompt restructuring), `types.ts` (shared interfaces)
- Build: tsup → ESM + CJS + .d.ts

**`packages/cli/`:**
- Purpose: Command-line interface for interactive prompt steering
- Contains: CLI entry, interactive REPL, telemetry viewer
- Key files: `index.ts` (command router), `steer.ts` (interactive flow)
- Build: tsup → ESM binary

**`packages/mcp-server/`:**
- Purpose: MCP server exposing `steer.gate` tool
- Contains: MCP SDK integration, gate handler
- Key files: `index.ts` (server setup), `gate.ts` (tool implementation)
- Build: tsup → ESM

**`packages/cursor-extension/`:**
- Purpose: VS Code/Cursor extension with UI integration
- Contains: Extension activation, commands, chat participant, webviews
- Key files: `extension.ts` (activation), `SessionState.ts` (state management)
- Build: esbuild → single JS bundle

**`data/`:**
- Purpose: Runtime telemetry storage
- Contains: JSONL event log
- Generated: Yes (by telemetry.ts)
- Committed: No (gitignored)

## Key File Locations

**Entry Points:**
- `packages/cli/src/index.ts`: CLI entry, routes to subcommands
- `packages/mcp-server/src/index.ts`: MCP server entry, registers tools
- `packages/cursor-extension/src/extension.ts`: VS Code activation

**Configuration:**
- `package.json`: Workspace root with npm workspaces config
- `packages/*/package.json`: Per-package dependencies and scripts
- `packages/core/tsup.config.ts`: Core build config
- `packages/mcp-server/tsup.config.ts`: MCP server build config
- `packages/cursor-extension/esbuild.js`: Extension build config

**Core Logic:**
- `packages/core/src/scorePrompt.ts`: Prompt quality scoring
- `packages/core/src/buildPrompt.ts`: Prompt restructuring with sections
- `packages/core/src/generateFollowUps.ts`: Clarifying question generation
- `packages/core/src/routeModel.ts`: Model tier routing rules

**Testing:**
- `packages/core/src/__tests__/*.test.ts`: Unit tests for core functions

## Naming Conventions

**Files:**
- `camelCase.ts`: All TypeScript source files
- `UPPERCASE.md`: Planning documents (ARCHITECTURE.md, etc.)
- Lowercase with hyphens: Config files (`tsup.config.ts`, `package.json`)

**Directories:**
- `lowercase`: All directories
- `__tests__`: Test directories (Jest/Vitest convention)

**Functions:**
- `camelCase`: All functions (`scorePrompt`, `buildPrompt`)
- Verb-first naming: `generate*`, `extract*`, `build*`, `derive*`

**Types:**
- `PascalCase`: All interfaces and type aliases (`ScoreResult`, `GateStatus`)

**Constants:**
- `SCREAMING_SNAKE_CASE`: Module-level constants (`VAGUE_VERBS`, `MAX_QUESTIONS`)

## Where to Add New Code

**New Core Function:**
- Implementation: `packages/core/src/newFunction.ts`
- Export: Add to `packages/core/src/index.ts`
- Tests: `packages/core/src/__tests__/newFunction.test.ts`
- Types: Add interfaces to `packages/core/src/types.ts`

**New CLI Command:**
- Implementation: `packages/cli/src/commandName.ts`
- Router: Add case in `packages/cli/src/index.ts`

**New MCP Tool:**
- Implementation: Add handler in `packages/mcp-server/src/index.ts`
- Register: Use `server.tool()` with schema

**New Extension Command:**
- Implementation: `packages/cursor-extension/src/extension.ts`
- Register: Add `vscode.commands.registerCommand()` call
- Manifest: Add to `contributes.commands` in `package.json`

**New Extension Webview:**
- Implementation: `packages/cursor-extension/src/PanelName.ts`
- Register: Add `vscode.window.registerWebviewViewProvider()` call
- Manifest: Add to `contributes.views` in `package.json`

**Utilities:**
- Shared helpers: `packages/core/src/` (if used across packages)
- Package-specific: `packages/*/src/` within the package

## Special Directories

**`node_modules/`:**
- Purpose: NPM dependencies (workspace-level hoisting)
- Generated: Yes (npm install)
- Committed: No

**`dist/`:**
- Purpose: Build output for each package
- Generated: Yes (npm run build)
- Committed: No

**`data/`:**
- Purpose: Runtime telemetry storage
- Generated: Yes (by telemetry.ts at runtime)
- Committed: No

**`.cursor/`:**
- Purpose: Cursor IDE configuration
- Contains: Custom commands
- Committed: Yes (project-specific config)

---

*Structure analysis: 2026-02-24*

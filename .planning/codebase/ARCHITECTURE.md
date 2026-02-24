# Architecture

**Analysis Date:** 2026-02-24

## Pattern Overview

**Overall:** Monorepo with layered package architecture

**Key Characteristics:**
- NPM workspaces monorepo with 4 packages
- Pure TypeScript codebase (ESM + CJS dual build for core)
- Shared core library consumed by all surface packages
- "Gate" system as the central orchestration abstraction
- No external database—telemetry stored as local JSONL files

## Layers

**Core Library (`packages/core`):**
- Purpose: Prompt analysis, scoring, and transformation logic
- Location: `packages/core/src/`
- Contains: Pure functions for scoring, building, routing prompts
- Depends on: Nothing (zero internal dependencies)
- Used by: All other packages (CLI, MCP server, Cursor extension)

**Surface Packages:**
- Purpose: Expose core functionality through different interfaces
- Location: `packages/cli/`, `packages/mcp-server/`, `packages/cursor-extension/`
- Contains: Entry points, adapters, UI components
- Depends on: `@steer-agent-tool/core`
- Used by: End users through CLI, MCP protocol, or VS Code/Cursor

**Gate Adapter Layer:**
- Purpose: Unified orchestration of core functions
- Location: `packages/*/src/gate*.ts`
- Contains: `gate()` function that combines scoring → follow-ups → patching → routing → cost estimation
- Depends on: Core library exports
- Used by: All surface packages (duplicated implementation)

## Package Dependency Graph

```
                ┌─────────────────┐
                │     @core       │ ← Zero dependencies
                └────────┬────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │ @mcp-server  │ │    @cli      │ │  extension   │
  │              │ │              │ │              │
  └──────────────┘ └──────┬───────┘ └──────────────┘
         ▲                │
         │                │
         └────────────────┘
              (cli starts mcp)
```

**Dependencies:**
- `@steer-agent-tool/core`: No internal deps
- `@steer-agent-tool/mcp-server`: core, @modelcontextprotocol/sdk, zod
- `@steer-agent-tool/cli`: core, mcp-server
- `steer-agent-tool-extension`: core, @types/vscode

## Data Flow

**Gate Flow (Central Pipeline):**

1. User provides `draftPrompt` + `mode`
2. `scorePrompt()` analyzes prompt structure → `ScoreResult`
3. `generateFollowUps()` creates clarifying questions → `FollowUp[]`
4. `deriveStatus()` maps score to `BLOCKED | NEEDS_INFO | READY`
5. `buildPrompt()` restructures prompt with GOAL/CONTEXT/LIMITS/OUTPUT FORMAT/REVIEW
6. `routeModel()` suggests model tier based on mode + score
7. `estimateTokens()` calculates cost estimate
8. Return unified `GateResult`

**State Management:**
- **Extension:** `SessionState` class with VS Code Memento persistence
- **CLI:** Stateless per-invocation, interactive loop rebuilds state
- **Telemetry:** Append-only JSONL file at `./data/telemetry.jsonl`

## Key Abstractions

**Mode:**
- Purpose: Task context that affects scoring and routing
- Definition: `packages/core/src/types.ts`
- Values: `"chat" | "code" | "review" | "plan" | "design" | "bugfix" | "debug"`
- Used by: `scorePrompt()`, `generateFollowUps()`, `routeModel()`

**ScoreResult:**
- Purpose: Analysis output from prompt scoring
- Definition: `packages/core/src/types.ts`
- Fields: `score` (0-10), `missing` (section names), `vagueFlags` (verb occurrences), `fileRefs` (@refs)
- Produced by: `scorePrompt()`
- Consumed by: `generateFollowUps()`, `buildPrompt()`

**GateResult:**
- Purpose: Complete evaluation result for a prompt
- Definition: `packages/*/src/gate*.ts` (duplicated)
- Fields: `status`, `score`, `missing`, `followupQuestions`, `patchedPrompt`, `modelSuggestion`, `costEstimate`
- Produced by: `gate()` / `callGate()`

**GateStatus:**
- Purpose: Traffic-light classification for prompt readiness
- Values: `"BLOCKED"` (score ≤ 3), `"NEEDS_INFO"` (score 4-6), `"READY"` (score ≥ 7)

## Entry Points

**CLI (`packages/cli/src/index.ts`):**
- Location: `packages/cli/src/index.ts`
- Triggers: `npx steer-agent-tool <command>`
- Commands: `steer` (interactive), `init` (setup), `mcp` (server), `metrics` (telemetry)
- Responsibilities: Parse args, delegate to command handlers

**MCP Server (`packages/mcp-server/src/index.ts`):**
- Location: `packages/mcp-server/src/index.ts`
- Triggers: stdio transport from Claude Desktop or CLI
- Responsibilities: Register `steer.gate` tool, handle JSON-RPC calls

**Cursor Extension (`packages/cursor-extension/src/extension.ts`):**
- Location: `packages/cursor-extension/src/extension.ts`
- Triggers: VS Code activation (`onStartupFinished`)
- Responsibilities: Register commands, chat participant, webview panels

## Error Handling

**Strategy:** Defensive with graceful fallbacks

**Patterns:**
- Score clamped to 0-10 range: `Math.max(0, Math.min(10, score))`
- Telemetry failures are swallowed: `.catch(() => {})`
- Missing mode defaults to `"code"`
- Clipboard copy failure shows manual alternative
- Patched prompt only generated if score ≥ 4

## Cross-Cutting Concerns

**Logging:** Console-based, minimal (extension logs activation)

**Validation:** Pattern-based prompt analysis (regex for sections, vague verbs, @refs)

**Authentication:** None (local-only tool)

**Telemetry:** Opt-in append-only JSONL with `applyToChat` events tracking task/score/model

---

*Architecture analysis: 2026-02-24*

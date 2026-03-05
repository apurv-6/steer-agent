# Integrations

## 4 Entry Points
1. **Hook** (`hooks/steer-gate-hook.js`) — CJS, stdin/stdout, Cursor `beforeSubmitPrompt`. Blocks score <= 3.
2. **MCP Server** (`packages/mcp-server/`) — `steer.gate` tool, JSON-RPC over stdio
3. **Extension** (`packages/cursor-extension/`) — StatusPanel + WizardPanel, @steer chat participant
4. **CLI** (`packages/cli/`) — `steer-agent-tool steer` interactive mode

## Gate Duplication (Tech Debt)
- Gate logic duplicated in mcp-server/gate.ts, cli/gateAdapter.ts, cursor-extension/gateClient.ts
- Canonical source: `packages/core/src/gate.ts`
- Consolidation tracked as known tech debt

## Model Routing
- Tiers: small (haiku), mid (sonnet), high (opus)
- Git-aware: critical modules in `criticalModules.json` trigger high tier
- `packages/core/src/routeModel.ts`

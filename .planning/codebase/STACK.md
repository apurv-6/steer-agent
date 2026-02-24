# Technology Stack

**Analysis Date:** 2026-02-24

## Languages

**Primary:**
- TypeScript 5.7.3 - All source code across all packages

**Secondary:**
- JavaScript (CommonJS) - `packages/cursor-extension/esbuild.js` build script
- JavaScript (ESM) - `packages/mcp-server/src/smoke.mjs` smoke test

## Runtime

**Environment:**
- Node.js >= 18 (required, validated in `packages/cli/src/index.ts`)

**Package Manager:**
- npm with workspaces
- Lockfile: `package-lock.json` present

## Module System

**Primary:**
- ES Modules (`"type": "module"`) - All packages except cursor-extension

**Exception:**
- CommonJS for VS Code extension (`packages/cursor-extension`) due to VS Code API requirements

## Frameworks

**Core:**
- No web framework - this is a developer tooling project

**MCP Server:**
- `@modelcontextprotocol/sdk` ^1.12.1 - Model Context Protocol server implementation

**VS Code/Cursor Extension:**
- VS Code Extension API ^1.85.0 - Cursor/VS Code extension platform

**Validation:**
- `zod` ^3.24.0 - Schema validation in MCP server

**Testing:**
- `vitest` ^3.0.0 - Unit test runner (used in `@steer-agent-tool/core`)

**Build/Dev:**
- `tsup` ^8.3.6 - TypeScript bundler for core, cli, mcp-server
- `esbuild` ^0.27.3 - Bundler for cursor-extension
- `@vscode/vsce` 2.21.1 - VS Code extension packaging

## Key Dependencies

**Critical:**
- `@modelcontextprotocol/sdk` ^1.12.1 - Enables MCP tool integration
- `zod` ^3.24.0 - Runtime schema validation for MCP inputs

**Development:**
- `typescript` ^5.7.3 - Type checking and compilation
- `@types/node` ^22.0.0 - Node.js type definitions
- `@types/vscode` ^1.85.0 - VS Code API type definitions

## Build Configuration

**tsup (core, cli, mcp-server):**
- Entry: `src/index.ts` (+ `src/gate.ts` for mcp-server)
- Formats: ESM for all; core also outputs CJS
- Declaration files: Generated for core and mcp-server
- Source maps: Enabled

**esbuild (cursor-extension):**
- Entry: `src/extension.ts`
- Format: CommonJS (required by VS Code)
- Platform: Node 18
- External: `vscode` module
- Output: `dist/extension.js`

**TypeScript Configuration:**
- Base: `tsconfig.base.json` with ES2022 target, ESNext modules
- Module resolution: `bundler` (base), `node` (cursor-extension)
- Strict mode: Enabled
- Declaration maps: Enabled (except cursor-extension)

## Package Structure

**Monorepo Layout:**
```
steer-agent-tool/
├── packages/
│   ├── core/        # Shared library - prompt scoring, model routing
│   ├── cli/         # Command-line interface
│   ├── mcp-server/  # MCP server for Cursor integration
│   └── cursor-extension/ # VS Code/Cursor extension
```

**Dependency Graph:**
```
@steer-agent-tool/core
├── @steer-agent-tool/mcp-server (depends on core)
├── @steer-agent-tool/cli (depends on core + mcp-server)
└── steer-agent-tool-extension (depends on core)
```

**Workspace Scripts:**
- `npm run build` - Build all packages
- `npm run test` - Run tests across workspaces
- `npm run typecheck` - Type-check all packages
- `npm run lint` - Lint all packages (if-present)

## Configuration

**Environment:**
- No `.env` files detected
- Configuration is code-based, not environment-driven
- Telemetry writes to `./data/telemetry.jsonl` (local file)

**Build Outputs:**
- `dist/` directories in each package
- `.vsix` files for extension packaging
- `*.tsbuildinfo` for incremental builds

## Platform Requirements

**Development:**
- Node.js >= 18
- npm (for workspace support)

**Production/Runtime:**
- CLI: Node.js >= 18, installed globally or via npx
- MCP Server: Runs via stdio transport
- Extension: Cursor/VS Code >= 1.85.0

---

*Stack analysis: 2026-02-24*

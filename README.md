# steer-agent-tool

TypeScript monorepo using npm workspaces.

## Packages

| Package | Description |
|---------|-------------|
| `@steer-agent-tool/core` | Shared core library |
| `@steer-agent-tool/mcp-server` | MCP server implementation |
| `@steer-agent-tool/cursor-extension` | Cursor/VS Code extension |
| `@steer-agent-tool/cli` | Command-line interface |

## Dev Setup

```bash
# Install all dependencies
npm install

# Build all packages (core must build first for workspace deps)
npm run build

# Type-check all packages
npm run typecheck

# Run tests
npm run test

# Lint
npm run lint
```

## Package Dependency Graph

```
core
├── mcp-server
├── cursor-extension
└── cli
```

`core` is a dependency of the other three packages. The root build script runs builds across all workspaces; npm resolves the correct order via workspace dependency links.

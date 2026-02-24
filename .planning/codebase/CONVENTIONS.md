# Coding Conventions

**Analysis Date:** 2026-02-24

## Naming Patterns

**Files:**
- Source files: `camelCase.ts` (e.g., `scorePrompt.ts`, `buildPrompt.ts`, `extractFileRefs.ts`)
- Test files: `moduleName.test.ts` in `__tests__/` directory
- Class files: `PascalCase.ts` (e.g., `SessionState.ts`, `StatusPanel.ts`, `WizardPanel.ts`)
- Index files: `index.ts` for barrel exports

**Functions:**
- `camelCase` for all functions: `scorePrompt()`, `buildPrompt()`, `generateFollowUps()`, `extractFileRefs()`
- Verb-first naming: `create*`, `build*`, `extract*`, `generate*`, `derive*`, `run*`
- Handler functions: `handle*` prefix (e.g., `handleGate`, `handleReEvaluate`)

**Variables:**
- `camelCase` for local variables and parameters
- `UPPER_SNAKE_CASE` for constants: `VERSION`, `DEFAULT_STATE`, `STORAGE_KEY`, `MAX_QUESTIONS`
- Private class members: underscore prefix `_state`, `_view`, `_onDidChange`

**Types:**
- `PascalCase` for interfaces and types: `ScoreResult`, `FollowUp`, `GateResult`, `SessionStateData`
- Type-only imports: `import type { ... }` pattern consistently used

## Code Style

**Formatting:**
- No Prettier/ESLint config files detected (relies on editor defaults or tsup)
- Indentation: 2 spaces
- Semicolons: Always used
- Quotes: Double quotes for strings

**Linting:**
- No dedicated linter config (`.eslintrc`, `biome.json`)
- TypeScript strict mode provides type safety enforcement
- Root `package.json` has `lint` script but no linter installed

## Import Organization

**Order:**
1. Node.js built-ins: `import { readFile } from "node:fs/promises"`
2. External packages: `import { McpServer } from "@modelcontextprotocol/sdk/..."`
3. Monorepo packages: `import { scorePrompt } from "@steer-agent-tool/core"`
4. Local modules: `import { gate } from "./gate.js"`
5. Type imports last: `import type { Mode, ScoreResult } from "./types.js"`

**Path Aliases:**
- Uses workspace package names: `@steer-agent-tool/core`, `@steer-agent-tool/mcp-server`
- Local imports use `.js` extension (ESM style): `./types.js`, `./gate.js`

## Error Handling

**Patterns:**
- Try/catch for external operations:
  ```typescript
  try {
    execSync("pbcopy", { input: result.patchedPrompt });
  } catch {
    console.log("Could not copy.");
  }
  ```
- Async error swallowing for best-effort operations:
  ```typescript
  telemetry.append(event).catch(() => {
    // Telemetry is best-effort
  });
  ```
- Early return on missing preconditions:
  ```typescript
  if (!draftPrompt.trim()) {
    console.log("Empty prompt. Exiting.");
    return;
  }
  ```
- Fallback values with nullish coalescing: `MODE_MAP[rawMode as GateMode] ?? "code"`

## Logging

**Framework:** `console` (no logging library)

**Patterns:**
- CLI: colored output using ANSI escape codes (`\x1b[31m`, `\x1b[32m`, etc.)
- Extension: `console.log("[steer-agent-tool] ...")` for activation logs
- VS Code notifications for user-facing messages: `vscode.window.showInformationMessage()`

## Comments

**When to Comment:**
- Comments are minimal throughout codebase
- Used sparingly for non-obvious logic
- Example: `// Scope is defined if LIMITS section exists or explicit scope language is present`

**JSDoc/TSDoc:**
- Not used for functions
- Zod schema descriptions for MCP tool parameters:
  ```typescript
  z.string().describe("The draft prompt to evaluate")
  ```

## Function Design

**Size:** 
- Functions are small and focused (typically < 30 lines)
- Single responsibility principle followed

**Parameters:**
- Named parameters via destructuring for complex objects
- Optional parameters use `?` or default values
- Record types for map-like data: `Record<GateMode, Mode>`

**Return Values:**
- Explicit return types on exported functions
- Complex returns use interfaces: `GateResult`, `ScoreResult`
- Nullable returns: `string | null` for optional data

## Module Design

**Exports:**
- Named exports preferred over default exports
- Barrel file pattern in `packages/core/src/index.ts`:
  ```typescript
  export { scorePrompt } from "./scorePrompt.js";
  export type { ScoreResult } from "./types.js";
  ```
- Re-export types with `export type { ... }`

**Barrel Files:**
- Each package has `src/index.ts` as entry point
- Types and functions exported together
- `export * as namespace from "./module.js"` for namespaced exports (telemetry)

## TypeScript Strictness

**Base Config (`tsconfig.base.json`):**
```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

**Key Settings:**
- `strict: true` enables all strict type-checking options
- `target: "ES2022"` for modern JavaScript features
- `module: "ESNext"` for ESM output
- `declaration: true` generates `.d.ts` files

## Build Configuration

**tsup (`packages/*/tsup.config.ts`):**
```typescript
defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
})
```

**Dual Format:**
- ESM (`.js`) and CJS (`.cjs`) outputs for core package
- MCP server is ESM-only

---

*Convention analysis: 2026-02-24*

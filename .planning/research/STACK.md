# Technology Stack

**Project:** SteerAgent (Prompt Gating Tool)
**Researched:** 2026-02-24
**Overall Confidence:** HIGH

---

## Recommended Stack

### Core Language & Runtime

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| TypeScript | ^5.9.3 | All packages | Already in use at ^5.7.3. Upgrade to 5.9 for import defer (lazy module eval helps extension startup), cleaner tsconfig defaults, and better JSX hover info for webview dev. | HIGH |
| Node.js | >=20.x | Runtime | Required by @vscode/vsce 3.x. Already the baseline for VS Code 1.85+. Node 20 is LTS until April 2026. | HIGH |

### Extension Platform

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| VS Code Extension API | ^1.85.0 | Extension host | Already in use. 1.85+ gives us chat participants API, webview views in activity bar, and `workbench.action.chat.open` for prompt injection. No reason to bump minimum -- Cursor tracks VS Code closely. | HIGH |
| @types/vscode | ^1.85.0 | Type definitions | Match engine version. | HIGH |
| esbuild | ^0.27.3 | Extension bundling | Already in use. Official VS Code docs recommend esbuild for extension bundling. Correct choice over webpack (slow) or tsup (not designed for extension CJS output). Keep the existing `esbuild.js` build script. | HIGH |
| @vscode/vsce | ^3.7.1 | VSIX packaging | Upgrade from 2.21.1. Version 3.x is current, requires Node 20+ (which we already target). Needed for publishing to Open VSX or internal distribution. | HIGH |

### MCP Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @modelcontextprotocol/sdk | ^1.27.0 | MCP server | Upgrade from ^1.12.1. Current stable is 1.27.0. Adds Streamable HTTP transport (since 1.10.0), which supersedes SSE. v2 expected Q1 2026 but v1.x is production-recommended until then. Pin to ^1.27 to get patches but avoid accidental v2 upgrade. | HIGH |
| zod | ^3.24.0 | Schema validation | Already in use. Stay on Zod 3.x for MCP SDK compatibility -- the MCP SDK's tool() API expects Zod 3 schemas. Zod 4 (4.3.6 is latest) has a different API surface and the MCP SDK has not yet migrated. Do NOT upgrade to Zod 4 until MCP SDK v2 ships. | HIGH |

### Cursor Hooks

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| cursor-hooks | ^1.1.5 | Type definitions for Cursor hooks | Provides TypeScript types for BeforeSubmitPromptPayload/Response, isHookPayloadOf() helper, and schema validation. Small dependency. Use it instead of hand-rolling types. | MEDIUM |
| .cursor/hooks.json | N/A | Hook configuration | Project-scoped config file. Defines beforeSubmitPrompt hook pointing to our gate script. Keeps behavior versioned in repo, visible to all 14 pilot devs. | HIGH |

### Build Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tsup | ^8.5.1 | Library bundling (core, mcp-server, cli) | Upgrade from ^8.3.6. tsup wraps esbuild with zero-config dual ESM+CJS output and .d.ts generation. Note: tsup maintainer has signaled reduced activity and suggests tsdown as future successor. For v1, tsup 8.x is stable and works. Revisit at v2. | MEDIUM |
| esbuild | ^0.27.3 | Extension bundling (cursor-extension) | Direct esbuild for the extension package. Extensions must output CJS, single-file, with vscode externalized. tsup adds unnecessary abstraction here. | HIGH |
| npm workspaces | N/A | Monorepo management | Already in use. Correct choice for this repo size (5 packages). No need for turborepo/nx -- the build graph is simple and `npm run build --workspaces` handles ordering. | HIGH |

### Testing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| vitest | ^4.0.18 | Unit & integration tests | Upgrade from ^3.0.0. Vitest 4 is current stable. Fast, ESM-native, compatible with tsup's output. Use for core scoring logic, routing logic, and gate integration tests. | HIGH |
| @vscode/test-electron | ^2.4.0 | Extension integration tests | Official VS Code extension testing harness. Required for testing webview providers, command registration, and chat participants in a real VS Code instance. | MEDIUM |

### Webview UI

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Raw HTML + CSS variables | N/A | Webview panels (Status, Wizard) | **Keep the current approach.** The existing inline HTML with VS Code CSS variables (--vscode-foreground, --vscode-button-background, etc.) is correct for sidebar panels. These panels are small (status display, form with 3-5 fields). A framework adds bundle size and complexity for no benefit. | HIGH |
| @vscode-elements/elements | ^1.16.1 | **Optional** -- native-looking form controls | Lit-based web components that match VS Code's native UI. Consider ONLY if the Wizard panel grows beyond 5-6 form fields and needs dropdowns, tabs, or collapsibles. The current `<select>` and `<input>` approach works fine for the v1 scope. | LOW |

**Do NOT use:**
- `@vscode/webview-ui-toolkit` -- Deprecated since Jan 2025. No longer maintained.
- React/Vue/Svelte for webviews -- Massive overkill for sidebar panels. Adds 50-150KB to bundle, requires a separate build pipeline, and increases startup time. Only justified for full-page editor webviews with complex state.

### Telemetry & Analytics

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| JSONL file append (built-in) | N/A | Local telemetry storage | Already implemented in `core/src/telemetry.ts`. JSONL is the right format: append-only, one event per line, easy to grep/parse, compatible with OpenTelemetry file exporter spec. For 14 devs, this is all you need. | HIGH |
| Node.js fs/promises | N/A | File I/O for telemetry | Already in use. No library needed for append-only writes. | HIGH |

**Do NOT use:**
- OpenTelemetry SDK -- Massive dependency tree (10+ packages). Designed for distributed tracing across services. SteerAgent is a local tool writing to a local file. OpenTelemetry is the right answer at 100+ devs with a central analytics backend. At 14 devs with local JSONL, it is pure overhead.
- SQLite (better-sqlite3, sql.js) -- Tempting for analytics queries but adds native binary dependency complications for VS Code extensions. JSONL + a simple aggregation script is sufficient for v1 metrics.

### Prompt Scoring & Template System

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Pure TypeScript (built-in) | N/A | Rubric-based scoring engine | Already implemented in `core/src/scorePrompt.ts`. The scoring is structural (section detection, vague verb matching, file ref counting) -- not NLP. No external library needed. Regex + string matching is the correct approach for deterministic, fast, zero-dependency scoring. | HIGH |
| Pure TypeScript (built-in) | N/A | Prompt template/patching | Already implemented in `core/src/buildPrompt.ts`. The 7-section template is string concatenation with conditional sections based on answers. No template engine (Handlebars, Mustache, Nunjucks) is justified -- the template is a single known structure, not user-configurable. | HIGH |

**Do NOT use:**
- winkNLP, natural, node-nlp -- NLP libraries for sentiment analysis, NER, POS tagging. SteerAgent's scoring is structural (does the prompt have a GOAL section?) not semantic (is the prompt well-written prose?). Adding NLP would slow scoring from <1ms to 50-200ms with no accuracy benefit for the rubric dimensions.
- Handlebars/Nunjucks/EJS -- Template engines are for user-configurable templates with loops/conditionals. The 7-section prompt structure is developer-defined, not user-authored. String concatenation is simpler, faster, and type-safe.

### Git Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| child_process (Node.js built-in) | N/A | Run `git diff --stat`, `git diff --name-only` | Already the approach used. Shell out to git for diff stats, parse the output. No library needed -- the git CLI is always available in dev environments. | HIGH |

**Do NOT use:**
- simple-git, isomorphic-git -- Abstraction layers over git CLI. SteerAgent only needs `git diff --stat` and `git diff --name-only`. Two exec calls do not justify a dependency.

---

## Version Summary: Current vs Recommended

| Package | Current | Recommended | Breaking? |
|---------|---------|-------------|-----------|
| typescript | ^5.7.3 | ^5.9.3 | No -- drop-in upgrade |
| @modelcontextprotocol/sdk | ^1.12.1 | ^1.27.0 | Minor API changes possible. Test MCP server after upgrade. |
| zod | ^3.24.0 | ^3.24.0 | No change. Do NOT go to Zod 4. |
| esbuild | ^0.27.3 | ^0.27.3 | No change. Already current. |
| tsup | ^8.3.6 | ^8.5.1 | No -- patch upgrade |
| vitest | ^3.0.0 | ^4.0.18 | Yes -- Vitest 4 has migration steps. Test runner API is stable; config may need minor updates. |
| @vscode/vsce | 2.21.1 | ^3.7.1 | Yes -- requires Node 20+. Should already be met. |
| @types/vscode | ^1.85.0 | ^1.85.0 | No change. |
| cursor-hooks | N/A (new) | ^1.1.5 | New dependency for hooks package. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Monorepo tool | npm workspaces | Turborepo, Nx, pnpm workspaces | 5 packages with linear dependency graph. Turborepo/Nx add config complexity for negligible build speed gain. pnpm workspaces would require migrating lockfile format. |
| Extension bundler | esbuild (direct) | webpack, tsup, rollup | VS Code officially documents esbuild. webpack is slower with more config. tsup adds abstraction. rollup is overkill for single-entry CJS output. |
| Library bundler | tsup | esbuild (direct), rollup | tsup's zero-config dual ESM+CJS+dts output is exactly what core/mcp-server/cli need. Raw esbuild requires manual dts generation. |
| Schema validation | Zod 3.x | Zod 4, ArkType, TypeBox | MCP SDK requires Zod 3 for tool schemas. Switching would break MCP integration. |
| Webview components | Raw HTML | @vscode-elements, React | Panels are simple (status display, 5-field form). Components add bundle size with no UX benefit at this scope. |
| Telemetry storage | JSONL file | SQLite, OpenTelemetry, PostHog | 14-dev pilot. Local file append is zero-dependency and sufficient. Upgrade path: add aggregation script over JSONL, then migrate to SQLite or remote backend if needed. |
| MCP transport | stdio | Streamable HTTP | stdio is simpler for local tool invocation (Cursor spawns the MCP server). Streamable HTTP is for remote/multi-client MCP servers. Keep stdio for v1; consider HTTP for v2 if we add a shared team server. |
| Prompt scoring | Pure regex/string | winkNLP, LLM-based scoring | Scoring is structural (section presence, verb patterns), not semantic. Regex is deterministic, <1ms, zero-dependency. LLM scoring would add latency and cost per gate call. |

---

## Installation

```bash
# Root -- upgrade TypeScript
npm install -D typescript@^5.9.3

# Core -- upgrade vitest
cd packages/core
npm install -D vitest@^4.0.18

# MCP Server -- upgrade MCP SDK
cd packages/mcp-server
npm install @modelcontextprotocol/sdk@^1.27.0

# Extension -- upgrade vsce
cd packages/cursor-extension
npm install -D @vscode/vsce@^3.7.1

# Hooks package (if created as new package)
npm install cursor-hooks@^1.1.5

# Or from root with workspaces
npm install
```

---

## Transport Strategy (MCP)

**v1 (now):** stdio transport. Cursor spawns the MCP server process directly. Simple, reliable, no networking.

**v1.5 (team features):** Consider Streamable HTTP transport for a shared gate server that multiple devs connect to (e.g., centralized rubric config, shared telemetry aggregation). The MCP SDK 1.27+ supports this natively.

**v2 (post MCP SDK v2):** Evaluate MCP SDK v2 when it ships (expected Q1 2026). May bring breaking changes to tool registration API. Plan a migration sprint.

---

## Cursor Hooks Strategy

**Hook type:** `beforeSubmitPrompt` -- runs before every AI prompt submission in Cursor.

**Configuration (`.cursor/hooks.json`):**
```json
{
  "version": 1,
  "hooks": {
    "beforeSubmitPrompt": [
      {
        "command": "node ./node_modules/.bin/steer-gate"
      }
    ]
  }
}
```

**Hook script behavior:**
1. Reads prompt from stdin (JSON payload with `prompt` field)
2. Calls `gate()` from @steer-agent-tool/core
3. Returns `{ "continue": true/false, "user_message": "..." }`
4. If `continue: false`, Cursor shows error popup to user with the gate feedback

**Key constraint:** Hooks are beta in Cursor. The API may change. Wrap hook I/O in an adapter layer so the core gate logic is decoupled from the hook transport format.

**Scope:** Commit `.cursor/hooks.json` to repo so all 14 pilot devs get it automatically. No global config needed.

---

## Sources

- [@modelcontextprotocol/sdk on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- version 1.27.0, verified 2026-02-24
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) -- Streamable HTTP since 1.10.0
- [MCP Transports Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) -- Streamable HTTP replaces SSE
- [Cursor Hooks Documentation](https://cursor.com/docs/agent/hooks) -- beforeSubmitPrompt hook schema
- [cursor-hooks npm package](https://github.com/johnlindquist/cursor-hooks) -- TypeScript types for hook payloads
- [GitButler Cursor Hooks Deep Dive](https://blog.gitbutler.com/cursor-hooks-deep-dive) -- Hook behavior details
- [VS Code Extension Bundling](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) -- esbuild recommended
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview) -- Webview best practices
- [@vscode-elements/elements](https://github.com/vscode-elements/elements) -- Lit-based VS Code web components
- [vscode-webview-ui-toolkit deprecation](https://github.com/microsoft/vscode-webview-ui-toolkit) -- Deprecated Jan 2025
- [TypeScript 5.9 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/) -- Import defer, cleaner tsconfig
- [Vitest 4.0 release](https://vitest.dev/blog/vitest-4) -- Current stable testing framework
- [Zod v4 release notes](https://zod.dev/v4) -- API changes; not compatible with MCP SDK v1
- [tsup on npm](https://www.npmjs.com/package/tsup) -- v8.5.1, maintainer suggests tsdown as future
- [esbuild on npm](https://www.npmjs.com/package/esbuild) -- v0.27.3
- [@vscode/vsce on npm](https://www.npmjs.com/package/@vscode/vsce) -- v3.7.1, requires Node 20+
- [OpenTelemetry File Exporter](https://opentelemetry.io/docs/specs/otel/protocol/file-exporter/) -- JSONL as preferred format

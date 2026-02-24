# Codebase Concerns

**Analysis Date:** 2026-02-24

## Tech Debt

**Severe Code Duplication in Gate Logic:**
- Issue: Near-identical gate implementations in 3 packages
- Files:
  - `packages/mcp-server/src/gate.ts` (64 lines)
  - `packages/cli/src/gateAdapter.ts` (62 lines)
  - `packages/cursor-extension/src/gateClient.ts` (64 lines)
- Impact: Changes to gate logic require updating 3 files; inconsistencies already exist
- Fix approach: Extract shared `GateStatus`, `GateResult`, `deriveStatus()`, and `gate()` into `@steer-agent-tool/core` and import from all packages

**Hardcoded Version in MCP Server:**
- Issue: Version string "0.1.0" hardcoded instead of using `VERSION` from core
- Files: `packages/mcp-server/src/index.ts:8`
- Impact: Version will drift from other packages during updates
- Fix approach: Import `VERSION` from `@steer-agent-tool/core` like CLI does

**TypeScript Error Suppression:**
- Issue: `@ts-ignore` comment suppressing TS2589 depth limit error
- Files: `packages/mcp-server/src/index.ts:23-24`
- Impact: Hides potential type safety issues; may mask real errors
- Fix approach: Use explicit type annotations or restructure to avoid Zod+MCP SDK generic depth issues

**Unused Configuration:**
- Issue: `blockThreshold` in SessionState is never used to actually block prompts
- Files: `packages/cursor-extension/src/SessionState.ts:8`, `packages/cursor-extension/src/StatusPanel.ts:38`
- Impact: Dead code; user sees threshold in UI but it has no effect
- Fix approach: Either implement threshold-based blocking or remove the field

## Known Bugs

**Inconsistent API Call in MCP Server:**
- Symptoms: `generateFollowUps` called without `mode` parameter in MCP server, but with `mode` in CLI and extension
- Files:
  - `packages/mcp-server/src/gate.ts:43` - `generateFollowUps(scoreResult)` ← missing mode
  - `packages/cli/src/gateAdapter.ts:42` - `generateFollowUps(scoreResult, coreMode)` ← correct
  - `packages/cursor-extension/src/gateClient.ts:44` - `generateFollowUps(scoreResult, coreMode)` ← correct
- Trigger: Call `steer.gate` MCP tool with mode="bugfix" or mode="debug"
- Workaround: None; bugfix/debug-specific follow-up questions won't appear for MCP callers
- Impact: MCP server users won't get "Do you have repro steps or error logs?" question

**macOS-Only Clipboard in CLI:**
- Symptoms: Clipboard copy fails on Linux/Windows
- Files: `packages/cli/src/steer.ts:88`
- Trigger: User runs CLI `steer` command and chooses "Copy to clipboard"
- Workaround: Manual copy from terminal output
- Impact: CLI unusable for clipboard on non-macOS

## Security Considerations

**No Input Sanitization:**
- Risk: XSS in webview if malicious prompt content is rendered
- Files:
  - `packages/cursor-extension/src/WizardPanel.ts:92-95`
  - `packages/cursor-extension/src/WizardPanel.ts:104-106`
- Current mitigation: `escapeHtml()` function at line 174-176 escapes &, <, >, " characters
- Recommendations: Current escaping is adequate for HTML context; verify it's applied consistently

**Telemetry Data Disclosure:**
- Risk: User prompts stored in plaintext in local telemetry file
- Files: `packages/core/src/telemetry.ts`, `data/telemetry.jsonl`
- Current mitigation: File is local; only event metadata logged, not full prompts
- Recommendations: Document what is logged; consider opt-out mechanism

## Performance Bottlenecks

**Naive Token Estimation:**
- Problem: Token count estimated as `text.length / 4`
- Files: `packages/core/src/estimateTokens.ts:2`
- Cause: Simplistic character-based approximation ignores tokenizer differences
- Improvement path: Use `tiktoken` or model-specific tokenizer for accurate counts

**Regex Global Flag Pattern:**
- Problem: Regex with global flag requires manual `lastIndex` reset
- Files:
  - `packages/core/src/scorePrompt.ts:5,39` - VAGUE_PATTERN
  - `packages/core/src/extractFileRefs.ts:1,9` - FILE_REF_PATTERN
- Cause: Global regex maintains state between `exec()` calls
- Improvement path: Use `String.matchAll()` instead to avoid stateful regex footgun

## Fragile Areas

**Webview Message Handling:**
- Files: `packages/cursor-extension/src/WizardPanel.ts:19-31`
- Why fragile: Switch statement on string message types; no validation of message shape
- Safe modification: Add TypeScript discriminated union types for messages
- Test coverage: None; extension has no tests

**Answer-to-Section Mapping:**
- Files: `packages/cursor-extension/src/WizardPanel.ts:53-65`
- Why fragile: Heuristic string matching to map answers to buildPrompt fields
- Safe modification: Use explicit field identifiers in follow-up questions
- Test coverage: None

## Test Coverage Gaps

**MCP Server Package:**
- What's not tested: Gate tool handler, server initialization, transport
- Files: `packages/mcp-server/src/index.ts`, `packages/mcp-server/src/gate.ts`
- Risk: Breaking changes to MCP SDK could go unnoticed
- Priority: Medium

**CLI Package:**
- What's not tested: Command routing, interactive prompts, clipboard integration
- Files: `packages/cli/src/index.ts`, `packages/cli/src/steer.ts`, `packages/cli/src/metrics.ts`
- Risk: CLI UX regressions undetected
- Priority: Medium

**Cursor Extension Package:**
- What's not tested: Extension activation, chat participant, webview rendering, state management
- Files: `packages/cursor-extension/src/extension.ts`, `packages/cursor-extension/src/WizardPanel.ts`, `packages/cursor-extension/src/StatusPanel.ts`, `packages/cursor-extension/src/SessionState.ts`, `packages/cursor-extension/src/gateClient.ts`
- Risk: Extension may break silently on VS Code API changes
- Priority: High (user-facing)

**Core Package Tests Exist But Missing:**
- What's not tested: `routeModel.ts`, `estimateTokens.ts`, `telemetry.ts`
- Files: Only 5 test files exist in `packages/core/src/__tests__/`
- Risk: Model routing and telemetry logic untested
- Priority: Low (simple functions)

## Missing Critical Features

**No Configuration File Support:**
- Problem: All configuration via code; no `.steerrc` or similar
- Blocks: Users can't customize behavior without code changes

**No Override Reason Tracking:**
- Problem: When user overrides BLOCKED status, reason is logged but not displayed or used
- Files: `packages/cursor-extension/src/extension.ts:150-161`
- Blocks: No audit trail of why blocks were overridden

## Dependencies at Risk

**None Critical:** Dependencies are stable and well-maintained (@modelcontextprotocol/sdk, zod, vscode).

---

*Concerns audit: 2026-02-24*

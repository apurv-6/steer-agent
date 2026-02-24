# Debugging SteerAgent

## Hook Not Firing

### Symptoms
- Prompts go through without any `[Steer]` message
- No blocking on vague prompts

### Checks

1. **Verify hooks.json exists:**
   ```bash
   cat ~/.cursor/hooks.json
   ```
   Should contain `beforeSubmitPrompt` with your hook command.

2. **Verify hook script runs:**
   ```bash
   echo '{"prompt":"fix it"}' | node /path/to/hooks/steer-gate-hook.js
   ```
   Should output JSON with `"continue":false`.

3. **Verify core is built:**
   ```bash
   ls packages/core/dist/index.cjs
   ```
   If missing: `npm run build --workspaces`

4. **Check Cursor version supports hooks:**
   Cursor hooks (`beforeSubmitPrompt`) were added in recent builds. If your Cursor doesn't support hooks, you'll need to use `/steer` in chat instead.

5. **Check Cursor logs:**
   `Cmd+Shift+P` → "Developer: Toggle Developer Tools" → Console tab.
   Look for hook-related errors.

## Hook Can't Read Prompt Text

### Background

Cursor's `beforeSubmitPrompt` hook receives the prompt via stdin as JSON. The hook script tries multiple fields:
- `prompt`
- `query`
- `message`
- `content`

### If prompt is empty in hook

The hook allows through with a guidance message. The fallback workflow is:
1. Use `/steer` in Cursor chat to gate prompts manually
2. Or use `Steer Agent: Suggest` from command palette
3. The hook still provides value as an awareness prompt

### Force a mode

Set environment variable before starting Cursor:
```bash
export STEER_MODE=bugfix
```

## Extension Not Showing

### Symptoms
- No "Steer Agent" in activity bar
- Panels are empty

### Checks

1. **Extension installed:**
   ```bash
   cursor --list-extensions | grep steer
   ```

2. **Rebuild and reinstall:**
   ```bash
   cd packages/cursor-extension
   npm run build
   npm run package
   cursor --install-extension steer-agent-tool-extension-0.1.0.vsix --force
   ```

3. **Reload Cursor:** `Cmd+Shift+P` → "Developer: Reload Window"

## Git Impact Not Working

### Symptoms
- Model always routes to "small"
- No critical files detected

### Checks

1. **Verify git diff has output:**
   ```bash
   git diff --stat
   git diff --name-only
   ```
   If clean working tree, git impact is null (expected).

2. **Verify criticalModules.json:**
   ```bash
   cat criticalModules.json
   ```
   Must be valid JSON with a `paths` array.

3. **Test git impact directly:**
   ```bash
   node -e "
   const c = require('./packages/core/dist/index.cjs');
   const r = c.parseGitImpact(
     ' 3 files changed, 50 insertions(+)',
     'src/auth/login.ts\nsrc/auth/session.ts\nsrc/utils/helpers.ts',
     ['src/auth']
   );
   console.log(JSON.stringify(r, null, 2));
   "
   ```

## Score Seems Wrong

### Debug scoring

```bash
node -e "
const c = require('./packages/core/dist/index.cjs');
const r = c.scorePrompt('your prompt here', 'code');
console.log(JSON.stringify(r, null, 2));
"
```

Check:
- `missing` — which sections are missing
- `vagueFlags` — which vague verbs detected
- `fileRefs` — which @file references found

### Common issues
- Section headers need `## ` prefix (with space): `## GOAL` not `##GOAL`
- Sections are case-insensitive but must be on their own line
- Vague verbs: "fix", "improve", "help", "check" each deduct 1 point (once)

## MCP Server Issues

### Test MCP server directly:
```bash
cd packages/mcp-server
npm run smoke
```

### Test via stdio:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node packages/mcp-server/dist/index.js 2>/dev/null | head -1
```

## Getting Help

- File issues at: https://github.com/steer-agent-tool/steer-agent-tool/issues
- Run `steer-agent-tool --version` for version info
- All telemetry is local-only (`./data/telemetry.jsonl`)

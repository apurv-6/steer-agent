---
status: resolved
trigger: "extension-hooks-not-updating: The Cursor extension is not getting updated via hooks, nor through any wizard mechanism. This has never worked."
created: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:00:02Z
---

## Current Focus

hypothesis: ROOT CAUSE CONFIRMED AND FIXED
test: Rebuilt, repackaged, reinstalled extension; verified bridge watcher code present in installed extension
expecting: Extension will now watch .steer/last-gate.json and update UI when hook writes to it
next_action: Archive session

## Symptoms

expected: The Cursor extension should be updated/triggered via hooks (cursor-hooks) so that gate scoring and steering results flow into the extension UI
actual: The extension is not getting updated via hooks nor through any wizard/setup mechanism
errors: No specific error messages - feature simply doesn't work
reproduction: Run the hook system and observe the extension doesn't reflect updates
started: Never worked

## Eliminated

- hypothesis: .gitignore excluding .steer/ prevents file watcher from detecting bridge file
  evidence: VS Code createFileSystemWatcher does NOT respect .gitignore - only files.watcherExclude matters. Confirmed via VS Code issue tracker.
  timestamp: 2026-02-25T00:00:01Z

- hypothesis: Hook is not running or not writing bridge file
  evidence: .steer/last-gate.json exists with valid data (timestamp 1771958364402), confirming hook runs and writes bridge file successfully
  timestamp: 2026-02-25T00:00:01Z

- hypothesis: hooks.json not installed correctly
  evidence: ~/.cursor/hooks.json exists with correct format (version 1, beforeSubmitPrompt command pointing to correct hook script path)
  timestamp: 2026-02-25T00:00:01Z

## Evidence

- timestamp: 2026-02-25T00:00:01Z
  checked: .steer/last-gate.json bridge file
  found: File exists with valid gate result data, proving hook runs correctly
  implication: Hook -> bridge file path works

- timestamp: 2026-02-25T00:00:01Z
  checked: Installed extension at ~/.cursor/extensions/steer-agent-tool.steer-agent-tool-extension-0.1.0/dist/extension.js
  found: File is 23744 bytes. grep for createFileSystemWatcher, last-gate, handleBridgeFile, bridgeWatcher returns 0 matches
  implication: The installed extension has NO bridge watcher code at all

- timestamp: 2026-02-25T00:00:01Z
  checked: Source dist at packages/cursor-extension/dist/extension.js
  found: File is 39438 bytes. grep for same patterns returns 5 matches
  implication: The bridge watcher feature exists in source but was never packaged into the installed .vsix

- timestamp: 2026-02-25T00:00:01Z
  checked: .vsix file timestamp
  found: steer-agent-tool-extension-0.1.0.vsix was created Feb 24 13:48, but dist/extension.js was last built Feb 24 23:59
  implication: The .vsix was packaged from an older build that predates the bridge watcher feature

- timestamp: 2026-02-25T00:00:02Z
  checked: Post-fix verification - installed extension after rebuild+repackage+reinstall
  found: Installed extension.js is now 39438 bytes with 5 matches for bridge watcher patterns
  implication: Fix confirmed - bridge watcher code is now in the installed extension

## Resolution

root_cause: The installed Cursor extension (.vsix) was stale. It was packaged at Feb 24 13:48 from an older build that did not include the bridge file watcher feature (createFileSystemWatcher for .steer/last-gate.json). The hook correctly writes gate results to .steer/last-gate.json, but the installed extension had no code to watch for or read that file. The bridge watcher was added to source code later (extension.ts lines 332-375) but the .vsix was never rebuilt and reinstalled.
fix: |
  1. Rebuilt extension with esbuild (npm run build in packages/cursor-extension)
  2. Repackaged .vsix with vsce (npx vsce package --no-dependencies, using Node 20 due to undici/Node 18 incompatibility)
  3. Reinstalled .vsix into Cursor (cursor --install-extension ... --force)
  4. Updated cursor-hooks.example.json to include required "version": 1 field matching installed hooks.json
verification: |
  - Confirmed installed extension.js now 39438 bytes (was 23744 bytes)
  - grep confirms 5 matches for bridge watcher patterns in installed extension (was 0)
  - Hook manually tested: writes valid bridge file to .steer/last-gate.json
  - User must reload Cursor window for extension changes to take effect
files_changed:
  - hooks/cursor-hooks.example.json (added "version": 1 field)
  - packages/cursor-extension/steer-agent-tool-extension-0.1.0.vsix (rebuilt)
  - ~/.cursor/extensions/steer-agent-tool.steer-agent-tool-extension-0.1.0/ (reinstalled)

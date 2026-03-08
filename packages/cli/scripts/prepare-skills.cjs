#!/usr/bin/env node
'use strict';
/**
 * Prepares assets for npm packaging:
 *   - Merges any extra skills from .claude/skills/ into packages/cli/skills/
 *   - Copies .claude/commands/ → packages/cli/commands/
 *   - Copies packages/cursor-extension/*.vsix → packages/cli/extension/
 *
 * Run via: npm run prepack (inside packages/cli/)
 */

const fs = require('fs');
const path = require('path');

const PKG_CLI = path.resolve(__dirname, '..');
const MONOREPO_ROOT = path.resolve(PKG_CLI, '..', '..');

// ── Skills ──────────────────────────────────────────────────────────────
// Skills already live in packages/cli/skills/ (source of truth).
// Merge any extra skills from .claude/skills/ that don't exist in cli/skills/.
const SKILLS_DST = path.join(PKG_CLI, 'skills');
const EXTRA_SKILLS_SRC = path.join(MONOREPO_ROOT, '.claude', 'skills');

if (fs.existsSync(EXTRA_SKILLS_SRC)) {
  fs.mkdirSync(SKILLS_DST, { recursive: true });
  for (const entry of fs.readdirSync(EXTRA_SKILLS_SRC)) {
    const src = path.join(EXTRA_SKILLS_SRC, entry);
    const dst = path.join(SKILLS_DST, entry);
    if (!fs.statSync(src).isDirectory()) continue;
    if (!fs.existsSync(dst)) {
      fs.cpSync(src, dst, { recursive: true });
      console.log('prepare: merged extra skill', entry, 'into packages/cli/skills/');
    }
  }
}
const skillCount = fs.readdirSync(SKILLS_DST).filter(f =>
  fs.statSync(path.join(SKILLS_DST, f)).isDirectory()
).length;
console.log('prepare:', skillCount, 'skills ready in packages/cli/skills/');

// ── Copy commands ────────────────────────────────────────────────────────
const CMDS_SRC = path.join(MONOREPO_ROOT, '.claude', 'commands');
const CMDS_DST = path.join(PKG_CLI, 'commands');

if (!fs.existsSync(CMDS_SRC)) {
  console.warn('prepare: .claude/commands/ not found at', CMDS_SRC);
} else {
  fs.rmSync(CMDS_DST, { recursive: true, force: true });
  fs.mkdirSync(CMDS_DST, { recursive: true });
  fs.cpSync(CMDS_SRC, CMDS_DST, { recursive: true });
  const cmdCount = fs.readdirSync(CMDS_DST).filter(f =>
    fs.statSync(path.join(CMDS_DST, f)).isDirectory()
  ).length;
  console.log('prepare: copied', cmdCount, 'command namespaces to packages/cli/commands/');
}

// ── Copy latest .vsix ────────────────────────────────────────────────────
const EXT_SRC = path.join(MONOREPO_ROOT, 'packages', 'cursor-extension');
const EXT_DST = path.join(PKG_CLI, 'extension');

if (!fs.existsSync(EXT_SRC)) {
  console.warn('prepare: packages/cursor-extension/ not found — skipping vsix copy');
} else {
  const vsixFiles = fs.readdirSync(EXT_SRC).filter(f => f.endsWith('.vsix')).sort().reverse();
  if (vsixFiles.length === 0) {
    console.warn('prepare: no .vsix files in packages/cursor-extension/ — skipping');
  } else {
    fs.rmSync(EXT_DST, { recursive: true, force: true });
    fs.mkdirSync(EXT_DST, { recursive: true });
    fs.copyFileSync(path.join(EXT_SRC, vsixFiles[0]), path.join(EXT_DST, vsixFiles[0]));
    console.log('prepare: copied', vsixFiles[0], 'to packages/cli/extension/');
  }
}

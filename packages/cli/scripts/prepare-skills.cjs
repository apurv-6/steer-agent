#!/usr/bin/env node
'use strict';
/**
 * Copies assets from the monorepo into packages/cli/ for npm packaging:
 *   .claude/skills/  → packages/cli/skills/
 *   packages/cursor-extension/*.vsix  → packages/cli/extension/
 *
 * Run via: npm run prepack (inside packages/cli/)
 */

const fs = require('fs');
const path = require('path');

const PKG_CLI = path.resolve(__dirname, '..');
const MONOREPO_ROOT = path.resolve(PKG_CLI, '..', '..');

// ── Copy skills ──────────────────────────────────────────────────────────
const SKILLS_SRC = path.join(MONOREPO_ROOT, '.claude', 'skills');
const SKILLS_DST = path.join(PKG_CLI, 'skills');

if (!fs.existsSync(SKILLS_SRC)) {
  console.warn('prepare: .claude/skills/ not found at', SKILLS_SRC);
} else {
  fs.rmSync(SKILLS_DST, { recursive: true, force: true });
  fs.mkdirSync(SKILLS_DST, { recursive: true });
  fs.cpSync(SKILLS_SRC, SKILLS_DST, { recursive: true });
  const count = fs.readdirSync(SKILLS_DST).filter(f =>
    fs.statSync(path.join(SKILLS_DST, f)).isDirectory()
  ).length;
  console.log('prepare: copied', count, 'skills to packages/cli/skills/');
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

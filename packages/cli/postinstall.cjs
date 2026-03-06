#!/usr/bin/env node
'use strict';

/**
 * SteerAgent postinstall — auto-registers MCP + hook + skills.
 * Runs after: npm install -g @coinswitch/steer-agent OR npm link
 *
 * MUST NEVER THROW — npm install must not fail because of us.
 * All errors are caught and surfaced as warnings only.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PKG_ROOT = __dirname; // packages/cli/ directory
const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
const GLOBAL_SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');

function log(msg) { console.log('  steer-agent: ' + msg); }

function findMcpBin() {
  const p = path.join(PKG_ROOT, 'dist', 'mcp-entry.js');
  return fs.existsSync(p) ? p : null;
}

function findHookBin() {
  const p = path.join(PKG_ROOT, 'dist', 'hooks', 'prompt-submit.js');
  return fs.existsSync(p) ? p : null;
}

function findSkillsSrc() {
  // 1. Package-local skills/ (present in published npm package after prepack)
  const local = path.join(PKG_ROOT, 'skills');
  if (fs.existsSync(local)) return local;

  // 2. Walk up from PKG_ROOT — finds .claude/skills/ in the monorepo root (npm link / local dev)
  let dir = PKG_ROOT;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, '.claude', 'skills');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function main() {
  try {
    if (process.env.STEER_SKIP_POSTINSTALL === '1') return;

    const mcpBin = findMcpBin();
    if (!mcpBin) {
      log('⚠️  dist/ not found. Run: npm run build && steer-agent install');
      return;
    }

    fs.mkdirSync(CLAUDE_DIR, { recursive: true });

    // ── Load settings ──
    let settings = {};
    try { settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); } catch {}

    let changed = false;

    // ── Register MCP server (absolute path via node) ──
    if (!settings.mcpServers) settings.mcpServers = {};
    if (!settings.mcpServers['steer-agent']) {
      settings.mcpServers['steer-agent'] = { command: 'node', args: [mcpBin], env: {} };
      changed = true;
      log('✅ MCP server registered');
    } else {
      // Update binary path if stale
      const existing = settings.mcpServers['steer-agent'];
      const existingBin = Array.isArray(existing.args) ? existing.args[0] : null;
      if (existingBin !== mcpBin) {
        settings.mcpServers['steer-agent'] = { command: 'node', args: [mcpBin], env: {} };
        changed = true;
        log('✅ MCP server path updated');
      } else {
        log('✅ MCP server already registered');
      }
    }

    // ── Register hook (absolute path) ──
    const hookBin = findHookBin();
    if (hookBin) {
      if (!settings.hooks) settings.hooks = {};
      if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];

      const hasHook = settings.hooks.UserPromptSubmit.some(h =>
        h && (String(h.command || '').includes('prompt-submit') ||
              String(h.command || '').includes('steer-hook-prompt'))
      );

      if (!hasHook) {
        settings.hooks.UserPromptSubmit.push({
          type: 'command',
          command: 'node ' + hookBin,
          timeout: 5000,
        });
        changed = true;
        log('✅ Hook registered');
      } else {
        log('✅ Hook already registered');
      }
    }

    if (changed) {
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    }

    // ── Install skills ──
    const skillsSrc = findSkillsSrc();
    if (skillsSrc) {
      fs.mkdirSync(GLOBAL_SKILLS_DIR, { recursive: true });
      let count = 0;
      for (const entry of fs.readdirSync(skillsSrc)) {
        const src = path.join(skillsSrc, entry);
        if (!fs.statSync(src).isDirectory()) continue;
        const dst = path.join(GLOBAL_SKILLS_DIR, entry);
        try { fs.rmSync(dst, { recursive: true, force: true }); } catch {}
        try { fs.symlinkSync(src, dst, 'dir'); count++; }
        catch { try { fs.cpSync(src, dst, { recursive: true }); count++; } catch {} }
      }
      log('✅ ' + count + ' skills installed');
    } else {
      log('⚠️  Skills not found. Run: steer-agent install');
    }

    console.log('');
    log('Done! Next steps:');
    log('  steer-agent install --ext   ← install VS Code / Cursor sidebar (optional)');
    log('  cd <your-project> && steer-agent init');
    log('  Restart Claude Code → /steer-start');
    console.log('');
  } catch (err) {
    // NEVER fail npm install
    log('⚠️  Auto-setup incomplete: ' + (err.message || String(err)));
    log('Run: steer-agent install');
  }
}

main();

import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface InstallArgs {
  force?: boolean;
  noExt?: boolean;
}

function parseArgs(argv: string[]): InstallArgs {
  const args: InstallArgs = {};
  for (const arg of argv) {
    if (arg === "--force" || arg === "-f") args.force = true;
    if (arg === "--no-ext" || arg === "--no-extension") args.noExt = true;
  }
  return args;
}

function loadOrCreateSettings(settingsPath: string): Record<string, unknown> {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
}

function resolveSkillsDir(): string {
  // 1. Package-local skills/ (present after prepack / in published npm package)
  const pkgLocal = path.join(__dirname, "..", "skills");
  if (fs.existsSync(pkgLocal)) return pkgLocal;

  // 2. Walk up from __dirname to find .claude/skills/ (monorepo / npm link)
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, ".claude", "skills");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate skills directory. Run: steer-agent install after npm install -g.");
}

function resolveCommandsDir(): string | null {
  // 1. Package-local commands/ (present after prepack / in published npm package)
  const pkgLocal = path.join(__dirname, "..", "commands");
  if (fs.existsSync(pkgLocal)) return pkgLocal;

  // 2. Walk up from __dirname to find .claude/commands/ (monorepo / npm link)
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, ".claude", "commands");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function findVsixPath(): string | null {
  // 1. Package-local extension/ dir (after prepack copy)
  const localExt = path.join(__dirname, "..", "extension");
  if (fs.existsSync(localExt)) {
    const files = fs.readdirSync(localExt).filter((f) => f.endsWith(".vsix"));
    if (files.length > 0) {
      files.sort().reverse(); // newest version first
      return path.join(localExt, files[0]);
    }
  }
  // 2. Walk up to find packages/cursor-extension/ (monorepo / npm link)
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    for (const sub of ["packages/cursor-extension", "cursor-extension"]) {
      const candidate = path.join(dir, sub);
      if (fs.existsSync(candidate)) {
        const files = fs.readdirSync(candidate).filter((f) => f.endsWith(".vsix"));
        if (files.length > 0) {
          files.sort().reverse();
          return path.join(candidate, files[0]);
        }
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function findSteerMcpBin(): string {
  // Prefer absolute path from our own dist/ (works without PATH lookup)
  const local = path.join(__dirname, "mcp-entry.js");
  if (fs.existsSync(local)) return local;
  // Fall back to command name (works when steer-mcp is in PATH)
  return "steer-mcp";
}

function findNodeBin(): string {
  // Use absolute path to node so MCP works even when nvm isn't loaded in PATH
  // (Claude Code, Cursor, etc. often have a minimal PATH without nvm)
  const nodeBin = process.execPath;
  if (nodeBin && fs.existsSync(nodeBin)) return nodeBin;
  return "node";
}

export async function runInstall(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/";
  const claudeDir = path.join(home, ".claude");
  const settingsPath = path.join(claudeDir, "settings.json");

  console.log("\n⚡ Installing SteerAgent...\n");

  // Ensure ~/.claude/ exists
  fs.mkdirSync(claudeDir, { recursive: true });

  const settings = loadOrCreateSettings(settingsPath);
  let changed = false;

  // 1. Register MCP server
  console.log("  MCP Server");
  if (!settings.mcpServers) (settings as Record<string, unknown>).mcpServers = {};
  const mcpServers = settings.mcpServers as Record<string, unknown>;

  if (!mcpServers["steer-agent"] || args.force) {
    const steerMcpBin = findSteerMcpBin();
    // Use absolute paths for both node and mcp-entry.js so MCP works
    // even without nvm in PATH (Claude Code, Cursor, etc.)
    const isAbsolute = path.isAbsolute(steerMcpBin);
    const nodeBin = findNodeBin();
    mcpServers["steer-agent"] = isAbsolute
      ? { command: nodeBin, args: [steerMcpBin], env: {} }
      : { command: steerMcpBin, args: [], env: {} };
    changed = true;
    console.log("  ├── Registering in ~/.claude/settings.json");
    console.log("  └── ✅ steer-agent MCP server registered");
  } else {
    console.log("  └── ✅ MCP server already registered");
  }

  // 2. Install skills (symlinks)
  console.log("\n  Skills");
  const globalSkillsDir = path.join(claudeDir, "skills");
  fs.mkdirSync(globalSkillsDir, { recursive: true });

  let skillsInstalled = 0;
  let skillsSource: string;
  try {
    skillsSource = resolveSkillsDir();
    const skills = fs.readdirSync(skillsSource).filter((f) =>
      fs.statSync(path.join(skillsSource, f)).isDirectory()
    );

    for (const skill of skills) {
      const source = path.join(skillsSource, skill);
      const target = path.join(globalSkillsDir, skill);

      // Remove existing (broken symlink or old dir) if force
      const targetExists = (() => { try { fs.lstatSync(target); return true; } catch { return false; } })();
      if (targetExists) {
        if (args.force) {
          fs.rmSync(target, { recursive: true, force: true });
        } else {
          skillsInstalled++;
          continue;
        }
      }

      try {
        fs.symlinkSync(source, target, "dir");
        skillsInstalled++;
      } catch {
        // Target may already exist (not force mode)
        skillsInstalled++;
      }
    }

    console.log(`  ├── Linking to ~/.claude/skills/`);
    console.log(`  └── ✅ ${skillsInstalled} skills installed`);
  } catch (err) {
    console.log(`  └── ⚠️  Could not install skills: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Install commands (symlinks for slash commands like /steer)
  console.log("\n  Commands");
  const globalCommandsDir = path.join(claudeDir, "commands");
  fs.mkdirSync(globalCommandsDir, { recursive: true });

  let commandsInstalled = 0;
  const commandsSource = resolveCommandsDir();
  if (commandsSource) {
    const commandDirs = fs.readdirSync(commandsSource).filter((f) =>
      fs.statSync(path.join(commandsSource, f)).isDirectory()
    );

    for (const cmd of commandDirs) {
      const source = path.join(commandsSource, cmd);
      const target = path.join(globalCommandsDir, cmd);

      const targetExists = (() => { try { fs.lstatSync(target); return true; } catch { return false; } })();
      if (targetExists) {
        if (args.force) {
          fs.rmSync(target, { recursive: true, force: true });
        } else {
          commandsInstalled++;
          continue;
        }
      }

      try {
        fs.symlinkSync(source, target, "dir");
        commandsInstalled++;
      } catch {
        commandsInstalled++;
      }
    }

    console.log(`  ├── Linking to ~/.claude/commands/`);
    console.log(`  └── ✅ ${commandsInstalled} command namespaces installed`);
  } else {
    console.log(`  └── ⚠️  No commands directory found — skipping`);
  }

  // 4. Register hook
  console.log("\n  Hooks");
  if (!settings.hooks) (settings as Record<string, unknown>).hooks = {};
  const hooks = settings.hooks as Record<string, unknown>;
  if (!hooks.UserPromptSubmit) hooks.UserPromptSubmit = [];
  const userHooks = hooks.UserPromptSubmit as Array<Record<string, unknown>>;

  const hasSteerHook = userHooks.some((h) => {
    // Check new format: { hooks: [{ command: "..." }] }
    if (h && Array.isArray((h as Record<string, unknown>).hooks)) {
      return ((h as Record<string, unknown>).hooks as Array<Record<string, unknown>>).some(
        (inner) => typeof inner.command === "string" && (inner.command.includes("steer-hook-prompt") || inner.command.includes("prompt-submit"))
      );
    }
    // Check old format: { command: "..." }
    return typeof h.command === "string" && (h.command.includes("steer-hook-prompt") || h.command.includes("prompt-submit"));
  });

  // Use absolute paths for both node and hook script to survive PATH changes
  const hookAbsPath = path.join(__dirname, "hooks", "prompt-submit.js");
  const hookNodeBin = findNodeBin();
  const hookCmd = fs.existsSync(hookAbsPath)
    ? `${hookNodeBin} ${hookAbsPath}`
    : "steer-hook-prompt";

  if (!hasSteerHook || args.force) {
    if (args.force) {
      const filtered = userHooks.filter((h) => {
        if (h && Array.isArray((h as Record<string, unknown>).hooks)) {
          return !((h as Record<string, unknown>).hooks as Array<Record<string, unknown>>).some(
            (inner) => typeof inner.command === "string" && (inner.command.includes("steer-hook-prompt") || inner.command.includes("prompt-submit"))
          );
        }
        return !(typeof h.command === "string" && (h.command.includes("steer-hook-prompt") || h.command.includes("prompt-submit")));
      });
      hooks.UserPromptSubmit = filtered;
      (hooks.UserPromptSubmit as Array<unknown>).push({
        hooks: [
          {
            type: "command",
            command: hookCmd,
            timeout: 5000,
          },
        ],
      });
    } else {
      userHooks.push({
        hooks: [
          {
            type: "command",
            command: hookCmd,
            timeout: 5000,
          },
        ],
      });
    }
    changed = true;
    console.log("  ├── Registering UserPromptSubmit hook");
    console.log("  └── ✅ Hook registered");
  } else {
    console.log("  └── ✅ Hook already registered");
  }

  // Save settings
  if (changed) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }

  // 4. VS Code / Cursor extension (installed by default, skip with --no-ext)
  console.log("\n  VS Code / Cursor Extension");
  if (!args.noExt) {
    const vsixPath = findVsixPath();

    if (vsixPath) {
      let installed = false;
      // Try CLI commands first, then macOS app bundle paths as fallback
      const editorCandidates = [
        "cursor",
        "code",
        "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
        "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
      ];
      for (const editor of editorCandidates) {
        try {
          execSync(`"${editor}" --install-extension "${vsixPath}" 2>/dev/null`, { stdio: "pipe" });
          const name = editor.includes("cursor") || editor.includes("Cursor") ? "cursor" : "code";
          console.log(`  └── ✅ Extension installed via ${name}`);
          installed = true;
          break;
        } catch {}
      }
      if (!installed) {
        console.log(`  └── ⚠️  Automatic install failed. Manual steps:`);
        console.log(`       1. Open Cursor / VS Code`);
        console.log(`       2. Cmd+Shift+P → "Extensions: Install from VSIX"`);
        console.log(`       3. Select: ${vsixPath}`);
      }
    } else {
      console.log("  └── ⚠️  No .vsix file found in package.");
      console.log("       Build it first: cd packages/cursor-extension && npm run package");
    }
  } else {
    console.log("  └── ⏭  Skipped (--no-ext)");
  }

  console.log("\n═══════════════════════════════════════");
  console.log("⚡ SteerAgent installed successfully!");
  console.log("═══════════════════════════════════════");
  console.log("\nNext steps:");
  console.log("  cd <your-project>");
  console.log("  steer-agent init --template coinswitch");
  console.log("  Open Claude Code → /steer to get started\n");
}

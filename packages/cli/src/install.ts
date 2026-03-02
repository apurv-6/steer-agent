import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface InstallArgs {
  force?: boolean;
  skipExtension?: boolean;
}

function parseArgs(argv: string[]): InstallArgs {
  const args: InstallArgs = {};
  for (const arg of argv) {
    if (arg === "--force" || arg === "-f") args.force = true;
    if (arg === "--skip-extension") args.skipExtension = true;
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
  // When running from dist/, skills are at repo root .claude/skills/
  // Walk up from __dirname to find .claude/skills/
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, ".claude", "skills");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate .claude/skills/ directory relative to the steer-agent package.");
}

function findSteerMcpBin(): string {
  // Find the steer-mcp binary in PATH
  try {
    const result = execSync("which steer-mcp 2>/dev/null || true", { encoding: "utf8" }).trim();
    if (result) return result;
  } catch {}
  return "steer-mcp";
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
    mcpServers["steer-agent"] = {
      command: steerMcpBin,
      args: [],
      env: {},
    };
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

  // 3. Register hook
  console.log("\n  Hooks");
  if (!settings.hooks) (settings as Record<string, unknown>).hooks = {};
  const hooks = settings.hooks as Record<string, unknown>;
  if (!hooks.UserPromptSubmit) hooks.UserPromptSubmit = [];
  const userHooks = hooks.UserPromptSubmit as Array<Record<string, unknown>>;

  const hasSteerHook = userHooks.some(
    (h) => typeof h.command === "string" && h.command.includes("steer-hook-prompt")
  );

  if (!hasSteerHook || args.force) {
    if (args.force) {
      const filtered = userHooks.filter(
        (h) => !(typeof h.command === "string" && h.command.includes("steer-hook-prompt"))
      );
      hooks.UserPromptSubmit = filtered;
      (hooks.UserPromptSubmit as Array<unknown>).push({
        type: "command",
        command: "steer-hook-prompt",
        timeout: 5000,
      });
    } else {
      userHooks.push({
        type: "command",
        command: "steer-hook-prompt",
        timeout: 5000,
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

  // 4. VS Code / Cursor extension (optional, non-blocking)
  if (!args.skipExtension) {
    console.log("\n  VS Code / Cursor Extension");
    const vsixDir = path.join(__dirname, "..", "..", "extension");
    let vsixPath: string | undefined;
    if (fs.existsSync(vsixDir)) {
      const vsixFiles = fs.readdirSync(vsixDir).filter((f) => f.endsWith(".vsix"));
      if (vsixFiles.length > 0) {
        vsixPath = path.join(vsixDir, vsixFiles[0]);
      }
    }

    if (vsixPath) {
      let installed = false;
      for (const editor of ["code", "cursor"]) {
        try {
          execSync(`${editor} --install-extension "${vsixPath}" 2>/dev/null`, { stdio: "pipe" });
          console.log(`  └── ✅ Extension installed via ${editor}`);
          installed = true;
          break;
        } catch {}
      }
      if (!installed) {
        console.log(`  └── ⚠️  Manual install: Extensions → Install from VSIX → ${vsixPath}`);
      }
    } else {
      console.log("  └── ⏭  No .vsix found (skip)");
    }
  }

  console.log("\n═══════════════════════════════════════");
  console.log("⚡ SteerAgent installed successfully!");
  console.log("═══════════════════════════════════════");
  console.log("\nNext steps:");
  console.log("  cd <your-project>");
  console.log("  steer-agent init --template coinswitch");
  console.log("  Open Claude Code → /steer to get started\n");
}

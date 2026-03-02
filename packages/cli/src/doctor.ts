import { steerDirExists, findSteerDir, VERSION } from "@steer-agent-tool/core";
import { checkForUpdate } from "./update.js";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DoctorResult {
  label: string;
  status: "ok" | "fixed" | "warn" | "error";
  message: string;
  fix?: string;
}

function readSettings(home: string): Record<string, unknown> {
  const settingsPath = path.join(home, ".claude", "settings.json");
  if (!fs.existsSync(settingsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
}

function saveSettings(home: string, settings: Record<string, unknown>): void {
  const settingsPath = path.join(home, ".claude", "settings.json");
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function resolveSkillsDir(): string | null {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, ".claude", "skills");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export async function runDoctor(): Promise<void> {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/";
  const cwd = process.cwd();
  const results: DoctorResult[] = [];

  console.log(`\n⚡ SteerAgent v${VERSION} — Doctor\n`);

  const settings = readSettings(home);
  let settingsChanged = false;

  // 1. MCP server registration
  const mcpServers = (settings.mcpServers ?? {}) as Record<string, unknown>;
  if ("steer-agent" in mcpServers) {
    results.push({ label: "MCP server registered", status: "ok", message: "steer-agent registered in settings.json" });
  } else {
    // Auto-fix: register it
    if (!settings.mcpServers) (settings as Record<string, unknown>).mcpServers = {};
    (settings.mcpServers as Record<string, unknown>)["steer-agent"] = {
      command: "steer-mcp",
      args: [],
      env: {},
    };
    settingsChanged = true;
    results.push({ label: "MCP server registered", status: "fixed", message: "Was missing — added steer-mcp registration" });
  }

  // 2. Skills — check symlinks
  const globalSkillsDir = path.join(home, ".claude", "skills");
  const skillsSource = resolveSkillsDir();
  if (!skillsSource) {
    results.push({ label: "Skills", status: "warn", message: "Could not locate skills source directory", fix: "Run: steer-agent install" });
  } else {
    const expectedSkills = fs.readdirSync(skillsSource).filter((f) =>
      fs.statSync(path.join(skillsSource, f)).isDirectory()
    );
    let brokenCount = 0;
    let fixedCount = 0;
    fs.mkdirSync(globalSkillsDir, { recursive: true });

    for (const skill of expectedSkills) {
      const target = path.join(globalSkillsDir, skill);
      const source = path.join(skillsSource, skill);
      const isSymlink = (() => { try { return fs.lstatSync(target).isSymbolicLink(); } catch { return false; } })();
      const exists = isSymlink || fs.existsSync(target);

      if (isSymlink) {
        // Check if symlink is valid
        try {
          fs.readdirSync(target);
          // valid
        } catch {
          brokenCount++;
          fs.rmSync(target, { recursive: true, force: true });
          fs.symlinkSync(source, target, "dir");
          fixedCount++;
        }
      } else if (!exists) {
        // Missing — create symlink
        try {
          fs.symlinkSync(source, target, "dir");
          fixedCount++;
        } catch {
          brokenCount++;
        }
      }
    }

    if (fixedCount > 0) {
      results.push({ label: "Skills", status: "fixed", message: `Fixed ${fixedCount} skill symlink(s)` });
    } else {
      results.push({ label: "Skills", status: "ok", message: `${expectedSkills.length} skills OK` });
    }
  }

  // 3. Hook registration
  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  const userHooks = (hooks.UserPromptSubmit ?? []) as Array<Record<string, unknown>>;
  const hasHook = userHooks.some(
    (h) => typeof h.command === "string" && h.command.includes("steer-hook-prompt")
  );
  if (hasHook) {
    results.push({ label: "UserPromptSubmit hook", status: "ok", message: "Registered" });
  } else {
    if (!settings.hooks) (settings as Record<string, unknown>).hooks = {};
    const h = settings.hooks as Record<string, unknown>;
    if (!h.UserPromptSubmit) h.UserPromptSubmit = [];
    (h.UserPromptSubmit as Array<unknown>).push({ type: "command", command: "steer-hook-prompt", timeout: 5000 });
    settingsChanged = true;
    results.push({ label: "UserPromptSubmit hook", status: "fixed", message: "Was missing — registered steer-hook-prompt" });
  }

  // 4. Node version
  const [major] = process.versions.node.split(".").map(Number);
  results.push({
    label: "Node.js version",
    status: major >= 18 ? "ok" : "error",
    message: `v${process.versions.node}`,
    fix: major < 18 ? "Install Node.js >= 18" : undefined,
  });

  // 5. Project .steer/ checks
  if (steerDirExists(cwd)) {
    const steerDir = findSteerDir(cwd);

    // Config valid?
    const configPath = path.join(steerDir, "config.json");
    if (fs.existsSync(configPath)) {
      try {
        JSON.parse(fs.readFileSync(configPath, "utf8"));
        results.push({ label: ".steer/config.json", status: "ok", message: "Valid JSON" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ label: ".steer/config.json", status: "error", message: `Invalid JSON: ${msg}`, fix: "Fix the JSON syntax error" });
      }
    } else {
      results.push({ label: ".steer/config.json", status: "warn", message: "Not found", fix: "Run: steer-agent init --force" });
    }

    // Codebase map age
    const mapPath = path.join(steerDir, "codebase-map.json");
    if (fs.existsSync(mapPath)) {
      const ageMs = Date.now() - fs.statSync(mapPath).mtimeMs;
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      if (ageDays > 7) {
        results.push({ label: "Codebase map", status: "warn", message: `${ageDays} days old`, fix: "Run: /steer-map in Claude Code to rebuild" });
      } else {
        results.push({ label: "Codebase map", status: "ok", message: "Up to date" });
      }
    } else {
      results.push({ label: "Codebase map", status: "warn", message: "Not found", fix: "Run: /steer-map in Claude Code" });
    }
  } else {
    results.push({ label: ".steer/ folder", status: "warn", message: "Not found in this project", fix: "Run: steer-agent init" });
  }

  // Save settings if changed
  if (settingsChanged) {
    saveSettings(home, settings);
  }

  // Print results
  let fixedCount = 0;
  let warnCount = 0;
  let errorCount = 0;

  for (const r of results) {
    const icon = r.status === "ok" ? "✅" : r.status === "fixed" ? "🔧" : r.status === "warn" ? "⚠️ " : "❌";
    console.log(`  ${icon} ${r.label}`);
    if (r.message && r.status !== "ok") console.log(`     └── ${r.message}`);
    if (r.fix) console.log(`     └── Fix: ${r.fix}`);
    if (r.status === "fixed") fixedCount++;
    if (r.status === "warn") warnCount++;
    if (r.status === "error") errorCount++;
  }

  console.log();
  if (fixedCount > 0) console.log(`Fixed: ${fixedCount} issue(s)`);
  if (warnCount > 0) console.log(`Warnings: ${warnCount} (non-blocking)`);
  if (errorCount > 0) console.log(`Errors: ${errorCount} (action required)`);
  if (fixedCount === 0 && warnCount === 0 && errorCount === 0) {
    console.log("All checks passed ✅");
  }

  // Check for update (non-blocking, best-effort)
  const pkgPath = path.join(__dirname, "..", "package.json");
  let packageName = "@steer-agent-tool/cli";
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    packageName = pkg.name ?? packageName;
  } catch {}
  const latest = checkForUpdate(packageName, VERSION);
  if (latest) {
    console.log(`\n  💡 Update available: v${VERSION} → v${latest}`);
    console.log(`     Run: steer-agent update`);
  }
  console.log();
}

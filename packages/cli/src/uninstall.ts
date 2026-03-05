import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { VERSION } from "@steer-agent-tool/core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function readPackageName(): string {
  const pkgPath = path.join(__dirname, "..", "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return pkg.name ?? "@steer-agent-tool/cli";
  } catch {
    return "@steer-agent-tool/cli";
  }
}

export async function runUninstall(argv: string[]): Promise<void> {
  const yes = argv.includes("--yes") || argv.includes("-y");
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/";
  const packageName = readPackageName();

  console.log(`\n⚡ SteerAgent v${VERSION} — Uninstall\n`);
  console.log("  This will remove:");
  console.log("  ├── MCP server registration from ~/.claude/settings.json");
  console.log("  ├── steer-* skill symlinks from ~/.claude/skills/");
  console.log("  ├── steer-hook-prompt from UserPromptSubmit hooks");
  console.log("  └── VS Code / Cursor extension\n");
  console.log("  This will NOT remove:");
  console.log("  ├── .steer/ folders in your projects (your data is safe)");
  console.log("  └── history.jsonl, knowledge files, etc.\n");

  if (!yes) {
    process.stdout.write("  Continue? (y/N) ");
    const answer = await new Promise<string>((resolve) => {
      process.stdin.setEncoding("utf8");
      process.stdin.once("data", (d) => resolve(String(d).trim().toLowerCase()));
    });
    if (answer !== "y" && answer !== "yes") {
      console.log("\n  Cancelled.\n");
      return;
    }
    console.log();
  }

  const settings = readSettings(home);
  let changed = false;

  // 1. Remove MCP registration
  const mcpServers = (settings.mcpServers ?? {}) as Record<string, unknown>;
  if ("steer-agent" in mcpServers) {
    delete mcpServers["steer-agent"];
    settings.mcpServers = mcpServers;
    changed = true;
    console.log("  ✅ MCP server deregistered");
  } else {
    console.log("  ⏭  MCP server was not registered");
  }

  // 2. Remove skill symlinks
  const globalSkillsDir = path.join(home, ".claude", "skills");
  let removedSkills = 0;
  if (fs.existsSync(globalSkillsDir)) {
    const entries = fs.readdirSync(globalSkillsDir).filter((f) => f.startsWith("steer"));
    for (const entry of entries) {
      const target = path.join(globalSkillsDir, entry);
      try {
        fs.rmSync(target, { recursive: true, force: true });
        removedSkills++;
      } catch {
        // ignore
      }
    }
  }
  if (removedSkills > 0) {
    console.log(`  ✅ ${removedSkills} skill symlinks removed`);
  } else {
    console.log("  ⏭  No skill symlinks found");
  }

  // 3. Remove hook
  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  const userHooks = (hooks.UserPromptSubmit ?? []) as Array<Record<string, unknown>>;
  const before = userHooks.length;
  const filtered = userHooks.filter(
    (h) => !(typeof h.command === "string" && h.command.includes("steer-hook-prompt"))
  );
  if (filtered.length < before) {
    hooks.UserPromptSubmit = filtered;
    settings.hooks = hooks;
    changed = true;
    console.log("  ✅ Hook removed");
  } else {
    console.log("  ⏭  Hook was not registered");
  }

  // Save settings
  if (changed) {
    saveSettings(home, settings);
  }

  // 4. Uninstall extension (optional, non-fatal)
  let extensionRemoved = false;
  for (const editor of ["code", "cursor"]) {
    try {
      execSync(`${editor} --uninstall-extension steer-agent 2>/dev/null`, { stdio: "pipe" });
      extensionRemoved = true;
      break;
    } catch {}
  }
  if (extensionRemoved) {
    console.log("  ✅ Extension uninstalled");
  } else {
    console.log("  ⏭  Extension not found or not installed");
  }

  console.log("\n  To fully remove the npm package:");
  console.log(`  npm uninstall -g ${packageName}\n`);
}

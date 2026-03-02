import { steerDirExists, findSteerDir, VERSION } from "@steer-agent-tool/core";
import { checkForUpdate } from "./update.js";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readPackageName(): string {
  const pkgPath = path.join(__dirname, "..", "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return pkg.name ?? "@steer-agent-tool/cli";
  } catch {
    return "@steer-agent-tool/cli";
  }
}

function check(label: string, ok: boolean, detail = ""): void {
  const icon = ok ? "✅" : "❌";
  const suffix = detail ? `  ${detail}` : "";
  console.log(`  ${icon}  ${label}${suffix}`);
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

export async function runStatus(): Promise<void> {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/";
  const cwd = process.cwd();
  const settings = readSettings(home);

  const nodeVersion = process.versions.node;
  const [major] = nodeVersion.split(".").map(Number);

  console.log(`\n⚡ SteerAgent v${VERSION} Status`);
  console.log("═══════════════════════════════════════\n");

  // === GLOBAL ===
  console.log("GLOBAL (machine-wide):");

  // MCP
  const mcpServers = (settings.mcpServers ?? {}) as Record<string, unknown>;
  const mcpRegistered = "steer-agent" in mcpServers;
  check("MCP Server", mcpRegistered, mcpRegistered ? "steer-mcp registered" : "Run: steer-agent install");

  // Skills
  const globalSkillsDir = path.join(home, ".claude", "skills");
  let skillCount = 0;
  if (fs.existsSync(globalSkillsDir)) {
    skillCount = fs.readdirSync(globalSkillsDir).filter((f) =>
      f.startsWith("steer") && fs.statSync(path.join(globalSkillsDir, f)).isDirectory()
    ).length;
  }
  check("Skills", skillCount > 0, `${skillCount} installed in ~/.claude/skills/`);

  // Hook
  const hooks = ((settings.hooks ?? {}) as Record<string, unknown>);
  const userHooks = (hooks.UserPromptSubmit ?? []) as Array<Record<string, unknown>>;
  const hookRegistered = userHooks.some(
    (h) => typeof h.command === "string" && h.command.includes("steer-hook-prompt")
  );
  check("Hooks", hookRegistered, hookRegistered ? "UserPromptSubmit registered" : "Run: steer-agent install");

  // Node
  check("Node.js", major >= 18, `v${nodeVersion}${major < 18 ? " (>=18 required)" : ""}`);

  // === PROJECT ===
  console.log("\nPROJECT (" + path.basename(cwd) + "):");

  const steerExists = steerDirExists(cwd);
  if (!steerExists) {
    console.log("  ❌  .steer/  not found — Run: steer-agent init");
    console.log("\nHEALTH: Global OK, project not initialized\n");
    return;
  }

  const steerDir = findSteerDir(cwd);
  check(".steer/", true, steerDir);

  // Config
  const configPath = path.join(steerDir, "config.json");
  let configOk = false;
  let configDetail = "not found";
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
      configOk = true;
      const parts: string[] = [`v${cfg.version ?? "?"}`];
      if (cfg.team) parts.push(`team: ${cfg.team}`);
      if (cfg.organization && cfg.organization !== "default") parts.push(`org: ${cfg.organization}`);
      configDetail = parts.join(", ");
    } catch {
      configDetail = "invalid JSON";
    }
  }
  check("Config", configOk, configDetail);

  // Rules
  const rulesPath = path.join(steerDir, "RULES.md");
  const rulesExists = fs.existsSync(rulesPath);
  let rulesDetail = "not found";
  if (rulesExists) {
    const content = fs.readFileSync(rulesPath, "utf8");
    const blockCount = (content.match(/\[BLOCK\]/g) ?? []).length;
    const warnCount = (content.match(/\[WARN\]/g) ?? []).length;
    const autoCount = (content.match(/\[AUTO\]/g) ?? []).length;
    rulesDetail = `${blockCount + warnCount + autoCount} rules (${blockCount} BLOCK, ${warnCount} WARN, ${autoCount} AUTO)`;
  }
  check("Rules", rulesExists, rulesDetail);

  // Templates
  const templatesDir = path.join(steerDir, "templates");
  const templateCount = fs.existsSync(templatesDir)
    ? fs.readdirSync(templatesDir).filter((f) => f.endsWith(".md")).length
    : 0;
  check("Templates", templateCount > 0, `${templateCount} templates`);

  // Knowledge
  const knowledgeDir = path.join(steerDir, "knowledge");
  const knowledgeCount = fs.existsSync(knowledgeDir)
    ? fs.readdirSync(knowledgeDir).filter((f) => f.endsWith(".md")).length
    : 0;
  check("Knowledge", knowledgeCount > 0, `${knowledgeCount} files`);

  // History
  const historyPath = path.join(steerDir, "state", "history.jsonl");
  let historyCount = 0;
  if (fs.existsSync(historyPath)) {
    const lines = fs.readFileSync(historyPath, "utf8").split("\n").filter((l) => l.trim());
    historyCount = lines.length;
  }
  check("History", true, `${historyCount} tasks logged`);

  // Codebase map
  const mapPath = path.join(steerDir, "codebase-map.json");
  const mapExists = fs.existsSync(mapPath);
  let mapDetail = "not found — run /steer-map to build";
  if (mapExists) {
    const stat = fs.statSync(mapPath);
    const ageMs = Date.now() - stat.mtimeMs;
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    mapDetail = ageDays > 7 ? `${ageDays}d old (consider rebuilding)` : "up to date";
  }
  check("Codebase Map", mapExists, mapDetail);

  const allOk = mcpRegistered && skillCount > 0 && hookRegistered && configOk && major >= 18;
  console.log(`\nHEALTH: ${allOk ? "All systems operational ✅" : "Issues found — run: steer-agent doctor"}`);

  // Check for update (non-blocking, best-effort)
  const latest = checkForUpdate(readPackageName(), VERSION);
  if (latest) {
    console.log(`\n  💡 Update available: v${VERSION} → v${latest}`);
    console.log(`     Run: steer-agent update`);
  }
  console.log();
}

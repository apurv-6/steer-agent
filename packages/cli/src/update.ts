import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { VERSION } from "@steer-agent-tool/core";

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

/** Simple semver comparison: returns true if b > a */
function isNewer(a: string, b: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (bMaj !== aMaj) return bMaj > aMaj;
  if (bMin !== aMin) return bMin > aMin;
  return bPat > aPat;
}

export function checkForUpdate(packageName: string, currentVersion: string): string | null {
  try {
    const latest = execSync(`npm view "${packageName}" version 2>/dev/null`, {
      encoding: "utf8",
      timeout: 8000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (latest && isNewer(currentVersion, latest)) return latest;
  } catch {
    // Offline or registry unreachable — skip silently
  }
  return null;
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

function relinkSkills(home: string, skillsSource: string): number {
  const globalSkillsDir = path.join(home, ".claude", "skills");
  fs.mkdirSync(globalSkillsDir, { recursive: true });
  const skills = fs.readdirSync(skillsSource).filter((f) =>
    fs.statSync(path.join(skillsSource, f)).isDirectory()
  );
  let count = 0;
  for (const skill of skills) {
    const source = path.join(skillsSource, skill);
    const target = path.join(globalSkillsDir, skill);
    try {
      fs.rmSync(target, { recursive: true, force: true });
      fs.symlinkSync(source, target, "dir");
      count++;
    } catch {
      // ignore
    }
  }
  return count;
}

function installExtension(packageRoot: string): "vscode" | "cursor" | "none" {
  const vsixDir = path.join(packageRoot, "extension");
  if (!fs.existsSync(vsixDir)) return "none";
  const vsixFiles = fs.readdirSync(vsixDir).filter((f) => f.endsWith(".vsix"));
  if (vsixFiles.length === 0) return "none";
  const vsixPath = path.join(vsixDir, vsixFiles[0]);
  for (const editor of ["code", "cursor"] as const) {
    try {
      execSync(`${editor} --install-extension "${vsixPath}" 2>/dev/null`, { stdio: "pipe" });
      return editor;
    } catch {}
  }
  return "none";
}

export async function runUpdate(argv: string[]): Promise<void> {
  const skipExtension = argv.includes("--skip-extension");
  const yes = argv.includes("--yes") || argv.includes("-y");
  const packageName = readPackageName();
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/";

  console.log(`\n⚡ Checking for updates...\n`);
  console.log(`  Current: v${VERSION}`);

  const latest = checkForUpdate(packageName, VERSION);
  if (!latest) {
    console.log(`  Status:  Already up to date ✅\n`);
    return;
  }

  console.log(`  Latest:  v${latest}\n`);

  if (!yes) {
    // Non-interactive confirmation via stdin
    process.stdout.write(`  Update from v${VERSION} → v${latest}? (y/N) `);
    const answer = await new Promise<string>((resolve) => {
      process.stdin.setEncoding("utf8");
      process.stdin.once("data", (d) => resolve(String(d).trim().toLowerCase()));
    });
    if (answer !== "y" && answer !== "yes") {
      console.log("\n  Cancelled.\n");
      return;
    }
  }

  console.log(`\n  Updating ${packageName}...`);
  try {
    execSync(`npm install -g "${packageName}@${latest}"`, { stdio: "inherit" });
  } catch {
    console.error(`\n  ❌ npm install failed. Try manually:\n  npm install -g "${packageName}@latest"\n`);
    return;
  }

  // Re-link skills (package root is now the newly installed version)
  const skillsSource = resolveSkillsDir();
  if (skillsSource) {
    const count = relinkSkills(home, skillsSource);
    console.log(`  ✅ ${count} skills re-linked`);
  }

  // Extension
  if (!skipExtension) {
    const packageRoot = path.join(__dirname, "..", "..");
    const editor = installExtension(packageRoot);
    if (editor !== "none") {
      console.log(`  ✅ Extension updated via ${editor} (reload to activate)`);
    }
  }

  console.log(`\n  ✅ Updated to v${latest}\n`);
}

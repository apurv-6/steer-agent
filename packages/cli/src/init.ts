import { initSteer } from "@steer-agent-tool/core";
import { existsSync } from "node:fs";
import path from "node:path";

interface InitArgs {
  template?: string;
  team?: string;
  org?: string;
  force?: boolean;
  noTemplates?: boolean;
}

function parseInitArgs(argv: string[]): InitArgs {
  const args: InitArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--template" || arg === "-t") {
      args.template = argv[++i];
    } else if (arg === "--team") {
      args.team = argv[++i];
    } else if (arg === "--org") {
      args.org = argv[++i];
    } else if (arg === "--force" || arg === "-f") {
      args.force = true;
    } else if (arg === "--no-templates") {
      args.noTemplates = true;
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`steer-agent init [options]

Options:
  --template, -t  <preset>  Use a preset: coinswitch | minimal | strict (default: minimal)
  --team <name>             Team name (default: "engineering")
  --org <name>              Organization name (default: "default")
  --force, -f               Overwrite existing .steer/
  --no-templates            Skip copying prompt templates
  --help, -h                Show this help`);
}

export async function runInit(argv: string[]): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const args = parseInitArgs(argv);
  const template = args.template ?? "minimal";
  const validTemplates = ["coinswitch", "minimal", "strict"];
  if (!validTemplates.includes(template)) {
    console.error(`Unknown template "${template}". Valid options: ${validTemplates.join(", ")}`);
    process.exit(1);
  }

  const cwd = process.cwd();
  const steerDir = path.join(cwd, ".steer");

  if (existsSync(steerDir) && !args.force) {
    console.error(
      `.steer/ already exists in ${cwd}.\nUse --force to overwrite.`
    );
    process.exit(1);
  }

  const projectName = path.basename(cwd);
  console.log(`\n⚡ Initializing SteerAgent in ${projectName}...`);
  console.log(`  Template: ${template}`);
  if (args.team) console.log(`  Team: ${args.team}`);
  if (args.org) console.log(`  Org: ${args.org}`);
  console.log();

  const result = await initSteer(cwd, {
    template,
    team: args.team,
    org: args.org,
    force: args.force,
    noTemplates: args.noTemplates,
  });

  console.log("  Created:");
  console.log(`  ├── .steer/config.json       ← Project configuration`);
  console.log(`  ├── .steer/RULES.md           ← Governance rules`);
  console.log(`  ├── .steer/hooks.yaml         ← Lifecycle hooks`);
  if (!args.noTemplates) {
    console.log(`  ├── .steer/templates/         ← Prompt templates`);
  }
  console.log(`  ├── .steer/knowledge/         ← Starts empty, grows with tasks`);
  console.log(`  └── .steer/state/             ← Runtime state (gitignored)`);
  console.log();
  console.log("═══════════════════════════════════════");
  console.log("⚡ SteerAgent initialized successfully!");
  console.log("═══════════════════════════════════════");
  console.log();
  console.log("Next steps:");
  console.log("  1. Edit .steer/config.json — add your critical modules");
  console.log("  2. Open Claude Code and type /steer to get started");
  console.log("  3. Commit .steer/ to git (state/ is already gitignored)");

  void result;
}

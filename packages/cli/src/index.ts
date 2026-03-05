import { VERSION } from "@steer-agent-tool/core";

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case "install":
    await runInstallCmd(rest);
    break;
  case "init":
    await runInitCmd(rest);
    break;
  case "status":
    await runStatusCmd();
    break;
  case "doctor":
    await runDoctorCmd();
    break;
  case "update":
    await runUpdateCmd(rest);
    break;
  case "uninstall":
    await runUninstallCmd(rest);
    break;
  case "steer":
    await runSteerCmd();
    break;
  case "mcp":
    await runMcp();
    break;
  case "metrics":
    await runMetricsCmd();
    break;
  case "--version":
  case "-v":
    console.log(`steer-agent v${VERSION}`);
    break;
  case "--help":
  case "-h":
  case undefined:
    printUsage();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
}

async function runInstallCmd(argv: string[]): Promise<void> {
  const { runInstall } = await import("./install.js");
  await runInstall(argv);
}

async function runInitCmd(argv: string[]): Promise<void> {
  const { runInit } = await import("./init.js");
  await runInit(argv);
}

async function runStatusCmd(): Promise<void> {
  const { runStatus } = await import("./status.js");
  await runStatus();
}

async function runDoctorCmd(): Promise<void> {
  const { runDoctor } = await import("./doctor.js");
  await runDoctor();
}

async function runSteerCmd(): Promise<void> {
  const { runSteer } = await import("./steer.js");
  await runSteer();
}

async function runMcp(): Promise<void> {
  const { startServer } = await import("@steer-agent-tool/mcp-server");
  await startServer();
}

async function runUpdateCmd(argv: string[]): Promise<void> {
  const { runUpdate } = await import("./update.js");
  await runUpdate(argv);
}

async function runUninstallCmd(argv: string[]): Promise<void> {
  const { runUninstall } = await import("./uninstall.js");
  await runUninstall(argv);
}

async function runMetricsCmd(): Promise<void> {
  const { runMetrics } = await import("./metrics.js");
  await runMetrics();
}

function printUsage(): void {
  console.log(`steer-agent v${VERSION}

Usage:
  steer-agent install          Register MCP + skills + hooks globally (run once per machine)
  steer-agent init [options]   Initialize .steer/ in current project
  steer-agent status           Show installation and project health
  steer-agent doctor           Diagnose and auto-fix issues
  steer-agent update           Update to latest version
  steer-agent uninstall        Remove global components (keeps project data)
  steer-agent steer            Interactive prompt scoring (CLI)
  steer-agent mcp              Start the MCP server (stdio)
  steer-agent --version        Print version

Init options:
  --template coinswitch|minimal|strict   Preset (default: minimal)
  --team <name>                           Team name
  --org <name>                            Organization name
  --force                                 Overwrite existing .steer/`);
}

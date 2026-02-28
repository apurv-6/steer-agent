import { VERSION } from "@steer-agent-tool/core";

const [command] = process.argv.slice(2);

switch (command) {
  case "steer":
    await runSteerCmd();
    break;
  case "init":
    await runInit();
    break;
  case "mcp":
    await runMcp();
    break;
  case "metrics":
    await runMetricsCmd();
    break;
  case "--version":
  case "-v":
    console.log(`steer-agent-tool v${VERSION}`);
    break;
  default:
    printUsage();
    break;
}

async function runInit(): Promise<void> {
  // Check Node version
  const [major] = process.versions.node.split(".").map(Number);
  if (major < 18) {
    console.error(`Node.js >= 18 required (found ${process.versions.node})`);
    process.exit(1);
  }
  console.log(`Node.js ${process.versions.node} — OK`);

  // Use core initSteer to create .steer/ folder with all config
  const { initSteer } = await import("@steer-agent-tool/core");
  const cwd = process.cwd();
  console.log(`Initializing SteerAgent in ${cwd}...`);

  const result = await initSteer(cwd);
  console.log(`Created ${result.path}`);

  console.log("\nSetup complete! Next steps:");
  console.log('  1. Run "npx steer-agent-tool mcp" to start the MCP server');
  console.log("  2. Configure your MCP host (Cursor, VS Code, Claude Code)");
  console.log("  3. Use /steer:start to begin your first task");
}

async function runSteerCmd(): Promise<void> {
  const { runSteer } = await import("./steer.js");
  await runSteer();
}

async function runMcp(): Promise<void> {
  const { startServer } = await import("@steer-agent-tool/mcp-server");
  await startServer();
}

async function runMetricsCmd(): Promise<void> {
  const { runMetrics } = await import("./metrics.js");
  await runMetrics();
}

function printUsage(): void {
  console.log(`steer-agent-tool v${VERSION}

Usage:
  steer-agent-tool steer      Interactive prompt scoring and patching
  steer-agent-tool init       Set up data directory and verify environment
  steer-agent-tool mcp        Start the MCP server (stdio)
  steer-agent-tool metrics    Show telemetry metrics
  steer-agent-tool --version  Print version`);
}

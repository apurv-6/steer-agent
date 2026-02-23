import { createConfig, type SteerConfig } from "@steer-agent-tool/core";

export function startServer(): SteerConfig {
  const config = createConfig("mcp-server");
  console.log(`MCP Server initialized: ${config.name} v${config.version}`);
  return config;
}

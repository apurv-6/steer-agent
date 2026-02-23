import { createConfig } from "@steer-agent-tool/core";

const config = createConfig("cli");
console.log(`steer-agent-tool CLI v${config.version}`);

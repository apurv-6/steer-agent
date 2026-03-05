import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/gate.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: true,
  noExternal: [],
  external: [
    "@modelcontextprotocol/sdk",
    "@steer-agent-tool/core",
    "zod",
    "fs-extra",
    "yaml",
  ],
});

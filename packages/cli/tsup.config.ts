import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/mcp-entry.ts", "src/hooks/prompt-submit.ts"],
  format: ["esm"],
  platform: "node",
  // Output .js instead of .mjs so bin fields in package.json resolve correctly
  outExtension: () => ({ js: ".js" }),
  // Only bundle workspace packages (@steer-agent-tool/*).
  // All other node_modules stay external — Node resolves them at runtime,
  // avoiding the CJS dynamic-require shim that breaks fs-extra, yaml, etc.
  noExternal: [/@steer-agent-tool\//],
  clean: true,
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
});

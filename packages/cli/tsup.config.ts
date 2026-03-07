import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/mcp-entry.ts", "src/hooks/prompt-submit.ts"],
  format: ["esm"],
  platform: "node",
  // Output .js instead of .mjs so bin fields in package.json resolve correctly
  outExtension: () => ({ js: ".js" }),
  // Bundle workspace packages AND glob (v13 is pure ESM).
  // glob must be bundled because npm may hoist the CJS-only glob v7
  // (from @vscode/vsce) to root node_modules, shadowing the v13 the
  // code actually needs.  Other deps stay external to avoid CJS shims.
  noExternal: [/@steer-agent-tool\//, "glob"],
  clean: true,
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
});

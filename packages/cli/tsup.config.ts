import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/mcp-entry.ts", "src/hooks/prompt-submit.ts"],
  format: ["esm"],
  platform: "node",
  // Output .js instead of .mjs so bin fields in package.json resolve correctly
  outExtension: () => ({ js: ".js" }),
  // fs-extra and graceful-fs are CJS-only. Marking them external lets Node.js
  // handle CJS→ESM interop natively instead of tsup bundling them (which breaks
  // dynamic require). Top-level await also requires ESM output.
  external: ["fs-extra", "graceful-fs"],
  clean: true,
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
});

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/mcp-entry.ts", "src/hooks/prompt-submit.ts"],
  // CJS is the right format for a Node.js CLI: all transitive CJS deps
  // (fs-extra, graceful-fs, yaml, glob, etc.) work correctly without shims.
  format: ["cjs"],
  platform: "node",
  shims: true,    // polyfills import.meta.url, __dirname, __filename in CJS output
  clean: true,
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
});
